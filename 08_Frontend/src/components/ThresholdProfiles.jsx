import { useCallback, useEffect, useState } from 'react';
import api, { getErrorMessage } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { produceKey } from '../lib/thresholds';
import { Panel } from './ui/Cards';
import DataTable from './ui/DataTable';
import FormField from './ui/FormField';
import ConfirmDialog from './ui/ConfirmDialog';
import StatusBadge from './ui/StatusBadge';
import { EmptyState, LoadingState, Notice } from './ui/Feedback';

// Same bounds the backend enforces (coldchain/profiles.js); the server stays the authority.
const BOUNDS = { temperature: [-30, 50], humidity: [0, 100] };

const EMPTY_FORM = { produce: '', tMin: '', tMax: '', hMin: '', hMax: '' };

function validate(form, isDefault) {
  const errors = {};
  if (!isDefault && !produceKey(form.produce)) errors.produce = 'Enter a produce type, e.g. Avocados.';
  for (const [metric, minKey, maxKey, label] of [
    ['temperature', 'tMin', 'tMax', 'Temperature'],
    ['humidity', 'hMin', 'hMax', 'Humidity']
  ]) {
    const [lo, hi] = BOUNDS[metric];
    const min = Number(form[minKey]);
    const max = Number(form[maxKey]);
    if (form[minKey] === '' || !Number.isFinite(min)) errors[minKey] = `${label} minimum is required.`;
    else if (min < lo || min > hi) errors[minKey] = `Must be between ${lo} and ${hi}.`;
    if (form[maxKey] === '' || !Number.isFinite(max)) errors[maxKey] = `${label} maximum is required.`;
    else if (max < lo || max > hi) errors[maxKey] = `Must be between ${lo} and ${hi}.`;
    if (!errors[minKey] && !errors[maxKey] && min >= max) errors[maxKey] = 'Maximum must be greater than the minimum.';
  }
  return errors;
}

const range = (r, unit) => `${r.min} to ${r.max} ${unit}`;

