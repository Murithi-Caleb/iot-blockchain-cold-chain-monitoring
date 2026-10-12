'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_PROFILE,
  profileKeyFor,
  resolveProfile,
  validateProfileInput
} = require('./profiles');

const valid = (extra = {}) => ({
  produce_type: 'Avocados',
  temperature_min: 5,
  temperature_max: 7,
  humidity_min: 85,
  humidity_max: 90,
  ...extra
});

describe('profileKeyFor', () => {
  it('turns produce names into stable slugs', () => {
    assert.equal(profileKeyFor('Avocados'), 'avocados');
    assert.equal(profileKeyFor('  French   Beans '), 'french-beans');
    assert.equal(profileKeyFor("Murang'a Mangoes"), 'murang-a-mangoes');
    assert.equal(profileKeyFor('Café'), 'cafe');
    assert.equal(profileKeyFor('Snow-peas'), 'snow-peas');
  });

  it('returns null when nothing usable remains', () => {
    for (const input of ['', '   ', '!!!', null, undefined, 42, {}]) {
      assert.equal(profileKeyFor(input), null, String(input));
    }
  });

  it('caps the length without leaving a trailing dash', () => {
    const key = profileKeyFor(`${'a'.repeat(39)} bbbbbbbb`);
    assert.ok(key.length <= 40);
    assert.ok(!key.endsWith('-'));
  });

  it('is idempotent, so a key maps to itself', () => {
    for (const name of ['French beans', "Murang'a Mangoes", 'Café']) {
      const key = profileKeyFor(name);
      assert.equal(profileKeyFor(key), key);
    }
  });
});

describe('validateProfileInput', () => {
  it('accepts a complete produce profile and rounds to 2 decimals', () => {
    const { value, error } = validateProfileInput('avocados', valid({ temperature_min: 5.123, humidity_max: 90.999 }));
    assert.equal(error, undefined);
    assert.deepEqual(value, {
      produce_type: 'Avocados',
      temperature: { min: 5.12, max: 7 },
      humidity: { min: 85, max: 91 }
    });
  });

  it('accepts the default profile without a produce type', () => {
    const { value, error } = validateProfileInput('default', valid({ produce_type: undefined }));
    assert.equal(error, undefined);
    assert.equal(value.produce_type, null);
  });

  it('rejects a produce type on the default profile', () => {
    assert.match(validateProfileInput('default', valid()).error, /no produce type/);
  });

  it('requires a produce type that matches the key', () => {
    assert.match(validateProfileInput('avocados', valid({ produce_type: undefined })).error, /required/);
    assert.match(validateProfileInput('avocados', valid({ produce_type: '  ' })).error, /required/);
    assert.match(validateProfileInput('mangoes', valid()).error, /does not match/);
    assert.match(validateProfileInput('default', valid()).error, /no produce type/);
    assert.match(validateProfileInput('x', valid({ produce_type: 'default' })).error, /not allowed/);
  });

  it('rejects unknown fields, non-objects and non-numbers', () => {
    assert.match(validateProfileInput('avocados', { ...valid(), extra: 1 }).error, /allowed/);
    assert.match(validateProfileInput('avocados', null).error, /JSON object/);
    assert.match(validateProfileInput('avocados', [1]).error, /JSON object/);
    assert.match(validateProfileInput('avocados', valid({ temperature_min: '5' })).error, /temperature_min must be a number/);
    assert.match(validateProfileInput('avocados', valid({ humidity_max: NaN })).error, /humidity_max must be a number/);
    assert.match(validateProfileInput('avocados', valid({ humidity_max: undefined })).error, /humidity_max must be a number/);
  });

  it('enforces sane bounds and min < max', () => {
    assert.match(validateProfileInput('avocados', valid({ temperature_min: -31 })).error, /between -30 and 50/);
    assert.match(validateProfileInput('avocados', valid({ temperature_max: 51 })).error, /between -30 and 50/);
    assert.match(validateProfileInput('avocados', valid({ humidity_min: -1 })).error, /between 0 and 100/);
    assert.match(validateProfileInput('avocados', valid({ humidity_max: 101 })).error, /between 0 and 100/);
    assert.match(validateProfileInput('avocados', valid({ temperature_min: 7, temperature_max: 7 })).error, /lower than/);
    assert.match(validateProfileInput('avocados', valid({ humidity_min: 95, humidity_max: 90 })).error, /lower than/);
  });
});

describe('resolveProfile', () => {
  const stored = {
    avocados: { produce_type: 'Avocados', temperature: { min: 5, max: 7 }, humidity: { min: 85, max: 90 } },
    default: { temperature: { min: 1, max: 4 }, humidity: { min: 80, max: 90 } }
  };

  it('prefers the produce profile', () => {
    const result = resolveProfile({ produce_type: ' avocados ' }, stored);
    assert.equal(result.source, 'produce');
    assert.equal(result.profile_key, 'avocados');
    assert.equal(result.label, 'Avocados');
    assert.deepEqual(result.thresholds.temperature, { min: 5, max: 7 });
  });

  it('falls back to the stored default, then the built-in default', () => {
    const viaDefault = resolveProfile({ produce_type: 'Mangoes' }, stored);
    assert.equal(viaDefault.source, 'default');
    assert.deepEqual(viaDefault.thresholds.temperature, { min: 1, max: 4 });

    const builtin = resolveProfile({ produce_type: 'Mangoes' }, null);
    assert.equal(builtin.source, 'builtin');
    assert.deepEqual(builtin.thresholds, {
      temperature: { ...DEFAULT_PROFILE.temperature },
      humidity: { ...DEFAULT_PROFILE.humidity }
    });
  });

  it('copes with a batch that has no usable produce type', () => {
    assert.equal(resolveProfile({}, stored).source, 'default');
    assert.equal(resolveProfile(null, null).source, 'builtin');
  });

  it('does not let a produce literally named "default" hijack the default profile', () => {
    assert.equal(resolveProfile({ produce_type: 'Default' }, stored).source, 'default');
  });
});
