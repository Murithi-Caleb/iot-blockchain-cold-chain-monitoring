'use strict';
const { beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createColdChainService } = require('./service');
const { ServiceError } = require('../serviceError');
const { createFakeDb } = require('../blockchain/testing');

const BASE = Date.parse('2026-10-01T08:00:00.000Z');
const at = (n) => new Date(BASE + n * 10000).toISOString();
const ACTOR = { uid: 'operator-1', email: 'operator-1@example.test' };
const ADMIN = { uid: 'admin-1', email: 'admin-1@example.test' };

let db;
let service;
let clock;
let counter;

const batch = (id, produce = 'Avocados') => ({
  batch_id: id,
  produce_type: produce,
  quantity: 10,
  source_location: 'Nairobi',
  registration_date: '2026-10-01T07:00:00.000Z',
  status: 'In Transit'
});
const reading = (batchId, n, temperature, humidity = 90) => ({
  reading_id: `READING-${++counter}`,
  device_id: 'ESP32-1',
  batch_id: batchId,
  temperature,
  humidity,
  recorded_at: at(n)
});
const eventsOf = (batchId) => [...db.store.entries()]
  .filter(([key]) => key.startsWith(`COLD_CHAIN_EVENT/${batchId}/`))
  .map(([, value]) => value);

beforeEach(() => {
  db = createFakeDb();
  clock = 0;
  counter = 0;
  service = createColdChainService({ db, now: () => `2026-10-02T00:00:${String(clock++).padStart(2, '0')}.000Z` });
  db.store.set('PRODUCE_BATCH/BATCH-1', batch('BATCH-1'));
});

describe('threshold profiles', () => {
  it('reports the built-in default until one is saved', async () => {
    const { default: def, profiles } = await service.getThresholds();
    assert.equal(def.is_builtin, true);
    assert.deepEqual(def.temperature, { min: 2, max: 6 });
    assert.deepEqual(profiles, []);
  });

  it('saves, lists and deletes profiles and records who changed them', async () => {
    const saved = await service.saveProfile('avocados', {
      produce_type: 'Avocados', temperature_min: 5, temperature_max: 7, humidity_min: 85, humidity_max: 90
    }, ADMIN);
    assert.equal(saved.updated_by, 'admin-1@example.test');
    assert.equal(saved.is_builtin, false);

    await service.saveProfile('default', { temperature_min: 1, temperature_max: 4, humidity_min: 80, humidity_max: 90 }, ADMIN);
    await service.saveProfile('french-beans', {
      produce_type: 'French beans', temperature_min: 4, temperature_max: 7, humidity_min: 90, humidity_max: 95
    }, ADMIN);

    const listed = await service.getThresholds();
    assert.equal(listed.default.is_builtin, false);
    assert.deepEqual(listed.default.temperature, { min: 1, max: 4 });
    assert.deepEqual(listed.profiles.map((profile) => profile.profile_key), ['avocados', 'french-beans']);

    await service.deleteProfile('avocados');
    assert.deepEqual((await service.getThresholds()).profiles.map((p) => p.profile_key), ['french-beans']);
    await assert.rejects(service.deleteProfile('avocados'), (e) => e instanceof ServiceError && e.code === 'PROFILE_NOT_FOUND');
  });

  it('rejects invalid input without writing anything', async () => {
    await assert.rejects(
      service.saveProfile('avocados', { produce_type: 'Avocados', temperature_min: 9, temperature_max: 7, humidity_min: 85, humidity_max: 90 }, ADMIN),
      (e) => e instanceof ServiceError && e.code === 'INVALID_INPUT'
    );
    assert.equal(db.store.has('THRESHOLD_PROFILE/avocados'), false);
  });

  it('chooses the right profile per batch', async () => {
    db.store.set('PRODUCE_BATCH/BATCH-2', batch('BATCH-2', 'Mangoes'));
    await service.saveProfile('avocados', { produce_type: 'Avocados', temperature_min: 5, temperature_max: 7, humidity_min: 85, humidity_max: 90 }, ADMIN);

    const avocado = await service.getBatchThresholds('BATCH-1');
    assert.equal(avocado.source, 'produce');
    assert.equal(avocado.label, 'Avocados');
    assert.deepEqual(avocado.temperature, { min: 5, max: 7 });

    const mango = await service.getBatchThresholds('BATCH-2');
    assert.equal(mango.source, 'builtin');
    await assert.rejects(service.getBatchThresholds('BATCH-404'), (e) => e.code === 'BATCH_NOT_FOUND');
  });
});

