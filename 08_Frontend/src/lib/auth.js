import { jwtDecode } from 'jwt-decode';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

export const ROLES = Object.freeze({
  ADMIN: 'system_admin',
  OPERATOR: 'supply_chain_operator',
  TRACEABILITY: 'authorized_traceability_user'
});

export const ROLE_LABELS = Object.freeze({
  [ROLES.ADMIN]: 'System Administrator',
  [ROLES.OPERATOR]: 'Supply Chain Operator',
  [ROLES.TRACEABILITY]: 'Traceability User'
});

export const ROLE_HOME = Object.freeze({
  [ROLES.ADMIN]: '/admin',
  [ROLES.OPERATOR]: '/operator',
  [ROLES.TRACEABILITY]: '/traceability'
});

const TOKEN_KEY = 'accessToken';
const NOTICE_KEY = 'authNotice';

export function getStoredToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable; nothing to clear.
  }
}

// One-line message shown on the login page (for example after a session expires).
export function setAuthNotice(message) {
  try {
    sessionStorage.setItem(NOTICE_KEY, message);
  } catch {
    // Non-essential.
  }
}

export function peekAuthNotice() {
  try {
    return sessionStorage.getItem(NOTICE_KEY);
  } catch {
    return null;
  }
}

export function clearAuthNotice() {
  try {
    sessionStorage.removeItem(NOTICE_KEY);
  } catch {
    // Non-essential.
  }
}

export function decodeToken(token) {
  try {
    return jwtDecode(token);
  } catch {
    return null;
  }
}

// Extract the application role from a Firebase ID token. Supports a `role` string
// claim (set by the backend admin API) and the legacy boolean claims.
// This logic is intentionally identical to the original App.jsx helper.
export function getUserRole(token) {
  const decoded = decodeToken(token);
  if (!decoded) return null;

  if (decoded.role) return decoded.role;
  if (decoded.system_admin) return ROLES.ADMIN;
  if (decoded.supply_chain_operator) return ROLES.OPERATOR;
  if (decoded.authorized_traceability_user) return ROLES.TRACEABILITY;

  return null;
}

export function isTokenExpired(token) {
  const decoded = decodeToken(token);
  return !decoded || (typeof decoded.exp === 'number' && decoded.exp * 1000 <= Date.now());
}

// The current signed-in session derived from the stored token, or null.
export function getSession() {
  const token = getStoredToken();
  if (!token || isTokenExpired(token)) return null;

  const decoded = decodeToken(token);
  return {
    token,
    uid: decoded.user_id || decoded.sub || null,
    email: decoded.email || null,
    name: decoded.name || null,
    role: getUserRole(token)
  };
}

// Route-level access map used to decide where a user may be sent after login.
// Frontend checks are a convenience only: the backend enforces authorization.
export function canAccessPath(role, pathname) {
  if (!role || !pathname) return false;
  if (pathname.startsWith('/trace/')) return Object.values(ROLES).includes(role);
  return ROLE_HOME[role] === pathname;
}

export async function logout() {
  clearToken();
  try {
    await signOut(auth);
  } catch {
    // The local session is already cleared; a failed remote sign-out is not blocking.
  }
}
