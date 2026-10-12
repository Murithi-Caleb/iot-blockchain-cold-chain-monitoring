import { useCallback, useEffect, useRef, useState } from 'react';
import api, { getErrorMessage } from './api';

// Cold-chain events: for one batch (GET /api/batches/:id/events) or across all batches
// (GET /api/events?status=). Optionally refreshes itself every `intervalMs`.
export default function useEvents({ batchId = null, status = 'all', limit = 100, intervalMs = 0 } = {}) {
  const [state, setState] = useState({ events: [], loading: true, error: '' });
  const latest = useRef(0);

  const load = useCallback(async (silent) => {
    const request = ++latest.current;
    if (!silent) setState((previous) => ({ ...previous, loading: true, error: '' }));
    try {
      const response = batchId
        ? await api.get(`/api/batches/${encodeURIComponent(batchId)}/events`)
        : await api.get('/api/events', { params: { status, limit } });
      if (request === latest.current) setState({ events: response.data.data || [], loading: false, error: '' });
    } catch (error) {
      if (request === latest.current) {
        setState((previous) => ({ ...previous, loading: false, error: getErrorMessage(error, 'Could not load cold-chain events.') }));
      }
    }
  }, [batchId, status, limit]);

  useEffect(() => {
    load(false);
    if (!intervalMs) return undefined;
    const timer = setInterval(() => load(true), intervalMs);
    return () => clearInterval(timer);
  }, [load, intervalMs]);

  return { ...state, reload: () => load(true) };
}
