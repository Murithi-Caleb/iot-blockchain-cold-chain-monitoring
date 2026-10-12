'use strict';
const { beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createBlockchainService, ServiceError } = require('./service');

const { createFakeDb, createFakeLedger } = require('./testing');

const BATCH_ID = 'BATCH-1000';
const batch = () => ({
  batch_id: BATCH_ID,
  produce_type: 'Avocado',
  quantity: 10,
  source_location: 'Nairobi',
  registration_date: '2026-01-01T00:00:00.000Z',
  status: 'In Transit'
});
const reading = (n, temperature = 4 + n / 10) => ({
  reading_id: `READING-${1000 + n}`,
  device_id: 'ESP32-1',
  batch_id: BATCH_ID,
  temperature,
  humidity: 90,
  recorded_at: `2026-01-01T00:00:0${n}.000Z`
});

let db;
let ledger;
let service;
let clock;

function seedBatch() { db.store.set(`PRODUCE_BATCH/${BATCH_ID}`, batch()); }
function seedReadings(count = 3) {
  for (let n = 0; n < count; n += 1) {
    db.store.set(`ENVIRONMENTAL_READING/${BATCH_ID}/READING-${1000 + n}`, reading(n));
  }
}

beforeEach(() => {
  db = createFakeDb();
  ledger = createFakeLedger();
  clock = 0;
  service = createBlockchainService({ db, ledger, now: () => `2026-02-01T00:00:${String(clock++).padStart(2, '0')}.000Z` });
  seedBatch();
});

// --- Tests -----------------------------------------------------------------

describe('batch registration anchoring', () => {
  it('anchors a registration hash and verifies it', async () => {
    const record = await service.anchorBatchRegistration(BATCH_ID);
    assert.equal(record.status, 'confirmed');
    assert.match(record.data_hash, /^0x[0-9a-f]{64}$/);
    assert.ok(record.tx_hash);
    assert.equal(ledger.chain.size, 1);

    const result = await service.verifyBatch(BATCH_ID);
    assert.equal(result.overall, 'verified');
    assert.equal(result.records[0].verification, 'verified');
    assert.equal(result.records[0].explorer_url, `https://explorer.test/tx/${record.tx_hash}`);
  });

  it('detects tampering with the stored batch', async () => {
    await service.anchorBatchRegistration(BATCH_ID);
    db.store.set(`PRODUCE_BATCH/${BATCH_ID}`, { ...batch(), quantity: 9999 });

    const result = await service.verifyBatch(BATCH_ID);
    assert.equal(result.overall, 'tampered');
    assert.equal(result.records[0].verification, 'tampered');
    assert.notEqual(result.records[0].current_hash, result.records[0].onchain_hash);
  });

  it('detects a deleted batch record', async () => {
    await service.anchorBatchRegistration(BATCH_ID);
    db.store.delete(`PRODUCE_BATCH/${BATCH_ID}`);
    assert.equal((await service.verifyBatch(BATCH_ID)).overall, 'tampered');
  });

  it('does not flag legitimate status changes', async () => {
    await service.anchorBatchRegistration(BATCH_ID);
    db.store.set(`PRODUCE_BATCH/${BATCH_ID}`, { ...batch(), status: 'Delivered' });
    assert.equal((await service.verifyBatch(BATCH_ID)).overall, 'verified');
  });

  it('is idempotent once confirmed', async () => {
    const first = await service.anchorBatchRegistration(BATCH_ID);
    const second = await service.anchorBatchRegistration(BATCH_ID);
    assert.equal(ledger.anchorCalls, 1);
    assert.equal(second.tx_hash, first.tx_hash);
  });

  it('never overwrites a confirmed record, even if the batch was edited since', async () => {
    const first = await service.anchorBatchRegistration(BATCH_ID);
    db.store.set(`PRODUCE_BATCH/${BATCH_ID}`, { ...batch(), quantity: 1 });
    const second = await service.anchorBatchRegistration(BATCH_ID);
    assert.equal(second.data_hash, first.data_hash);
    assert.equal(ledger.anchorCalls, 1);
  });

  it('rejects unknown batches', async () => {
    await assert.rejects(service.anchorBatchRegistration('BATCH-404'), (e) =>
      e instanceof ServiceError && e.code === 'BATCH_NOT_FOUND');
  });
});