describe('evaluating readings', () => {
  it('stores nothing for in-range readings', async () => {
    const result = await service.evaluateReading(reading('BATCH-1', 0, 4));
    assert.deepEqual(result, { changed: [], resolved: [] });
    assert.equal(eventsOf('BATCH-1').length, 0);
  });

  it('skips readings for batches that are not registered', async () => {
    const result = await service.evaluateReading(reading('BATCH-404', 0, 99));
    assert.equal(result.skipped, 'unknown_batch');
    assert.equal(eventsOf('BATCH-404').length, 0);
    assert.equal((await service.evaluateReading({ batch_id: 5 })).skipped, 'invalid_reading');
  });

  it('opens, extends and resolves an event in the database', async () => {
    await service.evaluateReading(reading('BATCH-1', 0, 8));
    await service.evaluateReading(reading('BATCH-1', 1, 9));
    assert.equal(eventsOf('BATCH-1').length, 1);
    assert.equal(eventsOf('BATCH-1')[0].status, 'open');
    assert.equal(eventsOf('BATCH-1')[0].reading_count, 2);

    await service.evaluateReading(reading('BATCH-1', 2, 5));
    const last = await service.evaluateReading(reading('BATCH-1', 3, 5));
    assert.equal(last.resolved.length, 1);
    assert.equal(eventsOf('BATCH-1')[0].status, 'resolved');
    assert.equal(eventsOf('BATCH-1')[0].ended_at, at(2));
  });

  it('applies the produce profile configured by the administrator', async () => {
    await service.saveProfile('avocados', { produce_type: 'Avocados', temperature_min: 5, temperature_max: 13, humidity_min: 85, humidity_max: 95 }, ADMIN);
    await service.evaluateReading(reading('BATCH-1', 0, 4)); // below 5, but fine for the 2-6 default
    const [event] = eventsOf('BATCH-1');
    assert.equal(event.direction, 'below');
    assert.equal(event.threshold_min, 5);
    assert.equal(event.profile_source, 'produce');
  });

  it('does not rewrite an open event with new limits retroactively', async () => {
    await service.evaluateReading(reading('BATCH-1', 0, 8)); // opens under the built-in 2-6
    await service.saveProfile('avocados', { produce_type: 'Avocados', temperature_min: 5, temperature_max: 13, humidity_min: 85, humidity_max: 95 }, ADMIN);
    await service.evaluateReading(reading('BATCH-1', 1, 9)); // 9 is fine under the new profile
    const [event] = eventsOf('BATCH-1');
    assert.equal(event.threshold_max, 6); // limits recorded at the start are kept
    assert.equal(event.in_range_streak, 1);
  });

  it('creates exactly one event when many readings arrive at the same time', async () => {
    const readings = [0, 1, 2, 3, 4, 5].map((n) => reading('BATCH-1', n, 8 + n / 10));
    await Promise.all(readings.map((r) => service.evaluateReading(r)));
    const events = eventsOf('BATCH-1');
    assert.equal(events.length, 1);
    assert.equal(events[0].reading_count, 6);
  });

  it('keeps batches independent of each other', async () => {
    db.store.set('PRODUCE_BATCH/BATCH-2', batch('BATCH-2'));
    await Promise.all([
      service.evaluateReading(reading('BATCH-1', 0, 8)),
      service.evaluateReading(reading('BATCH-2', 0, 4))
    ]);
    assert.equal(eventsOf('BATCH-1').length, 1);
    assert.equal(eventsOf('BATCH-2').length, 0);
  });

  it('keeps working after a failed evaluation', async () => {
    const original = db.ref;
    db.ref = (path) => {
      if (path.startsWith('COLD_CHAIN_EVENT/BATCH-1')) {
        return { async once() { throw new Error('database unavailable'); } };
      }
      return original(path);
    };
    await assert.rejects(service.evaluateReading(reading('BATCH-1', 0, 8)), /database unavailable/);
    db.ref = original;
    const result = await service.evaluateReading(reading('BATCH-1', 1, 8));
    assert.equal(result.changed.length, 1);
  });
});

