'use strict';
const { beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createBlockchainService } = require('../blockchain/service');
const { createFakeDb, createFakeLedger } = require('../blockchain/testing');
const { createComplianceService } = require('./service');

const BATCH_ID = 'BATCH-1000';
const BUYER = { uid: 'buyer-1', email: 'buyer@example.test' };
const EVENT_ID = 'EVENT-1790000000000-TA';

const batch = () => ({
  batch_id: BATCH_ID, produce_type: 'Avocado', quantity: 10, source_location: 'Nairobi',
  registration_date: '2026-01-01T00:00:00.000Z', status: 'Delivered'
});
const reading = (n) => ({
  reading_id: `READING-${1000 + n}`, device_id: 'ESP32-1', batch_id: BATCH_ID,
  temperature: 4, humidity: 90, recorded_at: `2026-01-01T00:00:0${n}.000Z`
});
const event = (overrides = {}) => ({
  event_id: EVENT_ID, batch_id: BATCH_ID, produce_type: 'Avocado', event_type: 'TEMPERATURE_EXCURSION',
  metric: 'temperature', direction: 'above', severity: 'warning', status: 'resolved',
  started_at: '2026-10-01T08:00:00.000Z', ended_at: '2026-10-01T08:01:00.000Z', device_id: 'ESP32-1',
  start_reading_id: 'READING-1', threshold_min: 2, threshold_max: 6, unit: '°C', peak_value: 7,
  peak_at: '2026-10-01T08:00:20.000Z', reading_count: 3, acknowledged: false, ...overrides
});

let db; let ledger; let blockchain; let compliance;

const seedBatch = () => db.store.set(`PRODUCE_BATCH/${BATCH_ID}`, batch());
const seedReadings = (count = 3) => {
  for (let n = 0; n < count; n += 1) db.store.set(`ENVIRONMENTAL_READING/${BATCH_ID}/READING-${1000 + n}`, reading(n));
};
const seedEvent = (overrides) => db.store.set(`COLD_CHAIN_EVENT/${BATCH_ID}/${overrides?.event_id || EVENT_ID}`, event(overrides));
const failedChecks = (result) => result.eligibility.checks.filter((c) => c.status === 'failed').map((c) => c.id);

// A batch that meets every condition: readings stored and the registration anchored.
async function seedReadyBatch() {
  seedBatch();
  seedReadings();
  await blockchain.anchorBatchRegistration(BATCH_ID);
}

beforeEach(() => {
  db = createFakeDb();
  ledger = createFakeLedger();
  const clock = () => '2026-10-02T10:00:00.000Z';
  blockchain = createBlockchainService({ db, ledger, now: clock });
  compliance = createComplianceService({ db, blockchain, now: clock });
});

describe('eligibility checks', () => {
  it('rejects unknown batches', async () => {
    await assert.rejects(compliance.getCompliance(BATCH_ID), { code: 'BATCH_NOT_FOUND' });
  });

  it('passes for a verified batch with readings and no excursions', async () => {
    await seedReadyBatch();
    const result = await compliance.getCompliance(BATCH_ID);
    assert.equal(result.decision, null);
    assert.equal(result.eligibility.eligible, true);
    assert.equal(result.eligibility.summary.reading_count, 3);
  });

  it('fails without any readings', async () => {
    seedBatch();
    await blockchain.anchorBatchRegistration(BATCH_ID);
    assert.deepEqual(failedChecks(await compliance.getCompliance(BATCH_ID)), ['readings_recorded']);
  });

  it('fails while an excursion is still open', async () => {
    await seedReadyBatch();
    seedEvent({ status: 'open', ended_at: null });
    assert.deepEqual(failedChecks(await compliance.getCompliance(BATCH_ID)), ['no_open_excursions']);
  });

  it('fails for an unacknowledged critical excursion until it is acknowledged and anchored', async () => {
    await seedReadyBatch();
    seedEvent({ severity: 'critical' });
    assert.deepEqual(failedChecks(await compliance.getCompliance(BATCH_ID)), ['critical_acknowledged', 'events_anchored']);

    seedEvent({ severity: 'critical', acknowledged: true });
    await blockchain.anchorEvent(BATCH_ID, EVENT_ID);
    assert.equal((await compliance.getCompliance(BATCH_ID)).eligibility.eligible, true);
  });

  it('does not block on an unacknowledged warning once its event is anchored', async () => {
    await seedReadyBatch();
    seedEvent();
    assert.deepEqual(failedChecks(await compliance.getCompliance(BATCH_ID)), ['events_anchored']);
    await blockchain.anchorEvent(BATCH_ID, EVENT_ID);
    assert.equal((await compliance.getCompliance(BATCH_ID)).eligibility.eligible, true);
  });

  it('fails when the batch was tampered with after anchoring', async () => {
    await seedReadyBatch();
    db.store.set(`PRODUCE_BATCH/${BATCH_ID}`, { ...batch(), quantity: 999 });
    assert.ok(failedChecks(await compliance.getCompliance(BATCH_ID)).includes('integrity'));
  });

  it('skips the integrity check when the ledger is off', async () => {
    seedBatch();
    seedReadings();
    const noLedger = createComplianceService({ db });
    const result = await noLedger.getCompliance(BATCH_ID);
    assert.equal(result.eligibility.eligible, true);
    assert.equal(result.eligibility.checks.find((c) => c.id === 'integrity').status, 'skipped');
  });
});

