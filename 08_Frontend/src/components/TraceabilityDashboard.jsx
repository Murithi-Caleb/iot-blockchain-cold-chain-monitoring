import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { getErrorMessage } from '../lib/api';
import { getSession, ROLES, ROLE_HOME } from '../lib/auth';
import { formatDateTime } from '../lib/format';
import useBatches from '../lib/useBatches';
import {
  DEFAULT_THRESHOLDS,
  evaluateValue,
  isExcursion,
  useRecordedReadings,
  useSimulatedTelemetry
} from '../lib/telemetry';
import DashboardLayout from './layout/DashboardLayout';
import TelemetryChart from './TelemetryChart';
import VerificationPanel from './VerificationPanel';
import PageHeader from './ui/PageHeader';
import { Panel, StatCard } from './ui/Cards';
import StatusBadge from './ui/StatusBadge';
import DataTable from './ui/DataTable';
import FormField from './ui/FormField';
import { EmptyState, LoadingState, Notice } from './ui/Feedback';

const BATCH_ID_PATTERN = /^BATCH-\d+$/;

const RANGE_BADGE = {
  within: ['ok', 'Within range'],
  above: ['danger', 'Above maximum'],
  below: ['warn', 'Below minimum']
};

// Accepts a bare ID or a full label URL (…/trace/BATCH-123) and returns a normalised ID.
function normalizeBatchId(input) {
  const trimmed = input.trim();
  const lastSegment = trimmed.split('/').filter(Boolean).pop() || '';
  let decoded = lastSegment;
  try {
    decoded = decodeURIComponent(lastSegment);
  } catch {
    // Keep the raw segment if it is not valid percent-encoding.
  }
  return decoded.toUpperCase();
}

export default function TraceabilityDashboard() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const session = useMemo(() => getSession(), []);

  // Traceability users have this as their home; operators and administrators reach it
  // from a scanned label or a "Monitor" link and get a way back to their own workspace.
  const navItems = useMemo(() => {
    const items = [];
    if (session?.role && session.role !== ROLES.TRACEABILITY) {
      items.push({ id: 'home', label: 'My workspace', to: ROLE_HOME[session.role] });
    }
    items.push(
      { id: 'trace', label: 'Traceability', to: '/traceability' },
      { heading: 'Planned modules' },
      { id: 'alerts', label: 'Alerts', planned: true }
    );
    return items;
  }, [session]);

  const lookup = (id) => navigate(`/trace/${encodeURIComponent(id)}`);

  return (
    <DashboardLayout
      workspaceName="Traceability and monitoring"
      navItems={navItems}
      activeId="trace"
      onNavigate={() => {}}
    >
      <PageHeader
        title="Traceability lookup"
        description="Enter a traceability ID, or scan a batch label's QR code, to view the batch record and its environmental conditions."
      />
      <div className="stack">
        <LookupPanel key={batchId || 'none'} initialValue={batchId || ''} onLookup={lookup} />
        {batchId ? (
          <BatchRecord key={batchId} rawId={batchId} />
        ) : (
          <>
            <RecentBatches onSelect={lookup} />
            <EnvironmentalPanel batchId={null} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function LookupPanel({ initialValue, onLookup }) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const id = normalizeBatchId(value);
    if (!BATCH_ID_PATTERN.test(id)) {
      setError('Enter a traceability ID in the form BATCH-1234567890123.');
      return;
    }
    setError('');
    onLookup(id);
  };

  return (
    <Panel title="Look up a batch" description="Scanning a label with a phone camera opens this page automatically.">
      <form onSubmit={handleSubmit} className="lookup-form">
        <FormField
          id="lookup-id"
          label="Traceability ID"
          placeholder="BATCH-1234567890123"
          autoComplete="off"
          spellCheck={false}
          error={error}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
        <button type="submit" className="btn btn--primary">Look up</button>
      </form>
    </Panel>
  );
}

function RecentBatches({ onSelect }) {
  const { batches, loading, error, reload } = useBatches();

  return (
    <Panel title="Recent batches" description="Select a batch to open its record." flush>
      {loading ? (
        <LoadingState label="Loading batches…" />
      ) : error ? (
        <EmptyState
          title="Batches could not be loaded"
          action={<button type="button" className="btn btn--secondary" onClick={reload}>Try again</button>}
        >
          {error}
        </EmptyState>
      ) : (
        <DataTable
          caption="Recently registered produce batches"
          rows={batches.slice(0, 8)}
          getRowKey={(batch) => batch.batch_id}
          emptyMessage="No batches have been registered yet."
          columns={[
            { key: 'id', header: 'Traceability ID', render: (batch) => <span className="mono table__primary">{batch.batch_id}</span> },
            { key: 'produce', header: 'Produce', render: (batch) => batch.produce_type },
            { key: 'source', header: 'Source', render: (batch) => batch.source_location },
            { key: 'date', header: 'Registered', className: 'nowrap', render: (batch) => formatDateTime(batch.registration_date) },
            {
              key: 'actions',
              header: <span className="visually-hidden">Open</span>,
              render: (batch) => (
                <div className="table__actions">
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => onSelect(batch.batch_id)}
                    aria-label={`Open record for ${batch.batch_id}`}
                  >
                    Open
                  </button>
                </div>
              )
            }
          ]}
        />
      )}
    </Panel>
  );
}

