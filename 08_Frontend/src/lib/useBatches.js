import { useCallback, useEffect, useState } from 'react';
import api, { getErrorMessage } from './api';

// Loads the batch list from GET /api/batches (newest first, capped by the backend).
export default function useBatches() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/api/batches');
      setBatches(response.data.data || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load produce batches.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { batches, loading, error, reload };
}
