'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  CLOSE_AFTER_IN_RANGE,
  applyReading,
  checkValue,
  eventDurationMs,
  severityFor
} = require('./evaluator');

const BASE = Date.parse('2026-10-01T08:00:00.000Z');
const at = (n) => new Date(BASE + n * 10000).toISOString(); // one reading every 10 s
const PROFILE = {
  source: 'builtin',
  profile_key: 'default',
  thresholds: { temperature: { min: 2, max: 6 }, humidity: { min: 85, max: 95 } }
};

let readingNumber = 0;
const reading = (n, temperature, humidity = 90) => ({
  batch_id: 'BATCH-1',
  device_id: 'ESP32-1',
  reading_id: `READING-${++readingNumber}`,
  temperature,
  humidity,
  recorded_at: at(n)
});

// Plays readings through the evaluator the way the service does: persisted events from
// each step become the "open events" of the next. Returns the persisted event list.
function play(readings, profile = PROFILE) {
  const persisted = new Map();
  const resolvedEvents = [];
  for (const r of readings) {
    const openEvents = [...persisted.values()].filter((event) => event.status === 'open');
    const { changed, resolved } = applyReading({ openEvents, reading: r, profile, produceType: 'Avocados' });
    for (const event of changed) persisted.set(event.event_id, event);
    resolvedEvents.push(...resolved);
  }
  return { events: [...persisted.values()], resolved: resolvedEvents };
}

describe('checkValue / severityFor', () => {
  it('treats the limits themselves as in range', () => {
    const range = { min: 2, max: 6 };
    assert.equal(checkValue(6, range), null);
    assert.equal(checkValue(2, range), null);
    assert.deepEqual(checkValue(6.5, range), { direction: 'above', limit: 6, deviation: 0.5 });
    assert.deepEqual(checkValue(1.25, range), { direction: 'below', limit: 2, deviation: 0.75 });
  });

  it('is a warning up to the margin and critical beyond it', () => {
    assert.equal(severityFor('temperature', 2), 'warning');
    assert.equal(severityFor('temperature', 2.01), 'critical');
    assert.equal(severityFor('humidity', 5), 'warning');
    assert.equal(severityFor('humidity', 5.5), 'critical');
  });
});

