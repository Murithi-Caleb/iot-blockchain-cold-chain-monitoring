'use strict';

// Cold-chain monitoring service: threshold profiles, excursion events and alerts.
//
// Firebase Realtime Database layout (all written by this backend only):
//   THRESHOLD_PROFILE/{profileKey}           acceptable ranges per produce type ("default" too)
//   COLD_CHAIN_EVENT/{batchId}/{eventId}     one record per excursion (see evaluator.js)
//
// Raw readings stay in ENVIRONMENTAL_READING; events summarise the problems found in them.
// Resolved events can then be anchored on the blockchain (see blockchain/service.js).

const { ServiceError } = require('../serviceError');
const {
  DEFAULT_KEY,
  DEFAULT_PROFILE,
  resolveProfile,
  validateProfileInput
} = require('./profiles');
const { applyReading } = require('./evaluator');

const EVENT_STATUS_FILTERS = Object.freeze(['all', 'open', 'resolved', 'unacknowledged', 'attention']);
const MAX_EVENTS_LISTED = 200;
const MAX_NOTE_LENGTH = 280;

const byStartedDesc = (a, b) => String(b.started_at).localeCompare(String(a.started_at));

function createColdChainService({ db, now = () => new Date().toISOString() }) {
  if (!db) throw new Error('createColdChainService requires a database.');

  // One queue per batch. Readings, acknowledgements and anything else that rewrites a
  // batch's events run one at a time, so two readings arriving together cannot both
  // decide "no event is open" and create duplicates.
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
  const readProfiles = async () => (await readValue('THRESHOLD_PROFILE')) || {};

  const publicProfile = (key, record) => ({
    profile_key: key,
    produce_type: record.produce_type || null,
    temperature: { min: record.temperature.min, max: record.temperature.max },
    humidity: { min: record.humidity.min, max: record.humidity.max },
    updated_at: record.updated_at || null,
    updated_by: record.updated_by || null,
    is_builtin: false
  });

  // ---- Threshold profiles -------------------------------------------------

  async function getThresholds() {
    const stored = await readProfiles();
    const defaultProfile = stored[DEFAULT_KEY]
      ? publicProfile(DEFAULT_KEY, stored[DEFAULT_KEY])
      : {
        profile_key: DEFAULT_KEY,
        produce_type: null,
        temperature: { ...DEFAULT_PROFILE.temperature },
        humidity: { ...DEFAULT_PROFILE.humidity },
        updated_at: null,
        updated_by: null,
        is_builtin: true
      };

    const profiles = Object.entries(stored)
      .filter(([key]) => key !== DEFAULT_KEY)
      .map(([key, record]) => publicProfile(key, record))
      .sort((a, b) => String(a.produce_type).localeCompare(String(b.produce_type)));

    return { default: defaultProfile, profiles };
  }

  async function saveProfile(profileKey, body, actor) {
    const { value, error } = validateProfileInput(profileKey, body);
    if (error) throw new ServiceError('INVALID_INPUT', error);

    const record = {
      profile_key: profileKey,
      ...(value.produce_type ? { produce_type: value.produce_type } : {}),
      temperature: value.temperature,
      humidity: value.humidity,
      updated_at: now(),
      updated_by: actor && (actor.email || actor.uid) ? actor.email || actor.uid : 'unknown'
    };
    await db.ref(`THRESHOLD_PROFILE/${profileKey}`).set(record);
    return publicProfile(profileKey, record);
  }

  async function deleteProfile(profileKey) {
    const existing = await readValue(`THRESHOLD_PROFILE/${profileKey}`);
    if (!existing) throw new ServiceError('PROFILE_NOT_FOUND', 'No such threshold profile.');
    await db.ref(`THRESHOLD_PROFILE/${profileKey}`).remove();
  }

  // The profile that applies to one batch, plus where it came from.
  async function getBatchThresholds(batchId) {
    const batch = await readValue(`PRODUCE_BATCH/${batchId}`);
    if (!batch) throw new ServiceError('BATCH_NOT_FOUND', 'No batch found for that traceability ID.');
    const info = resolveProfile(batch, await readProfiles());
    return {
      source: info.source,
      profile_key: info.profile_key,
      label: info.label,
      produce_type: batch.produce_type,
      temperature: info.thresholds.temperature,
      humidity: info.thresholds.humidity
    };
  }

  // ---- Excursion detection ------------------------------------------------

  // Evaluates one stored sensor reading. Called in the background after ingestion, so a
  // failure here can never lose or reject a reading. Readings for batches that are not
  // registered are skipped (there is no produce type to choose limits for).
  function evaluateReading(reading) {
    const batchId = reading && reading.batch_id;
    if (typeof batchId !== 'string') return Promise.resolve({ skipped: 'invalid_reading', changed: [], resolved: [] });

    return withBatchLock(batchId, async () => {
      const batch = await readValue(`PRODUCE_BATCH/${batchId}`);
      if (!batch) return { skipped: 'unknown_batch', changed: [], resolved: [] };

      const profile = resolveProfile(batch, await readProfiles());
      const stored = (await readValue(`COLD_CHAIN_EVENT/${batchId}`)) || {};
      const openEvents = Object.values(stored).filter((event) => event.status === 'open');

      const { changed, resolved } = applyReading({
        openEvents,
        reading,
        profile,
        produceType: batch.produce_type
      });
      for (const event of changed) {
        await db.ref(`COLD_CHAIN_EVENT/${batchId}/${event.event_id}`).set(event);
      }
      return { changed, resolved };
    });
  }

  // ---- Reading events -----------------------------------------------------

  async function listBatchEvents(batchId) {
    return Object.values((await readValue(`COLD_CHAIN_EVENT/${batchId}`)) || {}).sort(byStartedDesc);
  }

  // Events across all batches, newest first. Reads the whole COLD_CHAIN_EVENT node, which
  // is fine at prototype scale (a few thousand events); at larger scale an index would be
  // needed.
  async function listEvents({ status = 'all', limit = 100 } = {}) {
    if (!EVENT_STATUS_FILTERS.includes(status)) {
      throw new ServiceError('INVALID_INPUT', `status must be one of: ${EVENT_STATUS_FILTERS.join(', ')}.`);
    }
    const all = Object.values((await readValue('COLD_CHAIN_EVENT')) || {}).flatMap((perBatch) => Object.values(perBatch));
    const matches = {
      all: () => true,
      open: (event) => event.status === 'open',
      resolved: (event) => event.status === 'resolved',
      unacknowledged: (event) => !event.acknowledged,
      attention: (event) => event.status === 'open' || !event.acknowledged
    }[status];

    const capped = Math.min(Math.max(Number(limit) || 100, 1), MAX_EVENTS_LISTED);
    return all.filter(matches).sort(byStartedDesc).slice(0, capped);
  }

  // Records that a person has seen and taken responsibility for an alert. Allowed while the
  // event is still open. Acknowledging twice keeps the first acknowledgement.
  function acknowledge(batchId, eventId, actor, note) {
    return withBatchLock(batchId, async () => {
      let cleanNote = null;
      if (note !== undefined && note !== null) {
        if (typeof note !== 'string') throw new ServiceError('INVALID_INPUT', 'note must be text.');
        cleanNote = note.trim() || null;
        if (cleanNote && cleanNote.length > MAX_NOTE_LENGTH) {
          throw new ServiceError('INVALID_INPUT', `note must be at most ${MAX_NOTE_LENGTH} characters.`);
        }
      }

      const path = `COLD_CHAIN_EVENT/${batchId}/${eventId}`;
      const event = await readValue(path);
      if (!event) throw new ServiceError('EVENT_NOT_FOUND', 'No such cold-chain event.');
      if (event.acknowledged) return { event, alreadyAcknowledged: true };

      const updated = {
        ...event,
        acknowledged: true,
        acknowledged_by: actor.email || actor.uid || 'unknown',
        acknowledged_uid: actor.uid || null,
        acknowledged_at: now(),
        ...(cleanNote ? { acknowledgement_note: cleanNote } : {})
      };
      await db.ref(path).set(updated);
      return { event: updated, alreadyAcknowledged: false };
    });
  }

  return {
    acknowledge,
    deleteProfile,
    evaluateReading,
    getBatchThresholds,
    getThresholds,
    listBatchEvents,
    listEvents,
    saveProfile
  };
}

module.exports = { EVENT_STATUS_FILTERS, MAX_EVENTS_LISTED, createColdChainService };
