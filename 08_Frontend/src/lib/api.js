import axios from 'axios';
import { API_BASE_URL } from './config';
import { clearToken, getStoredToken, setAuthNotice } from './auth';

// Shared axios client. Attaches the Firebase ID token stored at login as a Bearer
// token (same contract as before: Authorization: Bearer <token>).
const api = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A 401 means the stored ID token is missing, expired or revoked. Send the user back
// to the login page instead of leaving them on a screen that can no longer load data.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      setAuthNotice('Your session has expired. Please sign in again.');
      window.location.assign('/');
    }
    return Promise.reject(error);
  }
);

// Turn an axios error into a message that is safe and useful to show the user.
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.response?.data?.error) return error.response.data.error;
  if (error?.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.';
  if (error?.request && !error.response) {
    return 'Cannot reach the server. Check your connection and that the backend is running.';
  }
  return fallback;
}

export default api;