// The record for one batch: details from GET /api/batches/:id, environmental data,
// and clearly marked placeholders for features that are not built yet.
function BatchRecord({ rawId }) {
  const batchId = normalizeBatchId(rawId);
  const validId = BATCH_ID_PATTERN.test(batchId);

  const [state, setState] = useState({ loading: validId, batch: null, notFound: false, error: '' });

  const load = useCallback(async () => {
    setState({ loading: true, batch: null, notFound: false, error: '' });
    try {
      const response = await api.get(`/api/batches/${encodeURIComponent(batchId)}`);
      setState({ loading: false, batch: response.data.data, notFound: false, error: '' });
    } catch (error) {
      if (error.response?.status === 404) {
        setState({ loading: false, batch: null, notFound: true, error: '' });
      } else {
        setState({ loading: false, batch: null, notFound: false, error: getErrorMessage(error, 'Could not load this batch.') });
      }
    }
  }, [batchId]);

  useEffect(() => {
    if (validId) load();
  }, [validId, load]);

  if (!validId) {
    return (
      <Notice variant="danger" title="Invalid traceability ID">
        &ldquo;{rawId}&rdquo; is not a valid traceability ID. IDs look like BATCH-1234567890123.
      </Notice>
    );
  }

  if (state.loading) return <Panel><LoadingState label="Loading batch record…" /></Panel>;

  if (state.error) {
    return (
      <Panel>
        <EmptyState
          title="Batch could not be loaded"
          action={<button type="button" className="btn btn--secondary" onClick={load}>Try again</button>}
        >
          {state.error}
        </EmptyState>
      </Panel>
    );
  }

  if (state.notFound) {
    return (
      <Panel>
        <EmptyState title="No batch found">
          There is no registered batch with the ID <span className="mono">{batchId}</span>. Check the ID or label and try again.
        </EmptyState>
      </Panel>
    );
  }

  const { batch } = state;
  return (
    <>
      <Panel
        title="Batch details"
        actions={<StatusBadge variant="info">{batch.status || 'Unknown'}</StatusBadge>}
      >
        <dl className="detail-list">
          <div><dt>Traceability ID</dt><dd><span className="trace-id">{batch.batch_id}</span></dd></div>
          <div><dt>Produce</dt><dd>{batch.produce_type}</dd></div>
          <div><dt>Quantity</dt><dd>{batch.quantity}</dd></div>
          <div><dt>Origin / source</dt><dd>{batch.source_location}</dd></div>
          <div><dt>Registered</dt><dd>{formatDateTime(batch.registration_date)}</dd></div>
        </dl>
      </Panel>

      <EnvironmentalPanel batchId={batch.batch_id} />

      <VerificationPanel batchId={batch.batch_id} />

      <Panel
        title="Traceability record"
        description="These parts of the full traceability record are not implemented yet."
      >
        <div className="planned-grid">
          <div className="planned-card">
            <h3>Movement history <StatusBadge>Planned</StatusBadge></h3>
            <p>Custody and location changes along the supply chain will appear here as a timeline.</p>
          </div>
          <div className="planned-card">
            <h3>Cold-chain events <StatusBadge>Planned</StatusBadge></h3>
            <p>Recorded temperature excursions and handling events for this batch.</p>
          </div>
        </div>
      </Panel>
    </>
  );
}