describe('listing and acknowledging events', () => {
  async function seed() {
    db.store.set('PRODUCE_BATCH/BATCH-2', batch('BATCH-2', 'Mangoes'));
    await service.evaluateReading(reading('BATCH-1', 0, 8));
    await service.evaluateReading(reading('BATCH-1', 1, 5));
    await service.evaluateReading(reading('BATCH-1', 2, 5)); // resolved
    await service.evaluateReading(reading('BATCH-2', 5, 9)); // open, newer
    await service.evaluateReading(reading('BATCH-2', 6, 90, 70)); // humidity open too
  }

  it('lists events across batches, newest first, with filters', async () => {
    await seed();
    const all = await service.listEvents();
    assert.equal(all.length, 3);
    assert.deepEqual(all.map((e) => e.started_at), [...all.map((e) => e.started_at)].sort().reverse());

    assert.equal((await service.listEvents({ status: 'open' })).length, 2);
    assert.equal((await service.listEvents({ status: 'resolved' })).length, 1);
    assert.equal((await service.listEvents({ limit: 1 })).length, 1);
    await assert.rejects(service.listEvents({ status: 'nonsense' }), (e) => e.code === 'INVALID_INPUT');
  });

  it('lists the events of one batch', async () => {
    await seed();
    assert.equal((await service.listBatchEvents('BATCH-1')).length, 1);
    assert.equal((await service.listBatchEvents('BATCH-9')).length, 0);
  });

  it('acknowledges once, keeps the first acknowledgement and drops it from the attention list', async () => {
    await seed();
    const [resolved] = await service.listBatchEvents('BATCH-1');
    assert.equal((await service.listEvents({ status: 'unacknowledged' })).length, 3);

    const first = await service.acknowledge('BATCH-1', resolved.event_id, ACTOR, '  Checked the cold room door  ');
    assert.equal(first.alreadyAcknowledged, false);
    assert.equal(first.event.acknowledged_by, 'operator-1@example.test');
    assert.equal(first.event.acknowledgement_note, 'Checked the cold room door');

    const second = await service.acknowledge('BATCH-1', resolved.event_id, { uid: 'someone-else' }, 'later');
    assert.equal(second.alreadyAcknowledged, true);
    assert.equal(second.event.acknowledged_by, 'operator-1@example.test');

    // Resolved and acknowledged: no longer needs attention.
    assert.equal((await service.listEvents({ status: 'attention' })).length, 2);
  });

  it('keeps the acknowledgement when an open event later changes', async () => {
    await service.evaluateReading(reading('BATCH-1', 0, 8));
    const [open] = await service.listBatchEvents('BATCH-1');
    await service.acknowledge('BATCH-1', open.event_id, ACTOR);
    await service.evaluateReading(reading('BATCH-1', 1, 9));
    const [after] = await service.listBatchEvents('BATCH-1');
    assert.equal(after.acknowledged, true);
    assert.equal(after.reading_count, 2);
  });

  it('rejects unknown events and bad notes', async () => {
    await assert.rejects(service.acknowledge('BATCH-1', 'EVENT-1-TA', ACTOR), (e) => e.code === 'EVENT_NOT_FOUND');
    await service.evaluateReading(reading('BATCH-1', 0, 8));
    const [event] = await service.listBatchEvents('BATCH-1');
    await assert.rejects(service.acknowledge('BATCH-1', event.event_id, ACTOR, 'x'.repeat(281)), (e) => e.code === 'INVALID_INPUT');
    await assert.rejects(service.acknowledge('BATCH-1', event.event_id, ACTOR, 42), (e) => e.code === 'INVALID_INPUT');
    assert.equal((await service.listBatchEvents('BATCH-1'))[0].acknowledged, false);
  });
});
