import { useCallback, useEffect, useMemo, useState } from 'react';
import api, { getErrorMessage } from '../lib/api';
import { getSession, ROLES } from '../lib/auth';
import { formatDateTime } from '../lib/format';
import { Panel } from './ui/Cards';
import StatusBadge from './ui/StatusBadge';
import DataTable from './ui/DataTable';
import { LoadingState, Notice } from './ui/Feedback';

// Overall result for the batch -> [badge variant, label, explanation]
const OVERALL = {
  verified: ['ok', 'Verified', 'Every anchored record matches the database.'],
  tampered: ['danger', 'Integrity check failed', 'At least one record in the database no longer matches the fingerprint stored on the blockchain, or its blockchain entry is missing.'],
  partial: ['warn', 'Partially verified', 'Some records are verified; others are pending or failed.'],
  pending: ['info', 'Anchoring in progress', 'Records are being written to the blockchain. This usually takes a few seconds.'],
  failed: ['warn', 'Anchoring failed', 'The blockchain write did not complete. An operator can retry.'],
  not_anchored: ['neutral', 'Not anchored', 'No record of this batch has been written to the blockchain yet.'],
  unavailable: ['neutral', 'Ledger unavailable', 'The blockchain ledger is not configured or could not be reached, so no verification was performed.']
};

// Per-record result -> [badge variant, label]
const RECORD_STATE = {
  verified: ['ok', 'Verified'],
  tampered: ['danger', 'Mismatch'],
  missing_on_chain: ['danger', 'Missing on chain'],
  pending: ['info', 'Pending'],
  failed: ['warn', 'Failed'],
  unavailable: ['neutral', 'Unavailable']
};

const RECORD_LABEL = {
  BATCH_REGISTRATION: 'Batch registration',
  READINGS_DIGEST: 'Sensor readings digest'
};

const shorten = (value) => (value && value.length > 20 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value || '—');

// Blockchain integrity status for one batch. Reads GET /api/batches/:id/verification.
// Operators can also start anchoring; the chain itself holds only fingerprints.
export default function VerificationPanel({ batchId }) {
  const session = useMemo(() => getSession(), []);
  const isOperator = session?.role === ROLES.OPERATOR;

  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { variant, text }

  const load = useCallback(async (silent = false) => {
    if (!silent) setState((previous) => ({ ...previous, loading: true, error: '' }));
    try {
      const response = await api.get(`/api/batches/${encodeURIComponent(batchId)}/verification`);
      setState({ loading: false, data: response.data.data, error: '' });
    } catch (error) {
      setState((previous) => ({
        loading: false,
        data: silent ? previous.data : null,
        error: getErrorMessage(error, 'Could not load blockchain verification.')
      }));
    }
  }, [batchId]);

  useEffect(() => {
    load(false);
  }, [load]);

  // While anything is still being written to the chain, check again shortly.
  const hasPending = state.data?.records?.some((record) => record.verification === 'pending');
  useEffect(() => {
    if (!hasPending) return undefined;
    const timer = setTimeout(() => load(true), 4000);
    return () => clearTimeout(timer);
  }, [hasPending, state.data, load]);

  const startAnchoring = async (path, successText) => {
    setBusy(true);
    setMessage(null);
    try {
      await api.post(`/api/batches/${encodeURIComponent(batchId)}/${path}`);
      setMessage({ variant: 'info', text: successText });
      await load(true);
    } catch (error) {
      setMessage({ variant: 'danger', text: getErrorMessage(error, 'Anchoring could not be started.') });
    } finally {
      setBusy(false);
    }
  };

  const data = state.data;
  const overall = data ? OVERALL[data.overall] || OVERALL.unavailable : null;
  const hasRegistration = data?.records?.some(
    (record) => record.record_type === 'BATCH_REGISTRATION' && record.status === 'confirmed'
  );

  const columns = [
    {
      key: 'type',
      header: 'Record',
      render: (record) => (
        <>
          <div className="table__primary">{RECORD_LABEL[record.record_type] || record.record_type}</div>
          {record.reading_count ? <div className="table__secondary">{record.reading_count} readings</div> : null}
        </>
      )
    },
    {
      key: 'state',
      header: 'Result',
      render: (record) => {
        const [variant, label] = RECORD_STATE[record.verification] || RECORD_STATE.unavailable;
        return (
          <>
            <StatusBadge variant={variant}>{label}</StatusBadge>
            {record.error ? <div className="table__secondary">{record.error}</div> : null}
          </>
        );
      }
    },
    {
      key: 'hash',
      header: 'Fingerprint (SHA-256)',
      render: (record) => <code title={record.data_hash || ''}>{shorten(record.data_hash)}</code>
    },
    {
      key: 'tx',
      header: 'Transaction',
      render: (record) => {
        if (!record.tx_hash) return '—';
        return record.explorer_url ? (
          <a href={record.explorer_url} target="_blank" rel="noopener noreferrer">
            <code>{shorten(record.tx_hash)}</code>
            <span className="visually-hidden"> (opens block explorer in a new tab)</span>
          </a>
        ) : (
          <code title={record.tx_hash}>{shorten(record.tx_hash)}</code>
        );
      }
    },
    { key: 'anchored', header: 'Anchored', className: 'nowrap', render: (record) => formatDateTime(record.anchored_at) }
  ];

  return (
    <Panel
      title="Blockchain verification"
      description="Only SHA-256 fingerprints are stored on the blockchain. Verification re-hashes the current database records and compares them with the on-chain values."
      actions={
        <>
          {overall && <StatusBadge variant={overall[0]}>{overall[1]}</StatusBadge>}
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => load(false)} disabled={state.loading}>
            Re-verify
          </button>
        </>
      }
    >
      {state.loading && !data ? (
        <LoadingState label="Checking the blockchain…" />
      ) : (
        <div className="stack">
          {state.error && <Notice variant="danger">{state.error}</Notice>}
          {message && <Notice variant={message.variant} onDismiss={() => setMessage(null)}>{message.text}</Notice>}
          {overall && (
            <Notice variant={data.overall === 'verified' ? 'success' : data.overall === 'tampered' ? 'danger' : 'info'} title={overall[1]}>
              {overall[2]}
            </Notice>
          )}

          {data?.records?.length > 0 && (
            <DataTable
              caption="Blockchain-anchored records for this batch"
              columns={columns}
              rows={data.records}
              getRowKey={(record) => record.record_key}
            />
          )}

          {isOperator && data?.ledger_enabled && (
            <div className="form-actions">
              {!hasRegistration && (
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={busy}
                  onClick={() => startAnchoring('anchor', 'Anchoring the batch registration…')}
                >
                  Anchor batch registration
                </button>
              )}
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                onClick={() => startAnchoring('readings-digest', 'Anchoring a fingerprint of the recorded readings…')}
              >
                Anchor sensor readings
              </button>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
