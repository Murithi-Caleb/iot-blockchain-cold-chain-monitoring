import { useCallback, useEffect, useMemo, useState } from 'react';
import api, { getErrorMessage } from '../lib/api';
import { getSession, ROLES } from '../lib/auth';
import { formatDateTime } from '../lib/format';
import { Panel } from './ui/Cards';
import StatusBadge from './ui/StatusBadge';
import FormField from './ui/FormField';
import ConfirmDialog from './ui/ConfirmDialog';
import { LoadingState, Notice } from './ui/Feedback';

const CHECK_BADGE = {
  passed: ['ok', 'Met'],
  failed: ['danger', 'Not met'],
  skipped: ['neutral', 'Not checked']
};

// Buyer acceptance on the batch page. Backend: GET/POST /api/batches/:id/compliance.
// Everyone signed in can see the decision; only the traceability (buyer) role can make it,
// and the backend enforces both that and the acceptance conditions.
export default function CompliancePanel({ batchId, onDecided }) {
  const isBuyer = useMemo(() => getSession()?.role === ROLES.TRACEABILITY, []);
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [mode, setMode] = useState(null); // 'accepted' | 'rejected' | null
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await api.get(`/api/batches/${encodeURIComponent(batchId)}/compliance`);
      setState({ loading: false, data: response.data.data, error: '' });
    } catch (error) {
      setState({ loading: false, data: null, error: getErrorMessage(error, 'Could not load the compliance status.') });
    }
  }, [batchId]);

  useEffect(() => { load(); }, [load]);

  const open = (nextMode) => {
    setNote('');
    setDialogError('');
    setMode(nextMode);
  };

  const submit = async () => {
    if (mode === 'rejected' && !note.trim()) {
      setDialogError('Give a reason for rejecting this batch.');
      return;
    }
    setBusy(true);
    setDialogError('');
    try {
      await api.post(`/api/batches/${encodeURIComponent(batchId)}/compliance`, {
        decision: mode,
        ...(note.trim() ? { note: note.trim() } : {})
      });
      setMode(null);
      await load();
      if (onDecided) onDecided();
    } catch (error) {
      setDialogError(getErrorMessage(error, 'The decision could not be recorded.'));
      await load(); // conditions may have changed since the page loaded
    } finally {
      setBusy(false);
    }
  };

  const { data } = state;
  const decision = data?.decision;
  const eligibility = data?.eligibility;

  return (
    <Panel
      title="Buyer acceptance"
      description="On arrival the buyer records one final decision: a certificate of compliance, or a rejection with a reason. It cannot be changed afterwards and is anchored on the blockchain."
      actions={decision && (
        decision.decision === 'accepted'
          ? <StatusBadge variant="ok">Accepted</StatusBadge>
          : <StatusBadge variant="danger">Rejected</StatusBadge>
      )}
    >
      {state.loading ? (
        <LoadingState label="Loading compliance status…" />
      ) : state.error ? (
        <Notice variant="warning">{state.error}</Notice>
      ) : decision ? (
        <Certificate decision={decision} />
      ) : (
        <div className="stack">
          <ul className="check-list">
            {eligibility.checks.map((check) => {
              const [variant, label] = CHECK_BADGE[check.status];
              return (
                <li key={check.id}>
                  <StatusBadge variant={variant}>{label}</StatusBadge>{' '}
                  <strong>{check.label}.</strong> {check.detail}
                </li>
              );
            })}
          </ul>
          {isBuyer ? (
            <>
              {!eligibility.eligible && (
                <Notice variant="info">
                  A certificate cannot be issued until every condition above is met. You can still reject the batch with a reason.
                </Notice>
              )}
              <div className="form-actions">
                <button type="button" className="btn btn--primary" disabled={!eligibility.eligible} onClick={() => open('accepted')}>
                  Issue certificate of compliance
                </button>
                <button type="button" className="btn btn--secondary" onClick={() => open('rejected')}>
                  Reject batch
                </button>
              </div>
            </>
          ) : (
            <p className="field__hint">No decision has been recorded yet. Only the receiving buyer can accept or reject a batch.</p>
          )}
        </div>
      )}

      <ConfirmDialog
        open={mode !== null}
        title={mode === 'accepted' ? 'Issue certificate of compliance?' : 'Reject this batch?'}
        confirmLabel={mode === 'accepted' ? 'Issue certificate' : 'Reject batch'}
        danger={mode === 'rejected'}
        busy={busy}
        onConfirm={submit}
        onCancel={() => setMode(null)}
      >
        <div className="stack">
          <p>
            {mode === 'accepted'
              ? 'You confirm the batch arrived in the right conditions and you accept it. This is final.'
              : 'You are refusing this batch. This is final and cannot be undone.'}
          </p>
          {dialogError && <Notice variant="danger">{dialogError}</Notice>}
          <FormField
            id="decision-note"
            label={mode === 'rejected' ? 'Reason (required)' : 'Note (optional)'}
            as="textarea"
            rows={3}
            maxLength={280}
            className="field--area"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </ConfirmDialog>
    </Panel>
  );
}

function Certificate({ decision }) {
  const accepted = decision.decision === 'accepted';
  return (
    <div className="stack">
      <Notice
        variant={accepted ? 'success' : 'danger'}
        title={accepted ? 'Certificate of compliance issued' : 'Batch rejected'}
      >
        {accepted
          ? 'The buyer confirmed this batch arrived in the right conditions and accepted it.'
          : 'The buyer refused this batch.'}
      </Notice>
      <dl className="detail-list">
        <div><dt>Decided by</dt><dd>{decision.decided_by}</dd></div>
        <div><dt>Decided at</dt><dd>{formatDateTime(decision.decided_at)}</dd></div>
        {decision.note && <div><dt>{accepted ? 'Note' : 'Reason'}</dt><dd>{decision.note}</dd></div>}
        <div>
          <dt>Limits applied</dt>
          <dd>
            {decision.threshold_temperature_min}–{decision.threshold_temperature_max} °C,{' '}
            {decision.threshold_humidity_min}–{decision.threshold_humidity_max} %
          </dd>
        </div>
        <div><dt>Evidence</dt><dd>{decision.reading_count} readings, {decision.event_count} excursion{decision.event_count === 1 ? '' : 's'} ({decision.critical_event_count} critical)</dd></div>
        <div><dt>Conditions met at the time</dt><dd>{decision.conditions_met ? 'Yes' : 'No'}</dd></div>
      </dl>
    </div>
  );
}
