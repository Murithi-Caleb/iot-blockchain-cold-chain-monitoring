'use strict';

// Application logic that joins the off-chain database and the on-chain registry:
//
//   anchor:  database record -> canonical hash -> transaction -> status saved in the DB
//   verify:  database record -> recompute hash -> compare with the hash read from chain
//
// Raw data (batch details, high-frequency sensor readings) always stays in Firebase.
// The chain only ever receives fingerprints.
//
// Anchoring status is tracked in Realtime Database under
//   BLOCKCHAIN_RECORD/{batchId}/{recordKey}
// (record_type, data_hash, status, tx_hash, block_number, ...). That node is a
// convenience index only: verification never trusts it and always recomputes the
// record ID and compares against the chain itself.

const {
  RECORD_TYPES,
  RECORD_TYPE_NAMES,
  batchRegistrationPayload,
  deriveKey,
  hashPayload,
  readingsDigestPayload
} = require('./canonical');

const REGISTRATION_KEY = 'registration';
const MAX_DIGEST_READINGS = 1000;

class ServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
  }
}

const compareKeys = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Never put raw provider errors (which can contain RPC URLs or keys) into stored data
// or API responses. ethers errors expose a safe `shortMessage`.
function safeErrorMessage(error) {
  if (error instanceof ServiceError) return error.message;
  const message = error && (error.shortMessage || error.reason);
  return typeof message === 'string' ? message.slice(0, 200) : 'Ledger request failed.';
}

