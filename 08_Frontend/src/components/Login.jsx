import { useEffect, useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import FormField from './ui/FormField';
import { Notice } from './ui/Feedback';
import {
  canAccessPath,
  clearAuthNotice,
  clearToken,
  getSession,
  getUserRole,
  peekAuthNotice,
  ROLE_HOME,
  storeToken
} from '../lib/auth';

const FIREBASE_ERRORS = {
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-login-credentials': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled. Contact a system administrator.',
  'auth/too-many-requests': 'Too many failed attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'Network error. Check your internet connection and try again.'
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Message passed by a route guard or by an expired API session.
  const [notice] = useState(() => location.state?.notice || peekAuthNotice() || '');
  const existingSession = getSession();
  const existingHome = existingSession ? ROLE_HOME[existingSession.role] : null;

  useEffect(() => {
    clearAuthNotice();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // NOTE: 'true' forces a refresh to get the new role immediately
      const token = await userCredential.user.getIdToken(true);
      storeToken(token);

      const role = getUserRole(token);
      const home = ROLE_HOME[role];
      if (!home) {
        // Signed in to Firebase but no application role has been provisioned yet.
        clearToken();
        setError('Your account has no application role assigned yet. Contact a system administrator.');
        return;
      }

      // Return to the page the user originally asked for (for example a scanned QR
      // label) when their role may open it; otherwise go to their own workspace.
      const from = location.state?.from;
      if (from && canAccessPath(role, from.pathname)) {
        navigate(`${from.pathname}${from.search || ''}`, { replace: true });
      } else {
        navigate(home, { replace: true });
      }
    } catch (err) {
      setError(FIREBASE_ERRORS[err.code] || 'Failed to log in. Check your credentials and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <h2>Sign in</h2>
      <p className="panel__description">Use the account provisioned for you by a system administrator.</p>

      <div className="stack" style={{ marginTop: '1.25rem' }}>
        {notice && <Notice variant="warning">{notice}</Notice>}
        {error && <Notice variant="danger">{error}</Notice>}
        {existingHome && (
          <Notice variant="info">
            Already signed in as {existingSession.email}. <Link to={existingHome}>Continue to your workspace</Link>
          </Notice>
        )}
      </div>

      <form onSubmit={handleLogin} className="form-stack">
        <FormField
          id="login-email"
          label="Email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <FormField
          id="login-password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  );
}