// Environmental conditions. Shows RECORDED readings when the batch has any; otherwise
// falls back to SIMULATED demonstration telemetry (always labelled as such).
// To go fully live later, remove the fallback branch; the chart and stats stay as is.
function EnvironmentalPanel({ batchId }) {
  const recorded = useRecordedReadings(batchId);
  const hasRecorded = recorded.readings.length > 0;
  const simulated = useSimulatedTelemetry({ enabled: !recorded.loading && !hasRecorded });

  const data = hasRecorded ? recorded.readings : simulated;
  const source = hasRecorded ? 'recorded' : 'simulated';
  const latest = data[data.length - 1];

  const temperatureState = evaluateValue(latest.temperature, DEFAULT_THRESHOLDS.temperature);
  const humidityState = evaluateValue(latest.humidity, DEFAULT_THRESHOLDS.humidity);
  const excursions = data.filter((point) => isExcursion(point)).length;
  const [tempVariant, tempText] = RANGE_BADGE[temperatureState];
  const [humVariant, humText] = RANGE_BADGE[humidityState];
  const outOfRange = temperatureState !== 'within' || humidityState !== 'within';

  const { temperature: tempRange, humidity: humRange } = DEFAULT_THRESHOLDS;

  return (
    <Panel
      title="Environmental monitoring"
      description={source === 'recorded'
        ? `Recorded by ${recorded.deviceId || 'sensor device'}; refreshes every 10 seconds.`
        : 'Temperature and humidity (ESP32 / DHT22 data stream preview).'}
      actions={
        source === 'recorded'
          ? <StatusBadge variant="ok">Recorded sensor data</StatusBadge>
          : <StatusBadge variant="warn">SIMULATED</StatusBadge>
      }
    >
      {recorded.loading ? (
        <LoadingState label="Loading environmental readings…" />
      ) : (
        <div className="stack">
          {recorded.error && <Notice variant="warning">{recorded.error}</Notice>}
          {source === 'simulated' && (
            <Notice variant="info">
              {batchId
                ? 'No sensor readings have been recorded for this batch yet. The chart shows simulated demonstration telemetry generated in your browser; it is not data from this batch.'
                : 'Demonstration mode: telemetry is simulated in your browser to preview the live monitoring display. Open a batch to see its recorded readings.'}
            </Notice>
          )}
          {outOfRange && (
            <Notice variant="warning" title="Latest reading is outside the acceptable range">
              {source === 'simulated' ? 'This is a simulated reading. ' : ''}
              Check the values below against the {tempRange.min}–{tempRange.max} {tempRange.unit} and {humRange.min}–{humRange.max}{humRange.unit} range.
            </Notice>
          )}

          <div className="stat-grid">
            <StatCard
              label="Temperature"
              value={`${latest.temperature.toFixed(1)} ${tempRange.unit}`}
              badge={<StatusBadge variant={tempVariant}>{tempText}</StatusBadge>}
              meta={`Range ${tempRange.min}–${tempRange.max} ${tempRange.unit}`}
            />
            <StatCard
              label="Humidity"
              value={`${latest.humidity.toFixed(1)}${humRange.unit}`}
              badge={<StatusBadge variant={humVariant}>{humText}</StatusBadge>}
              meta={`Range ${humRange.min}–${humRange.max}${humRange.unit}`}
            />
            <StatCard
              label="Readings outside range"
              value={`${excursions} of ${data.length}`}
              meta={source === 'simulated' ? 'Simulated readings in view' : 'Most recent readings in view'}
            />
            <StatCard label="Last reading" value={latest.time} meta={source === 'simulated' ? 'Simulated clock' : 'Device timestamp'} />
          </div>

          <TelemetryChart data={data} />
          <p className="legend-note">
            Dotted lines mark a placeholder acceptable temperature range ({tempRange.min}–{tempRange.max} {tempRange.unit}).
            Configurable thresholds per produce type are a planned feature. Alerts are not stored yet.
          </p>
          {source === 'recorded' && (
            <p className="legend-note">
              Showing the latest {data.length} recorded readings. <Link to="/traceability">Look up another batch</Link>.
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}
