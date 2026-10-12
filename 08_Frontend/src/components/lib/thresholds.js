import { useEffect, useState } from 'react';
import api from './api';

// Same slug rules as the backend (07_Backend/coldchain/profiles.js profileKeyFor).
// A batch uses the threshold profile whose key equals the slug of its produce type.
export function produceKey(name) {
  if (typeof name !== 'string') return null;
  const key = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return key || null;
}

// API profile { temperature: {min,max}, humidity: {min,max} } -> the shape the chart and
// range checks use (adds display units).
export function toThresholds(profile) {
  return {
    temperature: { min: profile.temperature.min, max: profile.temperature.max, unit: '°C' },
    humidity: { min: profile.humidity.min, max: profile.humidity.max, unit: '%' }
  };
}

// The limits that apply to one batch, from GET /api/batches/:id/thresholds.
// `thresholds` stays null until loaded (or when unavailable); callers fall back to the
// placeholder defaults, so the page never blocks on this request.
export function useBatchThresholds(batchId) {
  const [state, setState] = useState({ thresholds: null, info: null });

  useEffect(() => {
    if (!batchId) {
      setState({ thresholds: null, info: null });
      return undefined;
    }
    let cancelled = false;
    api.get(`/api/batches/${encodeURIComponent(batchId)}/thresholds`)
      .then((response) => {
        if (!cancelled) setState({ thresholds: toThresholds(response.data.data), info: response.data.data });
      })
      .catch(() => {
        if (!cancelled) setState({ thresholds: null, info: null });
      });
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  return state;
}

const METRIC_LABEL = { temperature: 'Temperature', humidity: 'Humidity' };

// "Temperature above limit"
export function eventLabel(event) {
  return `${METRIC_LABEL[event.metric] || event.metric} ${event.direction} limit`;
}

// The limit that was crossed, e.g. "max 6 °C".
export function crossedLimit(event) {
  return event.direction === 'above'
    ? `max ${event.threshold_max} ${event.unit}`
    : `min ${event.threshold_min} ${event.unit}`;
}

export function eventDurationMs(event) {
  const start = Date.parse(event.started_at);
  const end = Date.parse(event.ended_at || event.last_reading_at);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : null;
}

export function formatDuration(ms) {
  if (ms === null || ms === undefined) return '—';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${seconds % 60} s`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
