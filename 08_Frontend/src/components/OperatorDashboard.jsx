import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../lib/api';
import { formatDateTime, isSameLocalDay } from '../lib/format';
import useBatches from '../lib/useBatches';
import DashboardLayout from './layout/DashboardLayout';
import BatchLabel from './BatchLabel';
import PageHeader from './ui/PageHeader';
import { Panel, StatCard } from './ui/Cards';
import StatusBadge from './ui/StatusBadge';
import DataTable from './ui/DataTable';
import FormField from './ui/FormField';
import { EmptyState, LoadingState, Notice } from './ui/Feedback';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'register', label: 'Register Batch' },
  { id: 'batches', label: 'Produce Batches' },
  { heading: 'Planned modules' },
  { id: 'monitoring', label: 'Environmental Monitoring', planned: true },
  { id: 'events', label: 'Cold Chain Events', planned: true },
  { id: 'movement', label: 'Produce Movement', planned: true },
  { id: 'alerts', label: 'Alerts', planned: true }
];

const PRODUCE_SUGGESTIONS = ['Avocados', 'French beans', 'Snow peas', 'Mangoes', 'Passion fruit', 'Cut flowers'];

function statusBadge(status) {
  return <StatusBadge variant="info">{status || 'Unknown'}</StatusBadge>;
}

export default function OperatorDashboard() {
  const [view, setView] = useState('dashboard');
  const { batches, loading, error, reload } = useBatches();

  return (
    <DashboardLayout
      workspaceName="Supply chain operations"
      navItems={NAV_ITEMS}
      activeId={view}
      onNavigate={setView}
    >
      {view === 'dashboard' && (
        <OperatorOverview batches={batches} loading={loading} error={error} onNavigate={setView} />
      )}
      {view === 'register' && (
        <RegisterBatch onRegistered={reload} onViewBatches={() => setView('batches')} />
      )}
      {view === 'batches' && (
        <BatchList batches={batches} loading={loading} error={error} onRetry={reload} onRegister={() => setView('register')} />
      )}
    </DashboardLayout>
  );
}

function OperatorOverview({ batches, loading, error, onNavigate }) {
  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: batches.length,
      inTransit: batches.filter((batch) => batch.status === 'In Transit').length,
      today: batches.filter((batch) => isSameLocalDay(new Date(batch.registration_date), now)).length
    };
  }, [batches]);

  return (
    <>
      <PageHeader
        title="Operations dashboard"
        description="Register produce batches, print traceability labels and open a batch's environmental record."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => onNavigate('register')}>
            Register a batch
          </button>
        }
      />
      <div className="stack">
        {error && <Notice variant="danger">{error}</Notice>}
        <div className="stat-grid">
          <StatCard label="Registered batches" value={loading ? '…' : stats.total} meta="Most recent 200 shown" />
          <StatCard label="In transit" value={loading ? '…' : stats.inTransit} meta="Current batch status" />
          <StatCard label="Registered today" value={loading ? '…' : stats.today} meta="Local date" />
        </div>
        <Panel
          title="Recent batches"
          actions={
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => onNavigate('batches')}>
              View all batches
            </button>
          }
          flush
        >
          {loading ? (
            <LoadingState label="Loading batches…" />
          ) : batches.length === 0 ? (
            <EmptyState title="No batches registered yet">Use &ldquo;Register a batch&rdquo; to create the first one.</EmptyState>
          ) : (
            <DataTable
              caption="Most recently registered produce batches"
              rows={batches.slice(0, 5)}
              getRowKey={(batch) => batch.batch_id}
              columns={[
                { key: 'id', header: 'Traceability ID', render: (batch) => <span className="mono table__primary">{batch.batch_id}</span> },
                { key: 'produce', header: 'Produce', render: (batch) => batch.produce_type },
                { key: 'status', header: 'Status', render: (batch) => statusBadge(batch.status) },
                { key: 'date', header: 'Registered', className: 'nowrap', render: (batch) => formatDateTime(batch.registration_date) }
              ]}
            />
          )}
        </Panel>
      </div>
    </>
  );
}

