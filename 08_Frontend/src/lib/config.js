// Runtime configuration. Both values can be overridden with Vite env variables
// (see .env.example). Neither is a secret; do not put credentials here.

// Base URL of the Express backend.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');

// Public base URL encoded into QR labels. A phone scanning a label must be able to
// reach this address, so on a real deployment (or a LAN demo) set VITE_PUBLIC_BASE_URL
// to the address the web app is served from. Defaults to the current origin.
export function getPublicBaseUrl() {
  const configured = (import.meta.env.VITE_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  return configured || window.location.origin;
}

// The URL encoded in a batch's QR code. Opens the traceability page for that batch
// (after login) via the /trace/:batchId route.
export function getTraceUrl(traceabilityId) {
  return `${getPublicBaseUrl()}/trace/${encodeURIComponent(traceabilityId)}`;
}
