'use strict';

// Excursion detection: a pure state machine (no database, no clock) so every rule can be
// unit-tested.
//
// An EXCURSION is a continuous period in which one metric (temperature or humidity)
// stays outside its acceptable range in one direction. Each excursion is one cold-chain
// EVENT:
//
//   reading out of range, no open event      -> open a new event
//   reading out of range, same direction     -> update the open event (peak, count, severity)
//   reading out of range, opposite direction -> close the open event, open a new one
//   reading back in range                    -> count it; after CLOSE_AFTER_IN_RANGE
//                                               consecutive in-range readings the event is
//                                               RESOLVED (this stops sensor noise at the
//                                               limit from creating a flurry of events)
//
// Event times: started_at is the first out-of-range reading; ended_at is the first
// in-range reading of the recovery that closed it.

const METRICS = Object.freeze({
  temperature: Object.freeze({ code: 'T', unit: '°C', label: 'Temperature', criticalMargin: 2 }),
  humidity: Object.freeze({ code: 'H', unit: '%', label: 'Humidity', criticalMargin: 5 })
});

const EVENT_TYPES = Object.freeze({
  temperature: 'TEMPERATURE_EXCURSION',
  humidity: 'HUMIDITY_EXCURSION'
});

// Consecutive in-range readings needed to resolve an event.
const CLOSE_AFTER_IN_RANGE = 2;

const round = (number) => Math.round(number * 1000) / 1000;

// Returns null when the value is inside [min, max], otherwise how it is out of range.
function checkValue(value, range) {
  if (value > range.max) return { direction: 'above', limit: range.max, deviation: round(value - range.max) };
  if (value < range.min) return { direction: 'below', limit: range.min, deviation: round(range.min - value) };
  return null;
}

// "warning" while the deviation from the limit is within the margin, "critical" beyond it.
function severityFor(metric, deviation) {
  return deviation > METRICS[metric].criticalMargin ? 'critical' : 'warning';
}

function isValidReading(reading) {
  return Boolean(reading)
    && typeof reading.batch_id === 'string'
    && Number.isFinite(Date.parse(reading.recorded_at));
}

function openEvent({ metric, breach, reading, profile, produceType }) {
  const { code, unit } = METRICS[metric];
  const range = profile.thresholds[metric];
  return {
    // e.g. EVENT-1790981450938-TA = temperature, above range. The direction letter keeps IDs
    // unique even if two excursions begin in the same millisecond.
    event_id: `EVENT-${Date.parse(reading.recorded_at)}-${code}${breach.direction === 'above' ? 'A' : 'B'}`,
    batch_id: reading.batch_id,
    produce_type: produceType || null,
    event_type: EVENT_TYPES[metric],
    metric,
    direction: breach.direction,
    severity: severityFor(metric, breach.deviation),
    status: 'open',
    started_at: reading.recorded_at,
    ended_at: null,
    device_id: reading.device_id || null,
    start_reading_id: reading.reading_id || null,
    // Limits in force when the event opened (later profile changes do not rewrite history).
    threshold_min: range.min,
    threshold_max: range.max,
    unit,
    profile_key: profile.profile_key,
    profile_source: profile.source,
    peak_value: reading[metric],
    peak_at: reading.recorded_at,
    peak_deviation: breach.deviation,
    reading_count: 1,
    last_reading_at: reading.recorded_at,
    in_range_streak: 0,
    recovery_started_at: null,
    acknowledged: false
  };
}

function extendEvent(event, { metric, breach, reading }) {
  const value = reading[metric];
  const moreExtreme = breach.deviation > (event.peak_deviation || 0);
  const peak_deviation = moreExtreme ? breach.deviation : event.peak_deviation;
  return {
    ...event,
    severity: severityFor(metric, peak_deviation) === 'critical' || event.severity === 'critical'
      ? 'critical'
      : 'warning', // severity only ever escalates
    peak_value: moreExtreme ? value : event.peak_value,
    peak_at: moreExtreme ? reading.recorded_at : event.peak_at,
    peak_deviation,
    reading_count: (event.reading_count || 0) + 1,
    last_reading_at: reading.recorded_at,
    in_range_streak: 0,
    recovery_started_at: null
  };
}

function closeEvent(event, endedAt) {
  return { ...event, status: 'resolved', ended_at: endedAt, in_range_streak: 0, recovery_started_at: null };
}

// Applies one sensor reading to the currently open events of its batch.
//
//   openEvents: events with status "open" for this batch (at most one per metric)
//   reading:    { batch_id, device_id, reading_id, temperature, humidity, recorded_at }
//   profile:    result of resolveProfile(): { thresholds, profile_key, source }
//
// Returns { changed, resolved }: `changed` is every event that must be (re)written to the
// database (created, updated or resolved); `resolved` is the subset that just closed.
function applyReading({ openEvents = [], reading, profile, produceType = null }) {
  const changed = new Map();
  const resolved = [];
  if (!isValidReading(reading)) return { changed: [], resolved };

  for (const metric of Object.keys(METRICS)) {
    const value = reading[metric];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;

    const breach = checkValue(value, profile.thresholds[metric]);
    const open = openEvents.find((event) => event.metric === metric && event.status === 'open');

    if (!breach) {
      if (!open) continue;
      const streak = (open.in_range_streak || 0) + 1;
      const recoveryStart = open.recovery_started_at || reading.recorded_at;
      if (streak >= CLOSE_AFTER_IN_RANGE) {
        const closed = closeEvent(open, recoveryStart);
        changed.set(closed.event_id, closed);
        resolved.push(closed);
      } else {
        changed.set(open.event_id, { ...open, in_range_streak: streak, recovery_started_at: recoveryStart });
      }
      continue;
    }

    if (open && open.direction === breach.direction) {
      const extended = extendEvent(open, { metric, breach, reading });
      changed.set(extended.event_id, extended);
      continue;
    }

    if (open) {
      // The excursion flipped direction (for example from too warm to too cold): the old
      // one ends now and a new one begins with this reading.
      const closed = closeEvent(open, reading.recorded_at);
      changed.set(closed.event_id, closed);
      resolved.push(closed);
    }
    const created = openEvent({ metric, breach, reading, profile, produceType });
    changed.set(created.event_id, created);
  }

  return { changed: [...changed.values()], resolved };
}

// Duration of an event in milliseconds, or null if it cannot be computed.
// For an open event the duration runs up to its last out-of-range reading.
function eventDurationMs(event) {
  const start = Date.parse(event.started_at);
  const end = Date.parse(event.ended_at || event.last_reading_at);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : null;
}

module.exports = {
  CLOSE_AFTER_IN_RANGE,
  EVENT_TYPES,
  METRICS,
  applyReading,
  checkValue,
  eventDurationMs,
  severityFor
};
