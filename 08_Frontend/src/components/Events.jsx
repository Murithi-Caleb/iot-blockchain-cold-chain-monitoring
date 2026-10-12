import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../lib/api';
import { getSession, ROLES } from '../lib/auth';
import { formatDateTime } from '../lib/format';
import { crossedLimit, eventDurationMs, eventLabel, formatDuration } from '../lib/thresholds';
import useEvents from '../lib/useEvents';
import PageHeader from './ui/PageHeader';
import { Panel } from './ui/Cards';
import StatusBadge from './ui/StatusBadge';
import DataTable from './ui/DataTable';
import FormField from './ui/FormField';
import ConfirmDialog from './ui/ConfirmDialog';
import { EmptyState, LoadingState, Notice } from './ui/Feedback';

const SEVERITY = { critical: ['danger', 'Critical'], warning: ['warn', 'Warning'] };

// Operators may acknowledge alerts (the backend enforces this too).
export function useCanAcknowledge() {
  return useMemo(() => getSession()?.role === ROLES.OPERATOR, []);
}

// Dialog for acknowledging one alert with an optional note (POST .../acknowledge).
// Remount it per event (key) so the note and error reset.
function AckDialog({ event, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post(
        `/api/batches/${encodeURIComponent(event.batch_id)}/events/${encodeURIComponent(event.event_id)}/acknowledge`,
        note.trim() ? { note: note.trim() } : {}
      );
      onDone();
    } catch (err) {
      setError(getErrorMessage(err, 'The alert could not be acknowledged.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      open={Boolean(event)}
      title="Acknowledge this alert?"
      confirmLabel="Acknowledge"
      busy={busy}
      onConfirm={confirm}
      onCancel={onClose}
    >
      <div className="stack">
        {event && <p>{eventLabel(event)} on <span className="mono">{event.batch_id}</span>. Acknowledging records that you have seen it.</p>}
        {error && <Notice variant="danger">{error}</Notice>}
        <FormField
          id="ack-note"
          label="Note (optional)"
          as="textarea"
          rows={3}
          maxLength={280}
          className="field--area"
          placeholder="e.g. Cold room door was left open; closed at 14:10"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </ConfirmDialog>
  );
}

// Table of cold-chain events. `showBatch` adds a batch column linking to its trace page.
// With `canAcknowledge`, unacknowledged events get an Acknowledge button; `onChanged`
// is called after a successful acknowledgement so the parent can refresh.
export function EventsTable({ events, showBatch = false, canAcknowledge = false, onChanged, emptyMessage }) {
  const [target, setTarget] = useState(null);

  const columns = [
    {
      key: 'event',
      header: 'Event',
      render: (event) => {
        const [variant, label] = SEVERITY[event.severity] || ['neutral', event.severity];
        return (
          <>
            <div className="table__primary">{eventLabel(event)}</div>
            <StatusBadge variant={variant}>{label}</StatusBadge>
          </>
        );
      }
    },
    ...(showBatch ? [{
      key: 'batch',
      header: 'Batch',
      render: (event) => (
        <>
          <Link className="mono" to={`/trace/${encodeURIComponent(event.batch_id)}`}>{event.batch_id}</Link>
          {event.produce_type ? <div className="table__secondary">{event.produce_type}</div> : null}
        </>
      )
    }] : []),
    {
      key: 'status',
      header: 'Status',
      render: (event) => (event.status === 'open'
        ? <StatusBadge variant="warn">Ongoing</StatusBadge>
        : <StatusBadge variant="neutral">Resolved</StatusBadge>)
    },
    { key: 'started', header: 'Started', className: 'nowrap', render: (event) => formatDateTime(event.started_at) },
    {
      key: 'duration',
      header: 'Duration',
      className: 'nowrap',
      render: (event) => (
        <>
          {formatDuration(eventDurationMs(event))}
          {event.status === 'open' ? <div className="table__secondary">so far</div> : null}
        </>
      )
    },
    {
      key: 'peak',
      header: 'Peak',
      className: 'nowrap',
      render: (event) => (
        <>
          <span className="table__primary">{event.peak_value} {event.unit}</span>
          <div className="table__secondary">{crossedLimit(event)} · {event.reading_count} readings</div>
        </>
      )
    },
    {
      key: 'ack',
      header: 'Acknowledgement',
      render: (event) => {
        if (event.acknowledged) {
          return (
            <>
              <StatusBadge variant="ok">Acknowledged</StatusBadge>
              <div className="table__secondary">{event.acknowledged_by}</div>
              {event.acknowledgement_note ? <div className="table__secondary">&ldquo;{event.acknowledgement_note}&rdquo;</div> : null}
            </>
          );
        }
        return canAcknowledge ? (
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setTarget(event)}>
            Acknowledge
          </button>
        ) : <StatusBadge variant="neutral">Not acknowledged</StatusBadge>;
      }
    }
  ];

  return (
    <>
      <DataTable
        caption="Cold-chain events"
        columns={columns}
        rows={events}
        getRowKey={(event) => `${event.batch_id}/${event.event_id}`}
        emptyMessage={emptyMessage}
      />
      <AckDialog
        key={target ? target.event_id : 'none'}
        event={target}
        onClose={() => setTarget(null)}
        onDone={() => {
          setTarget(null);
          if (onChanged) onChanged();
        }}
      />
    </>
  );
}

// Events of one batch, shown on the traceability page. Refreshes every 10 seconds.
export function BatchEventsPanel({ batchId }) {
  const { events, loading, error, reload } = useEvents({ batchId, intervalMs: 10000 });
  const canAcknowledge = useCanAcknowledge();
  const open = events.filter((event) => event.status === 'open');

  return (
    <Panel
      title="Cold-chain events"
      description="Temperature and humidity excursions detected from this batch's recorded sensor readings."
    >
      {loading && events.length === 0 ? (
        <LoadingState label="Loading cold-chain events…" />
      ) : (
        <div className="stack">
          {error && <Notice variant="warning">{error}</Notice>}
          {open.length > 0 && (
            <Notice variant="danger" title={`${open.length} active excursion${open.length === 1 ? '' : 's'}`}>
              {open.map((event) => (
                <div key={event.event_id}>
                  {eventLabel(event)}: peak {event.peak_value} {event.unit} ({crossedLimit(event)}), since {formatDateTime(event.started_at)}.
                </div>
              ))}
            </Notice>
          )}
          {events.length === 0 && !error ? (
            <EmptyState title="No excursions detected">
              Events appear here when recorded readings leave the batch&apos;s acceptable range. The simulated preview never creates events.
            </EmptyState>
          ) : (
            <EventsTable events={events} canAcknowledge={canAcknowledge} onChanged={reload} />
          )}
        </div>
      )}
    </Panel>
  );
}

const FILTERS = [
  ['attention', 'Needs attention (ongoing or unacknowledged)'],
  ['open', 'Ongoing'],
  ['unacknowledged', 'Not acknowledged'],
  ['resolved', 'Resolved'],
  ['all', 'All events']
];

// Operator view of events across all batches. mode "alerts" starts on the items that need
// attention; mode "events" starts on the full history.
export function EventsView({ mode }) {
  const [status, setStatus] = useState(mode === 'alerts' ? 'attention' : 'all');
  const { events, loading, error, reload } = useEvents({ status, intervalMs: 10000 });
  const canAcknowledge = useCanAcknowledge();

  return (
    <>
      <PageHeader
        title={mode === 'alerts' ? 'Alerts' : 'Cold chain events'}
        description={mode === 'alerts'
          ? 'Excursions that are still happening or have not been acknowledged. Open a batch to see its readings.'
          : 'Every temperature and humidity excursion detected across batches, newest first.'}
      />
      <Panel flush>
        <div className="toolbar">
          <FormField id="event-status" label="Show" as="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </FormField>
        </div>
        {loading && events.length === 0 ? (
          <LoadingState label="Loading events…" />
        ) : error ? (
          <EmptyState
            title="Events could not be loaded"
            action={<button type="button" className="btn btn--secondary" onClick={reload}>Try again</button>}
          >
            {error}
          </EmptyState>
        ) : (
          <EventsTable
            events={events}
            showBatch
            canAcknowledge={canAcknowledge}
            onChanged={reload}
            emptyMessage={status === 'attention' ? 'Nothing needs attention.' : 'No events match this filter.'}
          />
        )}
      </Panel>
    </>
  );
}
