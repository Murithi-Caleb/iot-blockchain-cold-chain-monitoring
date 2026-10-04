'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  RECORD_TYPES,
  batchRegistrationPayload,
  canonicalize,
  deriveKey,
  hashPayload
} = require('./canonical');

describe('canonical hashing', () => {
  it('produces identical output regardless of key order', () => {
    assert.equal(canonicalize({ b: 1, a: { d: 2, c: [3, { z: 1, y: 2 }] } }),
      canonicalize({ a: { c: [3, { y: 2, z: 1 }], d: 2 }, b: 1 }));
    assert.equal(canonicalize({ b: 1, a: 2 }), '{"a":2,"b":1}');
  });

  it('ignores undefined members but keeps nulls and array order', () => {
    assert.equal(canonicalize({ a: undefined, b: null }), '{"b":null}');
    assert.notEqual(canonicalize([1, 2]), canonicalize([2, 1]));
  });

  it('rejects values that cannot be hashed deterministically', () => {
    assert.throws(() => canonicalize({ a: NaN }), TypeError);
    assert.throws(() => canonicalize({ a: Infinity }), TypeError);
    assert.throws(() => canonicalize({ a: () => 1 }), TypeError);
  });

  it('returns a 0x-prefixed 32-byte hex hash that changes with any edit', () => {
    const base = { batch_id: 'BATCH-1', quantity: 10 };
    const hash = hashPayload(base);
    assert.match(hash, /^0x[0-9a-f]{64}$/);
    assert.equal(hashPayload({ quantity: 10, batch_id: 'BATCH-1' }), hash);
    assert.notEqual(hashPayload({ ...base, quantity: 11 }), hash);
    assert.notEqual(hashPayload({ ...base, quantity: '10' }), hash);
  });

  it('is stable: a known payload always hashes to the same value', () => {
    // Guards against accidental changes to the hashing scheme, which would invalidate
    // every fingerprint already anchored on-chain.
    assert.equal(
      hashPayload({ a: 1 }),
      '0x' + require('node:crypto').createHash('sha256').update('ccm-v1|{"a":1}').digest('hex')
    );
  });

  it('derives distinct, deterministic keys', () => {
    const one = deriveKey('record', 0, 'BATCH-1', 'registration');
    assert.equal(deriveKey('record', 0, 'BATCH-1', 'registration'), one);
    assert.notEqual(deriveKey('record', 1, 'BATCH-1', 'registration'), one);
    assert.notEqual(deriveKey('record', 0, 'BATCH-2', 'registration'), one);
    assert.match(one, /^0x[0-9a-f]{64}$/);
  });

  it('hashes only the immutable batch registration fields', () => {
    const batch = {
      batch_id: 'BATCH-1',
      produce_type: 'Avocado',
      quantity: 10,
      source_location: 'Nairobi',
      registration_date: '2026-01-01T00:00:00.000Z',
      status: 'In Transit'
    };
    const before = hashPayload(batchRegistrationPayload(batch));
    assert.equal(hashPayload(batchRegistrationPayload({ ...batch, status: 'Delivered' })), before);
    assert.notEqual(hashPayload(batchRegistrationPayload({ ...batch, quantity: 11 })), before);
  });

  it('keeps record type codes aligned with the contract', () => {
    assert.deepEqual(RECORD_TYPES, {
      BATCH_REGISTRATION: 0,
      READINGS_DIGEST: 1,
      COLD_CHAIN_EVENT: 2,
      MOVEMENT_EVENT: 3
    });
  });
});
