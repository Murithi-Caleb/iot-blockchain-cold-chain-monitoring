'use strict';
const { once } = require('node:events');
const { afterEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./server');
const { createFakeDb, createFakeLedger } = require('./blockchain/testing');

const TOKENS = {
  'admin-token': { uid: 'admin-1', role: 'system_admin' },
  'operator-token': { uid: 'op-1', email: 'op@example.test', role: 'supply_chain_operator' },
  'buyer-token': { uid: 'tr-1', email: 'buyer@example.test', role: 'authorized_traceability_user' },
  'norole-token': { uid: 'nr-1' }
};
const auth = {
  async verifyIdToken(token) {
    if (!TOKENS[token]) throw Object.assign(new Error('bad'), { code: 'auth/invalid-id-token' });
    return TOKENS[token];
  }
};

let server; let app; let db; let request;

async function start(withLedger = true) {
  db = createFakeDb();
  app = createApp({ auth, db, ledger: withLedger ? createFakeLedger() : null });
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

async function newBatchWithReadings() {
  const res = await request('/api/batches', { token: 'operator-token', method: 'POST', body: { produce_type: 'Avocado', quantity: 5, source_location: 'Nairobi' } });
  const id = (await res.json()).traceability_id;
  await app.locals.settleBackgroundJobs();
  db.store.set(`ENVIRONMENTAL_READING/${id}/READING-1`, { reading_id: 'READING-1', device_id: 'ESP32-1', batch_id: id, temperature: 4, humidity: 90, recorded_at: '2026-10-01T08:00:00.000Z' });
  return id;
}
const decide = (id, token, body) => request(`/api/batches/${id}/compliance`, { token, method: 'POST', body });

describe('compliance API', () => {
  it('lets only the traceability role decide, and every role read', async () => {
    await start();
    const id = await newBatchWithReadings();
    assert.equal((await decide(id, undefined, { decision: 'accepted' })).status, 401);
    for (const token of ['operator-token', 'admin-token', 'norole-token']) {
      assert.equal((await decide(id, token, { decision: 'accepted' })).status, 403, token);
    }
    assert.equal((await request(`/api/batches/${id}/compliance`)).status, 401);
    assert.equal((await request(`/api/batches/${id}/compliance`, { token: 'norole-token' })).status, 403);
    for (const token of ['operator-token', 'admin-token', 'buyer-token']) {
      assert.equal((await request(`/api/batches/${id}/compliance`, { token })).status, 200, token);
    }
    assert.equal(db.store.has(`COMPLIANCE_DECISION/${id}`), false);
  });

  it('shows the checks, issues a certificate and anchors it', async () => {
    await start();
    const id = await newBatchWithReadings();
    const before = (await (await request(`/api/batches/${id}/compliance`, { token: 'buyer-token' })).json()).data;
    assert.equal(before.decision, null);
    assert.equal(before.eligibility.eligible, true);

    const res = await decide(id, 'buyer-token', { decision: 'accepted', note: 'All good' });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.data.decided_by, 'buyer@example.test');
    await app.locals.settleBackgroundJobs();

    const verification = (await (await request(`/api/batches/${id}/verification`, { token: 'operator-token' })).json()).data;
    assert.equal(verification.overall, 'verified');
    assert.equal(verification.records.find((r) => r.record_type === 'COMPLIANCE_DECISION').decision, 'accepted');

    assert.equal((await decide(id, 'buyer-token', { decision: 'rejected', note: 'later' })).status, 409);
    const after = (await (await request(`/api/batches/${id}/compliance`, { token: 'operator-token' })).json()).data;
    assert.equal(after.decision.decision, 'accepted');
  });

  it('returns the failed checks when acceptance is not allowed, and records a rejection', async () => {
    await start();
    const id = await newBatchWithReadings();
    db.store.set(`COLD_CHAIN_EVENT/${id}/EVENT-1-TA`, { event_id: 'EVENT-1-TA', batch_id: id, status: 'open', severity: 'warning', metric: 'temperature', direction: 'above', started_at: '2026-10-01T08:00:00.000Z', acknowledged: false });

    const refused = await decide(id, 'buyer-token', { decision: 'accepted' });
    assert.equal(refused.status, 409);
    const refusedBody = await refused.json();
    assert.ok(refusedBody.details.checks.some((c) => c.id === 'no_open_excursions' && c.status === 'failed'));

    assert.equal((await decide(id, 'buyer-token', { decision: 'rejected' })).status, 400); // reason required
    const rejected = await decide(id, 'buyer-token', { decision: 'rejected', note: 'Warm on arrival' });
    assert.equal(rejected.status, 201);
    await app.locals.settleBackgroundJobs();
    const verification = (await (await request(`/api/batches/${id}/verification`, { token: 'buyer-token' })).json()).data;
    assert.equal(verification.records.find((r) => r.record_type === 'COMPLIANCE_DECISION').verification, 'verified');
  });

  it('validates the batch ID and reports unknown batches', async () => {
    await start();
    assert.equal((await request('/api/batches/NOPE/compliance', { token: 'buyer-token' })).status, 400);
    assert.equal((await request('/api/batches/BATCH-99/compliance', { token: 'buyer-token' })).status, 404);
    assert.equal((await decide('BATCH-99', 'buyer-token', { decision: 'rejected', note: 'x' })).status, 404);
  });

  it('retries anchoring only for the traceability role and only with a ledger', async () => {
    await start();
    const id = await newBatchWithReadings();
    assert.equal((await request(`/api/batches/${id}/compliance/anchor`, { token: 'buyer-token', method: 'POST' })).status, 404); // no decision yet
    await decide(id, 'buyer-token', { decision: 'accepted' });
    await app.locals.settleBackgroundJobs();
    assert.equal((await request(`/api/batches/${id}/compliance/anchor`, { token: 'operator-token', method: 'POST' })).status, 403);
    assert.equal((await request(`/api/batches/${id}/compliance/anchor`, { token: 'buyer-token', method: 'POST' })).status, 202);
    await app.locals.settleBackgroundJobs();
  });

  it('stores decisions without a ledger and reports the integrity check as skipped', async () => {
    await start(false);
    const id = await newBatchWithReadings();
    const before = (await (await request(`/api/batches/${id}/compliance`, { token: 'buyer-token' })).json()).data;
    assert.equal(before.eligibility.checks.find((c) => c.id === 'integrity').status, 'skipped');
    assert.equal((await decide(id, 'buyer-token', { decision: 'accepted' })).status, 201);
    assert.equal((await request(`/api/batches/${id}/compliance/anchor`, { token: 'buyer-token', method: 'POST' })).status, 503);
  });
});