// Admin tool to manage acceptable ranges. Backend: GET/PUT/DELETE /api/thresholds.
export default function ThresholdProfiles() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [editing, setEditing] = useState(null); // { key, isDefault, isNew }
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/api/thresholds');
      setData(response.data.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Threshold profiles could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/thresholds/${encodeURIComponent(pendingDelete.profile_key)}`);
      setFeedback({ variant: 'success', text: `Profile for ${pendingDelete.produce_type} deleted. Those batches now use the default limits.` });
      setPendingDelete(null);
      await load();
    } catch (err) {
      setFeedback({ variant: 'danger', text: getErrorMessage(err, 'The profile could not be deleted.') });
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'produce',
      header: 'Produce type',
      render: (p) => <span className="table__primary">{p.produce_type}</span>
    },
    { key: 'temp', header: 'Temperature', className: 'nowrap', render: (p) => range(p.temperature, '°C') },
    { key: 'hum', header: 'Humidity', className: 'nowrap', render: (p) => range(p.humidity, '%') },
    {
      key: 'updated',
      header: 'Last updated',
      render: (p) => (
        <>
          {formatDateTime(p.updated_at)}
          {p.updated_by ? <div className="table__secondary">{p.updated_by}</div> : null}
        </>
      )
    },
    {
      key: 'actions',
      header: <span className="visually-hidden">Actions</span>,
      render: (p) => (
        <div className="table__actions">
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setEditing({ key: p.profile_key, profile: p })}>
            Edit
          </button>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setPendingDelete(p)}>
            Delete
          </button>
        </div>
      )
    }
  ];

  if (loading && !data) return <LoadingState label="Loading threshold profiles…" />;
  if (error && !data) {
    return (
      <EmptyState
        title="Threshold profiles could not be loaded"
        action={<button type="button" className="btn btn--secondary" onClick={load}>Try again</button>}
      >
        {error}
      </EmptyState>
    );
  }

  const def = data.default;

  return (
    <div className="stack">
      {feedback && <Notice variant={feedback.variant} onDismiss={() => setFeedback(null)}>{feedback.text}</Notice>}
      <Notice variant="info">
        A batch uses the profile matching its produce type (spelling must match, e.g. &ldquo;Avocados&rdquo;), otherwise the default.
        Changes apply to new readings only; events already detected keep the limits they opened with.
      </Notice>

      {editing && (
        <ProfileForm
          key={editing.key || 'new'}
          editing={editing}
          onCancel={() => setEditing(null)}
          onSaved={async (text) => {
            setEditing(null);
            setFeedback({ variant: 'success', text });
            await load();
          }}
        />
      )}

      <Panel
        title="Default profile"
        description="Used for any produce type without its own profile."
        actions={
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setEditing({ key: 'default', isDefault: true, profile: def })}>
            Edit default
          </button>
        }
      >
        <p>
          Temperature <strong>{range(def.temperature, '°C')}</strong> · Humidity <strong>{range(def.humidity, '%')}</strong>{' '}
          {def.is_builtin && <StatusBadge variant="warn">Built-in placeholder</StatusBadge>}
        </p>
        {def.is_builtin && (
          <p className="field__hint">
            This 2–6 °C / 85–95 % range is a placeholder, not an official standard. Set values your cold chain actually targets.
          </p>
        )}
      </Panel>

      <Panel
        title="Produce profiles"
        flush
        actions={
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setEditing({ key: null, isNew: true })}>
            Add profile
          </button>
        }
      >
        <DataTable
          caption="Threshold profiles by produce type"
          columns={columns}
          rows={data.profiles}
          getRowKey={(p) => p.profile_key}
          emptyMessage="No produce-specific profiles yet. All batches use the default."
        />
      </Panel>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this profile?"
        confirmLabel="Delete profile"
        danger
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      >
        <p>
          <strong>{pendingDelete?.produce_type}</strong> batches will use the default limits for new readings.
        </p>
      </ConfirmDialog>
    </div>
  );
}

function ProfileForm({ editing, onCancel, onSaved }) {
  const { isDefault = false, isNew = false, profile } = editing;
  const [form, setForm] = useState(profile ? {
    produce: profile.produce_type || '',
    tMin: String(profile.temperature.min),
    tMax: String(profile.temperature.max),
    hMin: String(profile.humidity.min),
    hMax: String(profile.humidity.max)
  } : EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm((current) => ({ ...current, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setServerError('');
    const found = validate(form, isDefault);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const key = isDefault ? 'default' : (editing.key || produceKey(form.produce));
    const body = {
      ...(isDefault ? {} : { produce_type: form.produce.trim() }),
      temperature_min: Number(form.tMin),
      temperature_max: Number(form.tMax),
      humidity_min: Number(form.hMin),
      humidity_max: Number(form.hMax)
    };
    setSaving(true);
    try {
      await api.put(`/api/thresholds/${encodeURIComponent(key)}`, body);
      await onSaved(isDefault ? 'Default profile saved.' : `Profile for ${form.produce.trim()} saved.`);
    } catch (err) {
      setServerError(getErrorMessage(err, 'The profile could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title={isDefault ? 'Edit default profile' : isNew ? 'Add produce profile' : `Edit ${profile.produce_type}`}>
      <form onSubmit={submit} className="form-stack" noValidate>
        {serverError && <Notice variant="danger">{serverError}</Notice>}
        <div className="form-grid">
          {!isDefault && (
            <FormField
              id="profile-produce"
              label="Produce type"
              className="field--full"
              placeholder="e.g. Avocados"
              maxLength={60}
              value={form.produce}
              onChange={set('produce')}
              disabled={!isNew}
              error={errors.produce}
              hint={isNew ? 'Must match the produce type typed when registering batches.' : 'The produce type cannot be changed; delete and re-add it instead.'}
              required
            />
          )}
          <FormField id="profile-tmin" label="Temperature min (°C)" type="number" step="any" value={form.tMin} onChange={set('tMin')} error={errors.tMin} required />
          <FormField id="profile-tmax" label="Temperature max (°C)" type="number" step="any" value={form.tMax} onChange={set('tMax')} error={errors.tMax} required />
          <FormField id="profile-hmin" label="Humidity min (%)" type="number" step="any" value={form.hMin} onChange={set('hMin')} error={errors.hMin} required />
          <FormField id="profile-hmax" label="Humidity max (%)" type="number" step="any" value={form.hMax} onChange={set('hMax')} error={errors.hMax} required />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
          <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        </div>
      </form>
    </Panel>
  );
}
