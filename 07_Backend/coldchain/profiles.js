'use strict';

// Threshold profiles: the acceptable temperature/humidity range for a kind of produce.
//
// Stored in Firebase under THRESHOLD_PROFILE/{profileKey}. A batch uses the profile whose
// key equals the slug of its produce type ("Avocados" -> "avocados"). If there is none,
// the stored "default" profile applies, and if that is missing too, the built-in default.
//
// IMPORTANT: no produce-specific ranges are shipped with the system. An administrator
// enters them (ideally from a cited source such as export standards or the literature
// review). The built-in default below is only a placeholder starting point.

const DEFAULT_KEY = 'default';

const DEFAULT_PROFILE = Object.freeze({
  temperature: Object.freeze({ min: 2, max: 6 }),
  humidity: Object.freeze({ min: 85, max: 95 })
});

// Sanity bounds for what an administrator may enter.
const BOUNDS = Object.freeze({
  temperature: Object.freeze({ floor: -30, ceiling: 50, unit: '°C' }),
  humidity: Object.freeze({ floor: 0, ceiling: 100, unit: '%' })
});

const MAX_KEY_LENGTH = 40;
const MAX_NAME_LENGTH = 60;

// "French beans" -> "french-beans". The frontend has an identical copy
// (08_Frontend/src/lib/thresholds.js); keep the two in sync.
function profileKeyFor(produceType) {
  if (typeof produceType !== 'string') return null;
  const key = produceType
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_KEY_LENGTH)
    .replace(/-+$/, '');
  return key || null;
}

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

// Validates the body of PUT /api/thresholds/:profileKey.
// Returns { value } on success or { error } with a message safe to show the user.
function validateProfileInput(profileKey, body) {
  const allowed = ['produce_type', 'temperature_min', 'temperature_max', 'humidity_min', 'humidity_max'];
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object.' };
  }
  if (Object.keys(body).some((field) => !allowed.includes(field))) {
    return { error: `Only these fields are allowed: ${allowed.join(', ')}.` };
  }

  let produceType = null;
  if (profileKey === DEFAULT_KEY) {
    if (body.produce_type !== undefined && body.produce_type !== null) {
      return { error: 'The default profile has no produce type.' };
    }
  } else {
    if (typeof body.produce_type !== 'string' || !body.produce_type.trim()) {
      return { error: 'produce_type is required for a produce profile.' };
    }
    produceType = body.produce_type.trim();
    if (produceType.length > MAX_NAME_LENGTH) {
      return { error: `produce_type must be at most ${MAX_NAME_LENGTH} characters.` };
    }
    const derived = profileKeyFor(produceType);
    if (!derived || derived === DEFAULT_KEY) {
      return { error: 'That produce name is not allowed. Use letters or numbers and avoid the name "default".' };
    }
    if (derived !== profileKeyFor(profileKey)) {
      return { error: 'The profile key does not match the produce type.' };
    }
  }

  const value = { produce_type: produceType, temperature: {}, humidity: {} };
  for (const metric of ['temperature', 'humidity']) {
    const { floor, ceiling, unit } = BOUNDS[metric];
    for (const bound of ['min', 'max']) {
      const number = body[`${metric}_${bound}`];
      if (!isFiniteNumber(number)) {
        return { error: `${metric}_${bound} must be a number.` };
      }
      if (number < floor || number > ceiling) {
        return { error: `${metric}_${bound} must be between ${floor} and ${ceiling} ${unit}.` };
      }
      value[metric][bound] = Math.round(number * 100) / 100;
    }
    if (value[metric].min >= value[metric].max) {
      return { error: `${metric}_min must be lower than ${metric}_max.` };
    }
  }

  return { value };
}

// Chooses the profile that applies to a batch.
// `stored` is the THRESHOLD_PROFILE node (or null). Returns
//   { source: 'produce' | 'default' | 'builtin', profile_key, label,
//     thresholds: { temperature: {min,max}, humidity: {min,max} } }
function resolveProfile(batch, stored) {
  const profiles = stored || {};
  const key = profileKeyFor(batch && batch.produce_type);

  const pick = (record) => ({
    temperature: { min: record.temperature.min, max: record.temperature.max },
    humidity: { min: record.humidity.min, max: record.humidity.max }
  });

  if (key && key !== DEFAULT_KEY && profiles[key]) {
    return {
      source: 'produce',
      profile_key: key,
      label: profiles[key].produce_type || key,
      thresholds: pick(profiles[key])
    };
  }
  if (profiles[DEFAULT_KEY]) {
    return { source: 'default', profile_key: DEFAULT_KEY, label: 'Default', thresholds: pick(profiles[DEFAULT_KEY]) };
  }
  return { source: 'builtin', profile_key: DEFAULT_KEY, label: 'Built-in default', thresholds: pick(DEFAULT_PROFILE) };
}

module.exports = {
  BOUNDS,
  DEFAULT_KEY,
  DEFAULT_PROFILE,
  profileKeyFor,
  resolveProfile,
  validateProfileInput
};