describe('recording decisions', () => {
  it('issues a certificate that commits to the evidence', async () => {
    await seedReadyBatch();
    const record = await compliance.decide(BATCH_ID, BUYER, { decision: 'accepted', note: 'Received in good order' });
    assert.equal(record.decision, 'accepted');
    assert.equal(record.decided_by, 'buyer@example.test');
    assert.equal(record.conditions_met, true);
    assert.equal(record.reading_count, 3);
    assert.equal(record.threshold_temperature_min, 2); // built-in default profile
    assert.match(record.readings_digest, /^0x[0-9a-f]{64}$/);
    assert.match(record.events_digest, /^0x[0-9a-f]{64}$/);

    const after = await compliance.getCompliance(BATCH_ID);
    assert.equal(after.decision.decision_id, `DECISION-${BATCH_ID}`);
    assert.equal(after.eligibility, null);
  });

  it('refuses acceptance when conditions are not met and explains which', async () => {
    await seedReadyBatch();
    seedEvent({ status: 'open', ended_at: null });
    await assert.rejects(
      compliance.decide(BATCH_ID, BUYER, { decision: 'accepted' }),
      (error) => error.code === 'NOT_ELIGIBLE' && error.details.checks.some((c) => c.id === 'no_open_excursions' && c.status === 'failed')
    );
    assert.equal(db.store.has(`COMPLIANCE_DECISION/${BATCH_ID}`), false);
  });

  it('allows rejection even when conditions fail, and records that', async () => {
    await seedReadyBatch();
    seedEvent({ status: 'open', ended_at: null });
    const record = await compliance.decide(BATCH_ID, BUYER, { decision: 'rejected', note: 'Warm on arrival' });
    assert.equal(record.decision, 'rejected');
    assert.equal(record.conditions_met, false);
    assert.equal(record.event_count, 1);
  });

  it('requires a reason to reject and validates input', async () => {
    await seedReadyBatch();
    await assert.rejects(compliance.decide(BATCH_ID, BUYER, { decision: 'rejected' }), { code: 'INVALID_INPUT' });
    await assert.rejects(compliance.decide(BATCH_ID, BUYER, { decision: 'rejected', note: '   ' }), { code: 'INVALID_INPUT' });
    await assert.rejects(compliance.decide(BATCH_ID, BUYER, { decision: 'maybe' }), { code: 'INVALID_INPUT' });
    await assert.rejects(compliance.decide(BATCH_ID, BUYER, { decision: 'accepted', note: 5 }), { code: 'INVALID_INPUT' });
    await assert.rejects(compliance.decide(BATCH_ID, BUYER, { decision: 'accepted', note: 'x'.repeat(281) }), { code: 'INVALID_INPUT' });
  });

  it('makes the decision final', async () => {
    await seedReadyBatch();
    await compliance.decide(BATCH_ID, BUYER, { decision: 'accepted' });
    await assert.rejects(compliance.decide(BATCH_ID, BUYER, { decision: 'rejected', note: 'changed my mind' }), { code: 'DECISION_EXISTS' });
  });

  it('records exactly one decision when two arrive together', async () => {
    await seedReadyBatch();
    const results = await Promise.allSettled([
      compliance.decide(BATCH_ID, BUYER, { decision: 'accepted' }),
      compliance.decide(BATCH_ID, BUYER, { decision: 'accepted' })
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(results.find((r) => r.status === 'rejected').reason.code, 'DECISION_EXISTS');
  });

  it('works without a ledger (stored, not anchored)', async () => {
    seedBatch();
    seedReadings();
    const noLedger = createComplianceService({ db });
    assert.equal((await noLedger.decide(BATCH_ID, BUYER, { decision: 'accepted' })).decision, 'accepted');
  });
});

describe('decision anchoring', () => {
  it('anchors and verifies a decision as its own record', async () => {
    await seedReadyBatch();
    await compliance.decide(BATCH_ID, BUYER, { decision: 'accepted' });
    const record = await blockchain.anchorDecision(BATCH_ID);
    assert.equal(record.status, 'confirmed');
    assert.equal(record.record_type, 'COMPLIANCE_DECISION');

    const result = await blockchain.verifyBatch(BATCH_ID);
    assert.equal(result.overall, 'verified');
    const row = result.records.find((r) => r.record_type === 'COMPLIANCE_DECISION');
    assert.equal(row.verification, 'verified');
    assert.equal(row.decision, 'accepted');
  });

  it('detects a decision edited in the database', async () => {
    await seedReadyBatch();
    await compliance.decide(BATCH_ID, BUYER, { decision: 'rejected', note: 'Warm on arrival' });
    await blockchain.anchorDecision(BATCH_ID);

    const path = `COMPLIANCE_DECISION/${BATCH_ID}`;
    db.store.set(path, { ...db.store.get(path), decision: 'accepted' });
    const row = (await blockchain.verifyBatch(BATCH_ID)).records.find((r) => r.record_type === 'COMPLIANCE_DECISION');
    assert.equal(row.verification, 'tampered');
  });

  it('detects an edited note and a deleted decision', async () => {
    await seedReadyBatch();
    await compliance.decide(BATCH_ID, BUYER, { decision: 'rejected', note: 'Warm on arrival' });
    await blockchain.anchorDecision(BATCH_ID);

    const path = `COMPLIANCE_DECISION/${BATCH_ID}`;
    const original = db.store.get(path);
    db.store.set(path, { ...original, note: 'Rejected for no reason' });
    const find = async () => (await blockchain.verifyBatch(BATCH_ID)).records.find((r) => r.record_type === 'COMPLIANCE_DECISION');
    assert.equal((await find()).verification, 'tampered');
    db.store.delete(path);
    assert.equal((await find()).verification, 'tampered');
  });

  it('refuses to anchor when no decision exists', async () => {
    await seedReadyBatch();
    await assert.rejects(blockchain.anchorDecision(BATCH_ID), { code: 'DECISION_NOT_FOUND' });
  });
});