function createBlockchainService({ db, ledger, now = () => new Date().toISOString() }) {
  if (!db || !ledger) {
    throw new Error('createBlockchainService requires a database and a ledger.');
  }

  const recordPath = (batchId, recordKey) => `BLOCKCHAIN_RECORD/${batchId}/${recordKey}`;
  const recordIdFor = (recordType, batchId, recordKey) =>
    deriveKey('record', recordType, batchId, recordKey);

  async function readValue(path) {
    return (await db.ref(path).once('value')).val();
  }

  async function readBatch(batchId) {
    return readValue(`PRODUCE_BATCH/${batchId}`);
  }

  // [[key, reading], ...] in chronological (key) order.
  async function readReadingEntries(batchId) {
    const readings = (await readValue(`ENVIRONMENTAL_READING/${batchId}`)) || {};
    return Object.entries(readings).sort(([a], [b]) => compareKeys(a, b));
  }

  // Core anchoring routine shared by every record type. Never throws for ledger
  // problems: failures are stored on the record with status "failed" so they can be
  // retried and shown to the user.
  async function anchor({ batchId, recordKey, recordType, dataHash, meta = {} }) {
    const path = recordPath(batchId, recordKey);

    // A confirmed record is never overwritten; this keeps the audit trail intact and
    // makes repeated calls (retries, double clicks) harmless.
    const existing = await readValue(path);
    if (existing && existing.status === 'confirmed') {
      return existing;
    }

    const pending = {
      record_key: recordKey,
      record_type: RECORD_TYPE_NAMES[recordType],
      record_type_code: recordType,
      data_hash: dataHash,
      status: 'pending',
      requested_at: now(),
      ...meta
    };
    await db.ref(path).set(pending);

    try {
      const recordId = recordIdFor(recordType, batchId, recordKey);
      const batchKey = deriveKey('batch', batchId);
      const onChain = await ledger.getOnChain(recordId);

      let txHash = null;
      let blockNumber = null;
      if (onChain.exists) {
        // Already on-chain (for example an earlier attempt was mined but its status
        // update was lost). Only accept it if it is the same fingerprint.
        if (onChain.dataHash !== dataHash) {
          throw new ServiceError(
            'HASH_CONFLICT',
            'A different fingerprint is already anchored on-chain for this record.'
          );
        }
      } else {
        const result = await ledger.anchor({ recordId, batchKey, recordType, dataHash });
        txHash = result.txHash;
        blockNumber = result.blockNumber;
      }

      const confirmed = {
        ...pending,
        status: 'confirmed',
        tx_hash: txHash,
        block_number: blockNumber,
        anchored_at: now()
      };
      await db.ref(path).set(confirmed);
      return confirmed;
    } catch (error) {
      console.error('Blockchain anchoring failed:', error.code || error.name || 'unknown error');
      const failed = {
        ...pending,
        status: 'failed',
        error: safeErrorMessage(error),
        failed_at: now()
      };
      await db.ref(path).set(failed);
      return failed;
    }
  }

  // Validation happens before returning; the (slow) transaction continues in `done`.
  // Callers may await `done` (tests, scripts) or let it run in the background (API).
  async function startBatchRegistration(batchId) {
    const batch = await readBatch(batchId);
    if (!batch) throw new ServiceError('BATCH_NOT_FOUND', 'No batch found for that traceability ID.');

    const dataHash = hashPayload(batchRegistrationPayload(batch));
    return {
      recordKey: REGISTRATION_KEY,
      done: anchor({
        batchId,
        recordKey: REGISTRATION_KEY,
        recordType: RECORD_TYPES.BATCH_REGISTRATION,
        dataHash
      })
    };
  }

  // Anchors one fingerprint covering the batch's most recent readings (up to 1000).
  // The range is saved so verification can rebuild exactly the same set later.
  async function startReadingsDigest(batchId) {
    const batch = await readBatch(batchId);
    if (!batch) throw new ServiceError('BATCH_NOT_FOUND', 'No batch found for that traceability ID.');

    const entries = (await readReadingEntries(batchId)).slice(-MAX_DIGEST_READINGS);
    if (entries.length === 0) {
      throw new ServiceError('NO_READINGS', 'No environmental readings exist for this batch yet.');
    }

    const firstKey = entries[0][0];
    const lastKey = entries[entries.length - 1][0];
    const dataHash = hashPayload(readingsDigestPayload(entries.map(([, reading]) => reading)));

    return {
      recordKey: `readings-${lastKey}`,
      readingCount: entries.length,
      done: anchor({
        batchId,
        recordKey: `readings-${lastKey}`,
        recordType: RECORD_TYPES.READINGS_DIGEST,
        dataHash,
        meta: {
          first_reading_key: firstKey,
          last_reading_key: lastKey,
          reading_count: entries.length
        }
      })
    };
  }

  // Recompute the fingerprint from the database as it is NOW. Returns null if the
  // source data no longer exists.
  async function recomputeHash(batchId, record) {
    if (record.record_type_code === RECORD_TYPES.BATCH_REGISTRATION) {
      const batch = await readBatch(batchId);
      return batch ? hashPayload(batchRegistrationPayload(batch)) : null;
    }

    if (record.record_type_code === RECORD_TYPES.READINGS_DIGEST) {
      const { first_reading_key: first, last_reading_key: last } = record;
      if (!first || !last) return null;
      const inRange = (await readReadingEntries(batchId))
        .filter(([key]) => compareKeys(key, first) >= 0 && compareKeys(key, last) <= 0);
      if (inRange.length === 0) return null;
      return hashPayload(readingsDigestPayload(inRange.map(([, reading]) => reading)));
    }

    return null; // record types without a recompute rule cannot be verified yet
  }

  async function verifyRecord(batchId, recordKey, record) {
    const summary = {
      record_key: recordKey,
      record_type: record.record_type,
      status: record.status,
      data_hash: record.data_hash || null,
      tx_hash: record.tx_hash || null,
      block_number: record.block_number ?? null,
      anchored_at: record.anchored_at || null,
      reading_count: record.reading_count ?? null,
      explorer_url: record.tx_hash ? ledger.explorerUrl(record.tx_hash) : null
    };

    if (record.status !== 'confirmed') {
      return {
        ...summary,
        verification: record.status === 'failed' ? 'failed' : 'pending',
        error: record.error || null
      };
    }

    try {
      const recordId = recordIdFor(record.record_type_code, batchId, recordKey);
      const onChain = await ledger.getOnChain(recordId);
      if (!onChain.exists) {
        return { ...summary, verification: 'missing_on_chain' };
      }

      const currentHash = await recomputeHash(batchId, record);
      return {
        ...summary,
        onchain_hash: onChain.dataHash,
        onchain_timestamp: onChain.timestamp,
        current_hash: currentHash,
        verification: currentHash !== null && currentHash === onChain.dataHash ? 'verified' : 'tampered'
      };
    } catch (error) {
      console.error('Blockchain verification failed:', error.code || error.name || 'unknown error');
      return { ...summary, verification: 'unavailable', error: safeErrorMessage(error) };
    }
  }

  function summarize(records) {
    const states = records.map((record) => record.verification);
    if (states.some((s) => s === 'tampered' || s === 'missing_on_chain')) return 'tampered';
    if (states.length === 0) return 'not_anchored';
    if (states.some((s) => s === 'unavailable')) return 'unavailable';
    if (states.every((s) => s === 'verified')) return 'verified';
    if (states.some((s) => s === 'verified')) return 'partial';
    if (states.some((s) => s === 'pending')) return 'pending';
    return 'failed';
  }

  async function verifyBatch(batchId) {
    const stored = (await readValue(`BLOCKCHAIN_RECORD/${batchId}`)) || {};
    const records = [];
    const entries = Object.entries(stored)
      .sort(([, a], [, b]) => compareKeys(a.requested_at || '', b.requested_at || ''));
    for (const [recordKey, record] of entries) {
      records.push(await verifyRecord(batchId, recordKey, record));
    }
    return { ledger_enabled: true, overall: summarize(records), records };
  }

  return {
    startBatchRegistration,
    startReadingsDigest,
    anchorBatchRegistration: async (batchId) => (await startBatchRegistration(batchId)).done,
    anchorReadingsDigest: async (batchId) => (await startReadingsDigest(batchId)).done,
    verifyBatch
  };
}

// Result used by the API when blockchain support is not configured.
const LEDGER_DISABLED_VERIFICATION = Object.freeze({
  ledger_enabled: false,
  overall: 'unavailable',
  records: []
});

module.exports = {
  LEDGER_DISABLED_VERIFICATION,
  MAX_DIGEST_READINGS,
  REGISTRATION_KEY,
  ServiceError,
  createBlockchainService
};