describe('excursion state machine', () => {
  it('does nothing for in-range readings', () => {
    const { events } = play([reading(0, 4), reading(1, 6), reading(2, 2)]);
    assert.deepEqual(events, []);
  });

  it('opens one event at the first out-of-range reading', () => {
    const { events } = play([reading(0, 4), reading(1, 7.5)]);
    assert.equal(events.length, 1);
    const [event] = events;
    assert.equal(event.event_id, `EVENT-${BASE + 10000}-TA`);
    assert.equal(event.event_type, 'TEMPERATURE_EXCURSION');
    assert.equal(event.metric, 'temperature');
    assert.equal(event.direction, 'above');
    assert.equal(event.severity, 'warning');
    assert.equal(event.status, 'open');
    assert.equal(event.started_at, at(1));
    assert.equal(event.ended_at, null);
    assert.equal(event.threshold_min, 2);
    assert.equal(event.threshold_max, 6);
    assert.equal(event.peak_value, 7.5);
    assert.equal(event.reading_count, 1);
    assert.equal(event.produce_type, 'Avocados');
    assert.equal(event.acknowledged, false);
    assert.equal(event.profile_source, 'builtin');
  });

  it('keeps one event while the excursion continues and tracks the peak', () => {
    const { events } = play([reading(0, 7), reading(1, 9), reading(2, 8)]);
    assert.equal(events.length, 1);
    assert.equal(events[0].peak_value, 9);
    assert.equal(events[0].peak_at, at(1));
    assert.equal(events[0].peak_deviation, 3);
    assert.equal(events[0].reading_count, 3);
    assert.equal(events[0].last_reading_at, at(2));
  });

  it('escalates severity to critical and never back down', () => {
    const { events } = play([reading(0, 6.5), reading(1, 9), reading(2, 6.2)]);
    assert.equal(events[0].severity, 'critical');
  });

  it('stays a warning when the deviation never exceeds the margin', () => {
    const { events } = play([reading(0, 8), reading(1, 7)]);
    assert.equal(events[0].severity, 'warning');
  });

  it('resolves only after the required consecutive in-range readings', () => {
    assert.equal(CLOSE_AFTER_IN_RANGE, 2);
    const afterOne = play([reading(0, 8), reading(1, 5)]);
    assert.equal(afterOne.events[0].status, 'open');
    assert.equal(afterOne.events[0].in_range_streak, 1);
    assert.equal(afterOne.resolved.length, 0);

    const afterTwo = play([reading(0, 8), reading(1, 5), reading(2, 4.5)]);
    assert.equal(afterTwo.events[0].status, 'resolved');
    assert.equal(afterTwo.events[0].ended_at, at(1)); // first in-range reading of the recovery
    assert.equal(afterTwo.resolved.length, 1);
    assert.equal(afterTwo.resolved[0].event_id, afterTwo.events[0].event_id);
  });

  it('treats a brief dip back into range as the same excursion', () => {
    const { events, resolved } = play([reading(0, 8), reading(1, 5), reading(2, 8.5), reading(3, 9)]);
    assert.equal(events.length, 1);
    assert.equal(events[0].status, 'open');
    assert.equal(events[0].in_range_streak, 0);
    assert.equal(events[0].recovery_started_at, null);
    assert.equal(events[0].reading_count, 3);
    assert.equal(resolved.length, 0);
  });

  it('starts a new event after a resolved one', () => {
    const { events, resolved } = play([
      reading(0, 8), reading(1, 5), reading(2, 5),
      reading(10, 9), reading(11, 9.5)
    ]);
    assert.equal(events.length, 2);
    assert.deepEqual(events.map((event) => event.status).sort(), ['open', 'resolved']);
    assert.equal(resolved.length, 1);
    assert.notEqual(events[0].event_id, events[1].event_id);
  });

  it('closes the old event and opens a new one when the direction flips', () => {
    const { events, resolved } = play([reading(0, 8), reading(1, 1)]);
    assert.equal(events.length, 2);
    const above = events.find((event) => event.direction === 'above');
    const below = events.find((event) => event.direction === 'below');
    assert.equal(above.status, 'resolved');
    assert.equal(above.ended_at, at(1));
    assert.equal(below.status, 'open');
    assert.equal(below.event_id, `EVENT-${BASE + 10000}-TB`);
    assert.equal(resolved.length, 1);
  });

  it('keeps temperature and humidity events independent', () => {
    // r0: both out of range. r1: only temperature still out. r2: both back in range.
    const { events, resolved } = play([reading(0, 8, 70), reading(1, 8, 90), reading(2, 5, 90)]);
    const temperature = events.find((event) => event.metric === 'temperature');
    const humidity = events.find((event) => event.metric === 'humidity');

    assert.equal(humidity.event_type, 'HUMIDITY_EXCURSION');
    assert.equal(humidity.direction, 'below');
    assert.equal(humidity.status, 'resolved'); // in range at r1 and r2
    assert.equal(humidity.ended_at, at(1));

    assert.equal(temperature.status, 'open'); // in range only at r2 so far
    assert.equal(temperature.in_range_streak, 1);
    assert.deepEqual(resolved.map((event) => event.metric), ['humidity']);
  });

  it('judges each metric against its own range and unit', () => {
    const { events } = play([reading(0, 4, 97)]);
    assert.equal(events.length, 1);
    assert.equal(events[0].metric, 'humidity');
    assert.equal(events[0].unit, '%');
    assert.equal(events[0].direction, 'above');
  });

  it('uses the limits of the supplied profile', () => {
    const avocado = {
      source: 'produce',
      profile_key: 'avocados',
      thresholds: { temperature: { min: 5, max: 13 }, humidity: { min: 85, max: 95 } }
    };
    assert.equal(play([reading(0, 4)], avocado).events[0].direction, 'below');
    assert.equal(play([reading(0, 10)], avocado).events.length, 0);
    assert.equal(play([reading(0, 4)], avocado).events[0].profile_key, 'avocados');
  });

  it('ignores unusable readings', () => {
    const bad = [
      { ...reading(0, 9), recorded_at: 'not a date' },
      { ...reading(1, 9), batch_id: undefined },
      { ...reading(2, NaN, NaN) },
      { ...reading(3, '9', '70') },
      null
    ];
    assert.deepEqual(play(bad).events, []);
  });

  it('does not modify the objects it is given', () => {
    const open = play([reading(0, 8)]).events;
    const snapshot = structuredClone(open);
    applyReading({ openEvents: open, reading: reading(1, 9), profile: PROFILE });
    assert.deepEqual(open, snapshot);
  });
});

describe('eventDurationMs', () => {
  it('measures resolved events to their end and open events to the last reading', () => {
    const { events } = play([reading(0, 8), reading(1, 8), reading(2, 5), reading(3, 5)]);
    assert.equal(eventDurationMs(events[0]), 20000); // 0 s -> first in-range reading at 20 s
    const open = play([reading(0, 8), reading(1, 8)]).events[0];
    assert.equal(eventDurationMs(open), 10000);
    assert.equal(eventDurationMs({ started_at: 'x' }), null);
  });
});
