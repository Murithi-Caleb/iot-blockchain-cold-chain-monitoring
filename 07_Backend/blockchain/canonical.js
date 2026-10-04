'use strict';

// Deterministic hashing of off-chain records.
//
// The same record must always produce the same fingerprint, no matter which order its
// fields were stored in. We therefore serialise to "canonical JSON" (object keys sorted,
// no whitespace) and hash it with SHA-256. Only that 32-byte hash is written on-chain.
const crypto = require('node:crypto');

// Version tag mixed into every hash and key (domain separation). If the hashing rules
// ever change, bump this so old and new fingerprints can never be confused.
const HASH_SCHEME = 'ccm-v1';

// Must match the uint8 values accepted by ColdChainRegistry.anchorRecord.
const RECORD_TYPES = Object.freeze({
  BATCH_REGISTRATION: 0,
  READINGS_DIGEST: 1,
  COLD_CHAIN_EVENT: 2, // reserved: alerts/excursions phase
  MOVEMENT_EVENT: 3 // reserved: produce movement phase
});

const RECORD_TYPE_NAMES = Object.freeze(
  Object.fromEntries(Object.entries(RECORD_TYPES).map(([name, code]) => [code, name]))
);

function canonicalize(value) {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) {
        throw new TypeError('Cannot canonicalize a non-finite number.');
      }
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value.map(canonicalize).join(',')}]`;
      }
      const members = Object.keys(value)
        .filter((key) => value[key] !== undefined)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`);
      return `{${members.join(',')}}`;
    }
    default:
      throw new TypeError(`Cannot canonicalize a value of type ${typeof value}.`);
  }
}

function sha256Hex(text) {
  return `0x${crypto.createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

// Fingerprint of a record payload (a 0x-prefixed 32-byte hex string = Solidity bytes32).
function hashPayload(payload) {
  return sha256Hex(`${HASH_SCHEME}|${canonicalize(payload)}`);
}

// Opaque 32-byte identifiers (record IDs, batch keys). Hashing means no business data
// such as batch IDs is readable on-chain, yet anyone holding the batch ID can
// recompute the key and look the record up.
function deriveKey(...parts) {
  return sha256Hex([HASH_SCHEME, ...parts].join('|'));
}

// Only IMMUTABLE registration fields are hashed. `status` is deliberately excluded:
// it legitimately changes during transit, and including it would make honest updates
// look like tampering.
function batchRegistrationPayload(batch) {
  return {
    batch_id: batch.batch_id,
    produce_type: batch.produce_type,
    quantity: batch.quantity,
    source_location: batch.source_location,
    registration_date: batch.registration_date
  };
}

function readingPayload(reading) {
  return {
    reading_id: reading.reading_id,
    device_id: reading.device_id,
    batch_id: reading.batch_id,
    temperature: reading.temperature,
    humidity: reading.humidity,
    recorded_at: reading.recorded_at
  };
}

// `readings` must already be in chronological (key) order. Order is part of the hash,
// so inserting, deleting, editing or reordering any reading changes the fingerprint.
function readingsDigestPayload(readings) {
  return readings.map(readingPayload);
}

module.exports = {
  HASH_SCHEME,
  RECORD_TYPES,
  RECORD_TYPE_NAMES,
  batchRegistrationPayload,
  canonicalize,
  deriveKey,
  hashPayload,
  readingsDigestPayload,
  sha256Hex
};
