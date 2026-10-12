'use strict';
const { once } = require('node:events');
const { afterEach, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./server');
const { createFakeDb, createFakeLedger } = require('./blockchain/testing');

const TOKENS = {
  'admin-token': { uid: 'admin-1', email: 'admin@example.test', role: 'system_admin' },
  'operator-token': { uid: 'op-1', email: 'op@example.test', role: 'supply_chain_operator' },
  'trace-token': { uid: 'tr-1', role: 'authorized_traceability_user' },
  'norole-token': { uid: 'nr-1' }
};
const auth = {
  async verifyIdToken(token) {
    if (!TOKENS[token]) throw Object.assign(new Error('bad'), { code: 'auth/invalid-id-token' });
    return TOKENS[token];
  }
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const PROFILE = { produce_type: 'Avocado', temperature_min: 5, temperature_max: 7, humidity_min: 85, humidity_max: 90 };

let server; let app; let db; let ledger; let request;

async function start(withLedger) {
  db = createFakeDb();
  ledger = withLedger ? createFakeLedger() : null;
  app = createApp({ auth, db, ledger });
  server = app.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  request = (path, { token, body, ...o } = {}) => fetch(`http://127.0.0.1:${port}${path}`, {
    ...o,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
}
afterEach(async () => { server.close(); await once(server, 'close'); });

async function newBatch() {
  const res = await request('/api/batches', { token: 'operator-token', method: 'POST', body: { produce_type: 'Avocado', quantity: 5, source_location: 'Nairobi' } });
  const id = (await res.json()).traceability_id;
  await app.locals.settleBackgroundJobs();
  return id;
}
// Sends sensor readings like the ESP32 would (unauthenticated) and waits for processing.
async function send(batchId, temperature, humidity = 87) {
  const res = await request('/api/sensor-data', { method: 'POST', body: { device_id: 'ESP32-1', batch_id: batchId, temperature, humidity } });
  assert.equal(res.status, 201);
  await sleep(3); // reading IDs are millisecond timestamps
}
const getJson = async (path, token) => (await request(path, { token })).json();

describe('threshold API', () => {
  beforeEach(() => start(false));

  it('lets every role read and only administrators change thresholds', async () => {
    assert.equal((await request('/api/thresholds')).status, 401);
    assert.equal((await request('/api/thresholds', { token: 'norole-token' })).status, 403);
    for (const t of ['admin-token', 'operator-token', 'trace-token']) assert.equal((await request('/api/thresholds', { token: t })).status, 200);

    for (const t of ['operator-token', 'trace-token', 'norole-token']) {
      assert.equal((await request('/api/thresholds/avocado', { token: t, method: 'PUT', body: PROFILE })).status, 403);
      assert.equal((await request('/api/thresholds/avocado', { token: t, method: 'DELETE' })).status, 403);
    }
    assert.equal(db.store.size, 0);

    const saved = await request('/api/thresholds/avocado', { token: 'admin-token', method: 'PUT', body: PROFILE });
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).data.updated_by, 'admin@example.test');
    const list = (await getJson('/api/thresholds', 'trace-token')).data;
    assert.deepEqual(list.profiles.map((p) => p.profile_key), ['avocado']);
  });

  it('validates input and protects the default profile', async () => {
    const put = (key, body) => request(`/api/thresholds/${key}`, { token: 'admin-token', method: 'PUT', body });
    assert.equal((await put('avocado', { ...PROFILE, temperature_min: 9 })).status, 400);
    assert.equal((await put('mango', PROFILE)).status, 400); // key does not match produce type
    assert.equal((await put('avocado', { ...PROFILE, evil: 1 })).status, 400);
    assert.equal((await put('Bad_Key', PROFILE)).status, 400);
    assert.equal((await request('/api/thresholds/default', { token: 'admin-token', method: 'DELETE' })).status, 400);
    assert.equal((await request('/api/thresholds/nothing', { token: 'admin-token', method: 'DELETE' })).status, 404);
    assert.equal((await put('avocado', PROFILE)).status, 200);
    assert.equal((await request('/api/thresholds/avocado', { token: 'admin-token', method: 'DELETE' })).status, 204);
  });
});

describe('excursion events from sensor ingestion', () => {
  beforeEach(() => start(false));

  it('turns out-of-range readings into one event and resolves it', async () => {
    const id = await newBatch();
    await request('/api/thresholds/avocado', { token: 'admin-token', method: 'PUT', body: PROFILE });

    await send(id, 6); // too cold for 5-7? no: in range
    await send(id, 8.5); await send(id, 9.5); // two readings above 7
    await app.locals.settleBackgroundJobs();
    let events = (await getJson(`/api/batches/${id}/events`, 'trace-token')).data;
    assert.equal(events.length, 1);
    assert.equal(events[0].status, 'open');
    assert.equal(events[0].peak_value, 9.5);
    assert.equal(events[0].threshold_max, 7);

    await send(id, 6); await send(id, 6);
    await app.locals.settleBackgroundJobs();
    events = (await getJson(`/api/batches/${id}/events`, 'trace-token')).data;
    assert.equal(events.length, 1);
    assert.equal(events[0].status, 'resolved');

    const batchLimits = (await getJson(`/api/batches/${id}/thresholds`, 'trace-token')).data;
    assert.equal(batchLimits.source, 'produce');
    assert.deepEqual(batchLimits.temperature, { min: 5, max: 7 });
  });

  it('never rejects a reading, even for an unknown batch', async () => {
    await send('BATCH-999', 99, 1);
    assert.equal([...db.store.keys()].some((k) => k.startsWith('COLD_CHAIN_EVENT')), false);
  });

  it('filters alerts across batches and lets only operators acknowledge', async () => {
    const id = await newBatch();
    await send(id, 3); await send(id, 3); // below the built-in 2-6? no: 3 is in range. use 9
    await send(id, 9);
    await app.locals.settleBackgroundJobs();

    const open = (await getJson('/api/events?status=open', 'trace-token')).data;
    assert.equal(open.length, 1);
    assert.equal((await request('/api/events?status=bogus', { token: 'trace-token' })).status, 400);
    assert.equal((await request('/api/events')).status, 401);

    const ack = (eventId, token, body) => request(`/api/batches/${id}/events/${eventId}/acknowledge`, { token, method: 'POST', body });
    const eventId = open[0].event_id;
    for (const t of ['admin-token', 'trace-token', 'norole-token']) assert.equal((await ack(eventId, t, {})).status, 403);
    assert.equal((await ack('EVENT-1-TA', 'operator-token', {})).status, 404);
    assert.equal((await ack('bad-id', 'operator-token', {})).status, 400);
    assert.equal((await ack(eventId, 'operator-token', { note: 'x'.repeat(300) })).status, 400);

    const done = await ack(eventId, 'operator-token', { note: 'Checked the door' });
    assert.equal(done.status, 200);
    assert.equal((await done.json()).data.acknowledged_by, 'op@example.test');
    assert.equal((await getJson('/api/events?status=unacknowledged', 'operator-token')).data.length, 0);
  });

  it('reports 503 for event anchoring when no ledger is configured', async () => {
    const id = await newBatch();
    assert.equal((await request(`/api/batches/${id}/events/anchor`, { token: 'operator-token', method: 'POST' })).status, 503);
  });
});

describe('cold-chain events on the blockchain', () => {
  beforeEach(() => start(true));

  async function resolvedExcursion() {
    const id = await newBatch();
    await send(id, 9); await send(id, 9); await send(id, 4); await send(id, 4);
    await app.locals.settleBackgroundJobs();
    return id;
  }

  it('anchors a resolved event automatically and detects tampering', async () => {
    const id = await resolvedExcursion();
    let v = (await getJson(`/api/batches/${id}/verification`, 'trace-token')).data;
    const types = v.records.map((r) => r.record_type).sort();
    assert.deepEqual(types, ['BATCH_REGISTRATION', 'COLD_CHAIN_EVENT']);
    assert.equal(v.overall, 'verified');

    const key = [...db.store.keys()].find((k) => k.startsWith(`COLD_CHAIN_EVENT/${id}/`));
    db.store.set(key, { ...db.store.get(key), peak_value: 4.5, severity: 'warning' });
    v = (await getJson(`/api/batches/${id}/verification`, 'trace-token')).data;
    assert.equal(v.overall, 'tampered');
  });

  it('does not anchor an event that is still open', async () => {
    const id = await newBatch();
    await send(id, 9); await send(id, 9);
    await app.locals.settleBackgroundJobs();
    const v = (await getJson(`/api/batches/${id}/verification`, 'trace-token')).data;
    assert.deepEqual(v.records.map((r) => r.record_type), ['BATCH_REGISTRATION']);
    const res = await request(`/api/batches/${id}/events/anchor`, { token: 'operator-token', method: 'POST' });
    assert.equal(res.status, 400); // nothing resolved yet
  });

  it('retries a failed event anchor from the operator endpoint', async () => {
    const id = await newBatch();
    await send(id, 9); await send(id, 9); await send(id, 4);
    ledger.failNext = true; // fails the automatic anchoring triggered by resolution
    await send(id, 4);
    await app.locals.settleBackgroundJobs();
    const failed = (await getJson(`/api/batches/${id}/verification`, 'trace-token')).data;
    assert.equal(failed.overall, 'partial'); // registration verified, event failed
    assert.equal(failed.records.find((r) => r.record_type === 'COLD_CHAIN_EVENT').verification, 'failed');

    for (const t of ['admin-token', 'trace-token']) {
      assert.equal((await request(`/api/batches/${id}/events/anchor`, { token: t, method: 'POST' })).status, 403);
    }
    const retry = await request(`/api/batches/${id}/events/anchor`, { token: 'operator-token', method: 'POST' });
    assert.equal(retry.status, 202);
    assert.equal((await retry.json()).data.event_count, 1);
    await app.locals.settleBackgroundJobs();
    assert.equal((await getJson(`/api/batches/${id}/verification`, 'trace-token')).data.overall, 'verified');
  });
});