describe('failure handling', () => {
  it('records a failed attempt without leaking provider details, then retries successfully', async () => {
    ledger.failNext = true;
    const failed = await service.anchorBatchRegistration(BATCH_ID);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.error, 'execution reverted');
    assert.ok(!JSON.stringify([...db.store.values()]).includes('SECRET'));

    const mid = await service.verifyBatch(BATCH_ID);
    assert.equal(mid.overall, 'failed');

    const retried = await service.anchorBatchRegistration(BATCH_ID);
    assert.equal(retried.status, 'confirmed');
    assert.equal((await service.verifyBatch(BATCH_ID)).overall, 'verified');
  });

  it('adopts a record that is already on-chain instead of sending a second transaction', async () => {
    await service.anchorBatchRegistration(BATCH_ID);
    // Simulate a lost status update: wipe the off-chain index but keep the chain.
    db.store.delete(`BLOCKCHAIN_RECORD/${BATCH_ID}/registration`);

    const adopted = await service.anchorBatchRegistration(BATCH_ID);
    assert.equal(adopted.status, 'confirmed');
    assert.equal(ledger.anchorCalls, 1);
  });

  it('refuses to adopt an on-chain record with a different fingerprint', async () => {
    await service.anchorBatchRegistration(BATCH_ID);
    db.store.delete(`BLOCKCHAIN_RECORD/${BATCH_ID}/registration`);
    db.store.set(`PRODUCE_BATCH/${BATCH_ID}`, { ...batch(), quantity: 1 });

    const result = await service.anchorBatchRegistration(BATCH_ID);
    assert.equal(result.status, 'failed');
  });

  it('reports the ledger as unavailable when the chain cannot be read', async () => {
    await service.anchorBatchRegistration(BATCH_ID);
    ledger.readFails = true;
    const result = await service.verifyBatch(BATCH_ID);
    assert.equal(result.overall, 'unavailable');
    assert.equal(result.records[0].error, 'Ledger request failed.');
  });

  it('flags a record that is missing from the chain', async () => {
    await service.anchorBatchRegistration(BATCH_ID);
    ledger.chain.clear();
    const result = await service.verifyBatch(BATCH_ID);
    assert.equal(result.overall, 'tampered');
    assert.equal(result.records[0].verification, 'missing_on_chain');
  });

  it('reports not_anchored when nothing has been anchored', async () => {
    assert.equal((await service.verifyBatch(BATCH_ID)).overall, 'not_anchored');
  });
});

describe('readings digest anchoring', () => {
  it('anchors one fingerprint for many readings and verifies it', async () => {
    seedReadings(3);
    const record = await service.anchorReadingsDigest(BATCH_ID);
    assert.equal(record.status, 'confirmed');
    assert.equal(record.reading_count, 3);
    assert.equal(record.first_reading_key, 'READING-1000');
    assert.equal(record.last_reading_key, 'READING-1002');
    assert.equal(ledger.chain.size, 1); // one record on-chain, not three

    assert.equal((await service.verifyBatch(BATCH_ID)).overall, 'verified');
  });

  it('detects an edited reading', async () => {
    seedReadings(3);
    await service.anchorReadingsDigest(BATCH_ID);
    db.store.set(`ENVIRONMENTAL_READING/${BATCH_ID}/READING-1001`, reading(1, 2.0));
    assert.equal((await service.verifyBatch(BATCH_ID)).overall, 'tampered');
  });

  it('detects a deleted reading', async () => {
    seedReadings(3);
    await service.anchorReadingsDigest(BATCH_ID);
    db.store.delete(`ENVIRONMENTAL_READING/${BATCH_ID}/READING-1001`);
    assert.equal((await service.verifyBatch(BATCH_ID)).overall, 'tampered');
  });

  it('detects a reading inserted inside the anchored range', async () => {
    seedReadings(3);
    await service.anchorReadingsDigest(BATCH_ID);
    db.store.set(`ENVIRONMENTAL_READING/${BATCH_ID}/READING-1001b`, { ...reading(1), reading_id: 'READING-1001b' });
    assert.equal((await service.verifyBatch(BATCH_ID)).overall, 'tampered');
  });

  it('ignores readings added after the anchored range, and a later digest covers them', async () => {
    seedReadings(3);
    await service.anchorReadingsDigest(BATCH_ID);
    db.store.set(`ENVIRONMENTAL_READING/${BATCH_ID}/READING-1003`, reading(3));
    assert.equal((await service.verifyBatch(BATCH_ID)).overall, 'verified');

    await service.anchorReadingsDigest(BATCH_ID);
    const result = await service.verifyBatch(BATCH_ID);
    assert.equal(result.records.length, 2);
    assert.equal(result.overall, 'verified');
  });

  it('refuses to anchor a batch with no readings', async () => {
    await assert.rejects(service.anchorReadingsDigest(BATCH_ID), (e) =>
      e instanceof ServiceError && e.code === 'NO_READINGS');
  });

  it('combines registration and digest results', async () => {
    seedReadings(2);
    await service.anchorBatchRegistration(BATCH_ID);
    await service.anchorReadingsDigest(BATCH_ID);
    db.store.set(`ENVIRONMENTAL_READING/${BATCH_ID}/READING-1000`, reading(0, 9.9));

    const result = await service.verifyBatch(BATCH_ID);
    assert.equal(result.overall, 'tampered');
    const byType = Object.fromEntries(result.records.map((r) => [r.record_type, r.verification]));
    assert.deepEqual(byType, { BATCH_REGISTRATION: 'verified', READINGS_DIGEST: 'tampered' });
  });
});

