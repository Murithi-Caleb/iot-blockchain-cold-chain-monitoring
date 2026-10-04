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
