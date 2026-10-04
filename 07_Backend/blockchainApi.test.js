'use strict';
const { once } = require('node:events');
const { afterEach, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./server');
const { createFakeDb, createFakeLedger } = require('./blockchain/testing');

// Only verifyIdToken is needed: these tests exercise the batch/blockchain routes.
function createFakeAuth() {
  const tokens = new Map([
    ['admin-token', { uid: 'admin-1', role: 'system_admin' }],
    ['operator-token', { uid: 'operator-1', role: 'supply_chain_operator' }],
    ['traceability-token', { uid: 'trace-1', role: 'authorized_traceability_user' }]
  ]);
  return {
    async verifyIdToken(token) {
      const decoded = tokens.get(token);
      if (!decoded) {
        const error = new Error('Invalid token.');
        error.code = 'auth/invalid-id-token';
        throw error;
      }
      return decoded;
    }
  };
}

const BATCH = { produce_type: 'Avocado', quantity: 10, source_location: 'Nairobi' };

let server;
let app;
let db;
let ledger;
let request;

async function start(withLedger) {
  db = createFakeDb();
  ledger = withLedger ? createFakeLedger() : null;
  app = createApp({ auth: createFakeAuth(), db, ledger });
  server = app.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  request = (path, { token, ...options } = {}) => fetch(`http://127.0.0.1:${port}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
}

async function registerBatch() {
  const response = await request('/api/batches', {
    token: 'operator-token',
    method: 'POST',
    body: JSON.stringify(BATCH)
  });
  assert.equal(response.status, 201);
  const { traceability_id: id } = await response.json();
  await app.locals.settleBackgroundJobs();
  return id;
}

function addReadings(batchId, count = 2) {
  for (let n = 0; n < count; n += 1) {
    const key = `READING-${1000 + n}`;
    db.store.set(`ENVIRONMENTAL_READING/${batchId}/${key}`, {
      reading_id: key,
      device_id: 'ESP32-1',
      batch_id: batchId,
      temperature: 4 + n / 10,
      humidity: 90,
      recorded_at: `2026-01-01T00:00:0${n}.000Z`
    });
  }
}

afterEach(async () => {
  server.close();
  await once(server, 'close');
});

describe('Blockchain API with a ledger', () => {
  beforeEach(() => start(true));

  it('anchors a new batch in the background and verifies it', async () => {
    const id = await registerBatch();
    assert.equal(ledger.anchorCalls, 1);

    const response = await request(`/api/batches/${id}/verification`, { token: 'traceability-token' });
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.ledger_enabled, true);
    assert.equal(data.overall, 'verified');
    assert.equal(data.records[0].record_type, 'BATCH_REGISTRATION');
    assert.ok(data.records[0].tx_hash);
  });

  it('reports tampering with the stored batch', async () => {
    const id = await registerBatch();
    const stored = db.store.get(`PRODUCE_BATCH/${id}`);
    db.store.set(`PRODUCE_BATCH/${id}`, { ...stored, quantity: 99999 });

    const response = await request(`/api/batches/${id}/verification`, { token: 'operator-token' });
    assert.equal((await response.json()).data.overall, 'tampered');
  });

  it('keeps a batch registration successful when anchoring fails, and allows a retry', async () => {
    ledger.failNext = true;
    const id = await registerBatch();

    let verification = (await (await request(`/api/batches/${id}/verification`, { token: 'admin-token' })).json()).data;
    assert.equal(verification.overall, 'failed');

    const retry = await request(`/api/batches/${id}/anchor`, { token: 'operator-token', method: 'POST' });
    assert.equal(retry.status, 202);
    await app.locals.settleBackgroundJobs();

    verification = (await (await request(`/api/batches/${id}/verification`, { token: 'admin-token' })).json()).data;
    assert.equal(verification.overall, 'verified');
  });

  it('restricts anchoring to operators', async () => {
    const id = await registerBatch();
    for (const path of [`/api/batches/${id}/anchor`, `/api/batches/${id}/readings-digest`]) {
      assert.equal((await request(path, { method: 'POST' })).status, 401);
      assert.equal((await request(path, { token: 'admin-token', method: 'POST' })).status, 403);
      assert.equal((await request(path, { token: 'traceability-token', method: 'POST' })).status, 403);
    }
  });

  it('validates the batch ID and existence', async () => {
    assert.equal((await request('/api/batches/not-valid/anchor', { token: 'operator-token', method: 'POST' })).status, 400);
    assert.equal((await request('/api/batches/BATCH-1/anchor', { token: 'operator-token', method: 'POST' })).status, 404);
    assert.equal((await request('/api/batches/BATCH-1/verification', { token: 'operator-token' })).status, 404);
    assert.equal((await request('/api/batches/not-valid/verification', { token: 'operator-token' })).status, 400);
    assert.equal((await request('/api/batches/BATCH-1/verification')).status, 401);
  });

  it('anchors a digest of the recorded readings and detects an edited reading', async () => {
    const id = await registerBatch();

    const none = await request(`/api/batches/${id}/readings-digest`, { token: 'operator-token', method: 'POST' });
    assert.equal(none.status, 400);

    addReadings(id, 3);
    const started = await request(`/api/batches/${id}/readings-digest`, { token: 'operator-token', method: 'POST' });
    assert.equal(started.status, 202);
    assert.equal((await started.json()).data.reading_count, 3);
    await app.locals.settleBackgroundJobs();

    let verification = (await (await request(`/api/batches/${id}/verification`, { token: 'traceability-token' })).json()).data;
    assert.equal(verification.overall, 'verified');
    assert.equal(verification.records.length, 2);

    const key = `ENVIRONMENTAL_READING/${id}/READING-1001`;
    db.store.set(key, { ...db.store.get(key), temperature: 1.5 });
    verification = (await (await request(`/api/batches/${id}/verification`, { token: 'traceability-token' })).json()).data;
    assert.equal(verification.overall, 'tampered');
  });
});

describe('Blockchain API without a ledger', () => {
  beforeEach(() => start(false));

  it('still registers batches and reports the ledger as unavailable', async () => {
    const id = await registerBatch();

    const verification = await request(`/api/batches/${id}/verification`, { token: 'traceability-token' });
    assert.equal(verification.status, 200);
    assert.deepEqual((await verification.json()).data, { ledger_enabled: false, overall: 'unavailable', records: [] });

    const anchor = await request(`/api/batches/${id}/anchor`, { token: 'operator-token', method: 'POST' });
    assert.equal(anchor.status, 503);
    const digest = await request(`/api/batches/${id}/readings-digest`, { token: 'operator-token', method: 'POST' });
    assert.equal(digest.status, 503);
  });
});
