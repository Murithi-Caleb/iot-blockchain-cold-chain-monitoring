import { useEffect, useState } from 'react';
import api, { getErrorMessage } from './api';
import { formatTime } from './format';

// ---------------------------------------------------------------------------
// Telemetry data layer.
//
// Every chart/stat on the traceability screen consumes points of this shape:
//   { timestamp: <ms since epoch>, time: '<label>', temperature: <°C>, humidity: <%> }
//
// There are two interchangeable sources:
//   - useRecordedReadings(batchId)  real readings from GET /api/batches/:id/readings
//   - useSimulatedTelemetry()       browser-generated demo data (clearly labelled)
// Replacing the simulation with live Firebase/ESP32 data later only requires
// swapping the source passed to the UI; the components do not change.
// ---------------------------------------------------------------------------

// PLACEHOLDER operating range for demonstration only. Configurable per-produce
// thresholds are planned for the cold-chain monitoring phase.
export const DEFAULT_THRESHOLDS = Object.freeze({
  temperature: { min: 2, max: 6, unit: '°C' },
  humidity: { min: 85, max: 95, unit: '%' }
});

export const MAX_POINTS = 10;

// 'within' | 'above' | 'below'
export function evaluateValue(value, range) {
  if (value > range.max) return 'above';
  if (value < range.min) return 'below';
  return 'within';
}

export function isExcursion(point, thresholds = DEFAULT_THRESHOLDS) {
  return evaluateValue(point.temperature, thresholds.temperature) !== 'within'
    || evaluateValue(point.humidity, thresholds.humidity) !== 'within';
}

function makePoint(timestamp, temperature, humidity) {
  return { timestamp, time: formatTime(timestamp), temperature, humidity };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Same behaviour as the original simulation (seed values, 5 s tick, small random
// fluctuation, last 10 readings) with the walk bounded so it cannot drift forever.
export function useSimulatedTelemetry({ intervalMs = 5000, enabled = true } = {}) {
  const [points, setPoints] = useState(() => {
    const now = Date.now();
    const seed = [[4.2, 85], [4.5, 86], [4.8, 85], [5.1, 87]];
    return seed.map(([temperature, humidity], index) =>
      makePoint(now - (seed.length - 1 - index) * intervalMs, temperature, humidity));
  });

  useEffect(() => {
    if (!enabled) return undefined;

    const timer = setInterval(() => {
      setPoints((previous) => {
        const last = previous[previous.length - 1];
        const temperature = +clamp(last.temperature + (Math.random() * 0.4 - 0.2), 1, 8).toFixed(2);
        const humidity = +clamp(last.humidity + (Math.random() * 2 - 1), 80, 98).toFixed(2);
        const next = [...previous, makePoint(Date.now(), temperature, humidity)];
        return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs, enabled]);

  return points;
}

// Real, recorded readings for a batch, polled periodically.
export function useRecordedReadings(batchId, { intervalMs = 10000, limit = 60 } = {}) {
  const [state, setState] = useState({ readings: [], loading: Boolean(batchId), error: '', deviceId: null });

  useEffect(() => {
    if (!batchId) {
      setState({ readings: [], loading: false, error: '', deviceId: null });
      return undefined;
    }

    let cancelled = false;

    async function load(isInitial) {
      if (isInitial) {
        setState({ readings: [], loading: true, error: '', deviceId: null });
      }
      try {
        const response = await api.get(`/api/batches/${encodeURIComponent(batchId)}/readings`, {
          params: { limit }
        });
        if (cancelled) return;
        const rows = response.data.data || [];
        setState({
          readings: rows.map((row) =>
            makePoint(Date.parse(row.recorded_at), Number(row.temperature), Number(row.humidity))),
          loading: false,
          error: '',
          deviceId: rows.length > 0 ? rows[rows.length - 1].device_id : null
        });
      } catch (err) {
        if (cancelled) return;
        setState((previous) => ({
          ...previous,
          loading: false,
          error: getErrorMessage(err, 'Could not load environmental readings.')
        }));
      }
    }

    load(true);
    const timer = setInterval(() => load(false), intervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [batchId, intervalMs, limit]);

  return state;
}