describe('concurrent anchoring', () => {
  it('sends one transaction and keeps the record confirmed when anchoring overlaps', async () => {
    const [a, b, c] = await Promise.all([
      service.anchorBatchRegistration(BATCH_ID),
      service.anchorBatchRegistration(BATCH_ID),
      service.anchorBatchRegistration(BATCH_ID)
    ]);
    assert.equal(ledger.anchorCalls, 1);
    assert.deepEqual([a.status, b.status, c.status], ['confirmed', 'confirmed', 'confirmed']);
    assert.equal(db.store.get(`BLOCKCHAIN_RECORD/${BATCH_ID}/registration`).status, 'confirmed');
    assert.equal((await service.verifyBatch(BATCH_ID)).overall, 'verified');
  });
});

describe('cold-chain event anchoring', () => {
  const EVENT_ID = 'EVENT-1790000000000-TA';
  const eventPath = (id = EVENT_ID) => `COLD_CHAIN_EVENT/${BATCH_ID}/${id}`;
  const resolvedEvent = (overrides = {}) => ({
    event_id: EVENT_ID,
    batch_id: BATCH_ID,
    produce_type: 'Avocado',
    event_type: 'TEMPERATURE_EXCURSION',
    metric: 'temperature',
    direction: 'above',
    severity: 'critical',
    status: 'resolved',
    started_at: '2026-10-01T08:00:00.000Z',
    ended_at: '2026-10-01T08:01:00.000Z',
    device_id: 'ESP32-1',
    start_reading_id: 'READING-1',
    threshold_min: 2,
    threshold_max: 6,
    unit: '°C',
    profile_key: 'default',
    profile_source: 'builtin',
    peak_value: 9.5,
    peak_at: '2026-10-01T08:00:20.000Z',
    peak_deviation: 3.5,
    reading_count: 6,
    last_reading_at: '2026-10-01T08:00:50.000Z',
    in_range_streak: 0,
    acknowledged: false,
    ...overrides
  });
  const seedEvent = (overrides) => db.store.set(eventPath(overrides?.event_id), resolvedEvent(overrides));

  it('anchors a resolved event and verifies it', async () => {
    seedEvent();
    const record = await service.anchorEvent(BATCH_ID, EVENT_ID);
    assert.equal(record.status, 'confirmed');
    assert.equal(record.record_type, 'COLD_CHAIN_EVENT');
    assert.equal(record.event_id, EVENT_ID);
    assert.equal(ledger.chain.size, 1);

    const result = await service.verifyBatch(BATCH_ID);
    assert.equal(result.overall, 'verified');
    assert.equal(result.records[0].event_id, EVENT_ID);
  });

  it('refuses events that do not exist or are still open', async () => {
    await assert.rejects(service.anchorEvent(BATCH_ID, EVENT_ID), (e) =>
      e instanceof ServiceError && e.code === 'EVENT_NOT_FOUND');

    seedEvent({ status: 'open', ended_at: null });
    await assert.rejects(service.anchorEvent(BATCH_ID, EVENT_ID), (e) =>
      e instanceof ServiceError && e.code === 'EVENT_NOT_RESOLVED');
    assert.equal(ledger.anchorCalls, 0);
  });

  it('detects tampering with each protected field', async () => {
    const edits = {
      peak_value: 6.5,
      severity: 'warning',
      ended_at: '2026-10-01T08:00:30.000Z',
      started_at: '2026-10-01T08:00:10.000Z',
      threshold_max: 12,
      reading_count: 1,
      direction: 'below',
      device_id: 'ESP32-9'
    };
    for (const [field, value] of Object.entries(edits)) {
      db = createFakeDb();
      ledger = createFakeLedger();
      service = createBlockchainService({ db, ledger, now: () => '2026-02-01T00:00:00.000Z' });
      db.store.set(`PRODUCE_BATCH/${BATCH_ID}`, batch());
      seedEvent();
      await service.anchorEvent(BATCH_ID, EVENT_ID);

      db.store.set(eventPath(), resolvedEvent({ [field]: value }));
      const result = await service.verifyBatch(BATCH_ID);
      assert.equal(result.overall, 'tampered', `editing ${field} must be detected`);
    }
  });

  it('detects a deleted event', async () => {
    seedEvent();
    await service.anchorEvent(BATCH_ID, EVENT_ID);
    db.store.delete(eventPath());
    assert.equal((await service.verifyBatch(BATCH_ID)).overall, 'tampered');
  });

  it('does not flag acknowledgements, notes or working fields', async () => {
    seedEvent();
    await service.anchorEvent(BATCH_ID, EVENT_ID);
    db.store.set(eventPath(), resolvedEvent({
      acknowledged: true,
      acknowledged_by: 'operator-1@example.test',
      acknowledgement_note: 'Door was left open',
      in_range_streak: 7,
      produce_type: 'Something else'
    }));
    assert.equal((await service.verifyBatch(BATCH_ID)).overall, 'verified');
  });

  it('anchors every resolved event of a batch, skips open ones, and is repeatable', async () => {
    seedEvent();
    seedEvent({ event_id: 'EVENT-1790000100000-HB', metric: 'humidity', event_type: 'HUMIDITY_EXCURSION', direction: 'below' });
    seedEvent({ event_id: 'EVENT-1790000200000-TA', status: 'open', ended_at: null });

    const first = await service.startEventsAnchoring(BATCH_ID);
    assert.equal(first.eventCount, 2);
    await first.done;
    assert.equal(ledger.chain.size, 2);

    const again = await service.startEventsAnchoring(BATCH_ID);
    await again.done;
    assert.equal(ledger.anchorCalls, 2); // nothing re-sent

    const result = await service.verifyBatch(BATCH_ID);
    assert.equal(result.overall, 'verified');
    assert.equal(result.records.length, 2);
  });

  it('reports a clear error when there is nothing to anchor', async () => {
    await assert.rejects(service.startEventsAnchoring(BATCH_ID), (e) => e.code === 'NO_EVENTS');
    seedEvent({ status: 'open', ended_at: null });
    await assert.rejects(service.startEventsAnchoring(BATCH_ID), (e) => e.code === 'NO_EVENTS');
    await assert.rejects(service.startEventsAnchoring('BATCH-404'), (e) => e.code === 'BATCH_NOT_FOUND');
  });

  it('retries a failed event anchor', async () => {
    seedEvent();
    ledger.failNext = true;
    const failed = await service.anchorEvent(BATCH_ID, EVENT_ID);
    assert.equal(failed.status, 'failed');
    assert.equal((await service.verifyBatch(BATCH_ID)).overall, 'failed');

    const job = await service.startEventsAnchoring(BATCH_ID);
    await job.done;
    assert.equal((await service.verifyBatch(BATCH_ID)).overall, 'verified');
  });

  it('keeps registration, readings and events as separate verified records', async () => {
    seedReadings(2);
    seedEvent();
    await service.anchorBatchRegistration(BATCH_ID);
    await service.anchorReadingsDigest(BATCH_ID);
    await service.anchorEvent(BATCH_ID, EVENT_ID);

    const result = await service.verifyBatch(BATCH_ID);
    assert.equal(result.overall, 'verified');
    assert.deepEqual(result.records.map((r) => r.record_type).sort(),
      ['BATCH_REGISTRATION', 'COLD_CHAIN_EVENT', 'READINGS_DIGEST']);
  });
});