// Registration form. Posts the same body as before to POST /api/batches
// ({ produce_type, quantity, source_location }) and uses the traceability_id the
// backend returns. No identifier is ever invented on the client.
function RegisterBatch({ onRegistered, onViewBatches }) {
  const [produceType, setProduceType] = useState('');
  const [quantity, setQuantity] = useState('');
  const [sourceLocation, setSourceLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [registered, setRegistered] = useState(null);

  const handleRegisterBatch = async (e) => {
    e.preventDefault();
    setError('');

    const quantityNumber = Number(quantity);
    if (!Number.isFinite(quantityNumber) || quantityNumber <= 0) {
      setError('Quantity must be a number greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post('/api/batches', {
        produce_type: produceType.trim(),
        quantity: quantityNumber,
        source_location: sourceLocation.trim()
      });

      if (!response.data.traceability_id) {
        throw new Error('The server did not return a traceability ID.');
      }

      setRegistered({ ...response.data.data, batch_id: response.data.traceability_id });
      onRegistered();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to register the batch. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const startAnother = () => {
    setRegistered(null);
    setProduceType('');
    setQuantity('');
    setSourceLocation('');
    setError('');
  };

  if (registered) {
    return (
      <>
        <PageHeader title="Batch registered" />
        <div className="stack">
          <Notice variant="success" title="Produce batch registered successfully.">
            Traceability ID: <span className="trace-id">{registered.batch_id}</span>
          </Notice>
          <Panel title="Traceability label">
            <BatchLabel batch={registered} />
          </Panel>
          <div className="form-actions">
            <button type="button" className="btn btn--primary" onClick={startAnother}>
              Register another batch
            </button>
            <button type="button" className="btn btn--secondary" onClick={onViewBatches}>
              View all batches
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Register produce batch"
        description="Enter the physical details of the cargo being dispatched. A unique traceability ID and QR label are generated on registration."
      />
      <Panel>
        <form onSubmit={handleRegisterBatch} className="form-stack">
          {error && <Notice variant="danger">{error}</Notice>}
          <div className="form-grid">
            <FormField
              id="batch-produce"
              label="Produce type"
              list="produce-suggestions"
              placeholder="e.g. Avocados"
              value={produceType}
              onChange={(e) => setProduceType(e.target.value)}
              required
            />
            <datalist id="produce-suggestions">
              {PRODUCE_SUGGESTIONS.map((name) => <option key={name} value={name} />)}
            </datalist>
            <FormField
              id="batch-quantity"
              label="Quantity (boxes / kg)"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              placeholder="e.g. 500"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
            <FormField
              id="batch-source"
              label="Source location"
              className="field--full"
              placeholder="e.g. Murang'a farm"
              value={sourceLocation}
              onChange={(e) => setSourceLocation(e.target.value)}
              required
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Registering…' : 'Register batch and generate QR'}
            </button>
          </div>
        </form>
      </Panel>
    </>
  );
}

function BatchList({ batches, loading, error, onRetry, onRegister }) {
  const [search, setSearch] = useState('');
  const [labelBatch, setLabelBatch] = useState(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return batches;
    return batches.filter((batch) =>
      `${batch.batch_id} ${batch.produce_type} ${batch.source_location}`.toLowerCase().includes(query));
  }, [batches, search]);

  const columns = [
    { key: 'id', header: 'Traceability ID', render: (batch) => <span className="mono table__primary">{batch.batch_id}</span> },
    { key: 'produce', header: 'Produce', render: (batch) => batch.produce_type },
    { key: 'quantity', header: 'Quantity', render: (batch) => batch.quantity },
    { key: 'source', header: 'Source', render: (batch) => batch.source_location },
    { key: 'status', header: 'Status', render: (batch) => statusBadge(batch.status) },
    { key: 'date', header: 'Registered', className: 'nowrap', render: (batch) => formatDateTime(batch.registration_date) },
    {
      key: 'actions',
      header: <span className="visually-hidden">Actions</span>,
      render: (batch) => (
        <div className="table__actions">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => setLabelBatch(batch)}
            aria-label={`Show label for ${batch.batch_id}`}
          >
            Label
          </button>
          <Link
            className="btn btn--secondary btn--sm"
            to={`/trace/${encodeURIComponent(batch.batch_id)}`}
            aria-label={`Monitor ${batch.batch_id}`}
          >
            Monitor
          </Link>
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader
        title="Produce batches"
        description="All registered batches, newest first. Reprint a label or open a batch's environmental record."
        actions={<button type="button" className="btn btn--primary" onClick={onRegister}>Register a batch</button>}
      />
      <div className="stack">
        {labelBatch && (
          <Panel
            title={`Label for ${labelBatch.batch_id}`}
            actions={<button type="button" className="btn btn--secondary btn--sm" onClick={() => setLabelBatch(null)}>Close</button>}
          >
            <BatchLabel batch={labelBatch} />
          </Panel>
        )}
        <Panel flush>
          <div className="toolbar">
            <FormField
              id="batch-search"
              label="Search batches"
              type="search"
              placeholder="ID, produce or source"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {loading ? (
            <LoadingState label="Loading batches…" />
          ) : error ? (
            <EmptyState
              title="Batches could not be loaded"
              action={<button type="button" className="btn btn--secondary" onClick={onRetry}>Try again</button>}
            >
              {error}
            </EmptyState>
          ) : (
            <DataTable
              caption="Registered produce batches"
              columns={columns}
              rows={filtered}
              getRowKey={(batch) => batch.batch_id}
              emptyMessage={batches.length === 0 ? 'No batches have been registered yet.' : 'No batches match your search.'}
            />
          )}
        </Panel>
      </div>
    </>
  );
}
