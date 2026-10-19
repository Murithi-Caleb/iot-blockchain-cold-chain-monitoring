'use strict';

// Buyer compliance decisions: after a batch arrives, an authorized traceability user (the
// buyer or inspector) either ACCEPTS it with a certificate of compliance or REJECTS it
// with a reason. The decision is final and is anchored on the blockchain like every other
// record.
//
// Database layout (written by this backend only):
//   COMPLIANCE_DECISION/{batchId}   exactly one decision per batch
//
// The decision commits to the evidence it was based on: a fingerprint of all recorded
// readings and of all cold-chain events at that moment. Raw readings stay off-chain.

const { ServiceError } = require('../serviceError');
const {
  coldChainEventPayload,
  hashPayload,
  readingsDigestPayload
} = require('../blockchain/canonical');
const { resolveProfile } = require('../coldchain/profiles');

const DECISIONS = Object.freeze(['accepted', 'rejected']);
const MAX_NOTE_LENGTH = 280;
const compareKeys = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// `blockchain` is optional. Without it decisions are still stored, but the integrity check
// is skipped and nothing is anchored.
function createComplianceService({ db, blockchain = null, now = () => new Date().toISOString() }) {
  if (!db) throw new Error('createComplianceService requires a database.');

  // One decision per batch, so decisions for the same batch run one at a time. This stops
  // a double click from racing two decisions past the "already decided" check.
  const queues = new Map();
  function withBatchLock(batchId, task) {
    const previous = queues.get(batchId) || Promise.resolve();
    const run = previous.then(task, task);
    const tail = run.catch(() => {});
    queues.set(batchId, tail);
    tail.then(() => {
      if (queues.get(batchId) === tail) queues.delete(batchId);
    });
    return run;
  }

  const readValue = async (path) => (await db.ref(path).once('value')).val();

  async function gatherEvidence(batchId) {
    const batch = await readValue(`PRODUCE_BATCH/${batchId}`);
    if (!batch) throw new ServiceError('BATCH_NOT_FOUND', 'No batch found for that traceability ID.');

    const readings = Object.entries((await readValue(`ENVIRONMENTAL_READING/${batchId}`)) || {})
      .sort(([a], [b]) => compareKeys(a, b))
      .map(([, reading]) => reading);
    const events = Object.values((await readValue(`COLD_CHAIN_EVENT/${batchId}`)) || {})
      .sort((a, b) => compareKeys(a.event_id, b.event_id));
    const profile = resolveProfile(batch, (await readValue('THRESHOLD_PROFILE')) || {});
    return { batch, readings, events, profile };
  }

  // The conditions a batch must meet before it can be accepted. Each check is
  // { id, label, status: 'passed' | 'failed' | 'skipped', detail }.
  async function evaluateChecks(batchId, { readings, events }) {
    const open = events.filter((event) => event.status === 'open');
    const unacknowledgedCritical = events.filter((e) => e.severity === 'critical' && !e.acknowledged);
    const check = (id, label, passed, detail) => ({ id, label, status: passed ? 'passed' : 'failed', detail });

    const checks = [
      check(
        'readings_recorded',
        'Sensor readings recorded',
        readings.length > 0,
        readings.length > 0 ? `${plural(readings.length, 'reading')} recorded.` : 'No sensor readings exist for this batch, so conditions cannot be shown.'
      ),
      check(
        'no_open_excursions',
        'No ongoing excursions',
        open.length === 0,
        open.length === 0 ? 'No excursion is in progress.' : `${plural(open.length, 'excursion')} still in progress.`
      ),
      check(
        'critical_acknowledged',
        'Critical excursions acknowledged',
        unacknowledgedCritical.length === 0,
        unacknowledgedCritical.length === 0
          ? 'Every critical excursion has been acknowledged (or none occurred).'
          : `${plural(unacknowledgedCritical.length, 'critical excursion')} not yet acknowledged by an operator.`
      )
    ];

    if (!blockchain) {
      checks.push({
        id: 'integrity',
        label: 'Blockchain integrity verified',
        status: 'skipped',
        detail: 'The blockchain ledger is not enabled on this server, so integrity was not checked.'
      });
      return checks;
    }

    let verification;
    try {
      verification = await blockchain.verifyBatch(batchId);
    } catch {
      verification = { overall: 'unavailable', records: [] };
    }
    const records = verification.records || [];
    const registrationVerified = records.some(
      (record) => record.record_type === 'BATCH_REGISTRATION' && record.verification === 'verified'
    );
    const verifiedEvents = new Set(
      records.filter((r) => r.record_type === 'COLD_CHAIN_EVENT' && r.verification === 'verified').map((r) => r.event_id)
    );
    const unanchored = events.filter((e) => e.status === 'resolved' && !verifiedEvents.has(e.event_id));

    let integrityDetail = 'Batch registration and all anchored records match the blockchain.';
    if (verification.overall === 'tampered') integrityDetail = 'Tampering detected: a stored record no longer matches the blockchain.';
    else if (verification.overall === 'unavailable') integrityDetail = 'The blockchain could not be reached; try again shortly.';
    else if (!registrationVerified) integrityDetail = 'The batch registration is not verified on the blockchain yet.';
    else if (verification.overall !== 'verified') integrityDetail = `Some blockchain records are not verified yet (status: ${verification.overall}).`;

    checks.push(
      check('integrity', 'Blockchain integrity verified', verification.overall === 'verified' && registrationVerified, integrityDetail),
      check(
        'events_anchored',
        'Cold-chain events anchored',
        unanchored.length === 0,
        unanchored.length === 0 ? 'Every resolved excursion is anchored and verified.' : `${plural(unanchored.length, 'resolved excursion')} not anchored and verified yet.`
      )
    );
    return checks;
  }

  const isEligible = (checks) => checks.every((item) => item.status !== 'failed');

  // Current decision for a batch, or (when none exists yet) the eligibility checks the
  // buyer should look at before deciding.
  async function getCompliance(batchId) {
    const decision = await readValue(`COMPLIANCE_DECISION/${batchId}`);
    if (decision) return { decision, eligibility: null };

    const evidence = await gatherEvidence(batchId);
    const checks = await evaluateChecks(batchId, evidence);
    return {
      decision: null,
      eligibility: {
        eligible: isEligible(checks),
        checks,
        summary: {
          reading_count: evidence.readings.length,
          event_count: evidence.events.length,
          critical_event_count: evidence.events.filter((event) => event.severity === 'critical').length
        }
      }
    };
  }

  // Records the buyer's final decision. Acceptance requires every check to pass; rejection
  // is always allowed but needs a reason.
  async function decide(batchId, actor, { decision, note } = {}) {
    if (!DECISIONS.includes(decision)) {
      throw new ServiceError('INVALID_INPUT', `decision must be one of: ${DECISIONS.join(', ')}.`);
    }
    if (note !== undefined && note !== null && typeof note !== 'string') {
      throw new ServiceError('INVALID_INPUT', 'note must be text.');
    }
    const cleanNote = typeof note === 'string' ? note.trim() : '';
    if (cleanNote.length > MAX_NOTE_LENGTH) {
      throw new ServiceError('INVALID_INPUT', `note must be at most ${MAX_NOTE_LENGTH} characters.`);
    }
    if (decision === 'rejected' && !cleanNote) {
      throw new ServiceError('INVALID_INPUT', 'Give a reason when rejecting a batch.');
    }

    return withBatchLock(batchId, async () => {
      const path = `COMPLIANCE_DECISION/${batchId}`;
      if (await readValue(path)) {
        throw new ServiceError('DECISION_EXISTS', 'A decision has already been recorded for this batch and cannot be changed.');
      }

      const evidence = await gatherEvidence(batchId);
      const checks = await evaluateChecks(batchId, evidence);
      const eligible = isEligible(checks);
      if (decision === 'accepted' && !eligible) {
        throw new ServiceError('NOT_ELIGIBLE', 'This batch does not meet the conditions for a certificate of compliance.', { checks });
      }

      const { thresholds } = evidence.profile;
      const record = {
        decision_id: `DECISION-${batchId}`,
        batch_id: batchId,
        decision,
        ...(cleanNote ? { note: cleanNote } : {}),
        decided_by: actor.email || actor.uid || 'unknown',
        decided_uid: actor.uid || null,
        decided_at: now(),
        produce_type: evidence.batch.produce_type,
        profile_key: evidence.profile.profile_key,
        profile_source: evidence.profile.source,
        threshold_temperature_min: thresholds.temperature.min,
        threshold_temperature_max: thresholds.temperature.max,
        threshold_humidity_min: thresholds.humidity.min,
        threshold_humidity_max: thresholds.humidity.max,
        reading_count: evidence.readings.length,
        readings_digest: hashPayload(readingsDigestPayload(evidence.readings)),
        event_count: evidence.events.length,
        critical_event_count: evidence.events.filter((event) => event.severity === 'critical').length,
        events_digest: hashPayload(evidence.events.map(coldChainEventPayload)),
        conditions_met: eligible
      };
      await db.ref(path).set(record);
      return record;
    });
  }

  return { DECISIONS, decide, getCompliance };
}

module.exports = { DECISIONS, MAX_NOTE_LENGTH, createComplianceService };
