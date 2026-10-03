import { useState } from 'react';
import { auth } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useNavigate, Link } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import FormField from './ui/FormField';
import { Notice } from './ui/Feedback';

// Kept for development convenience. Accounts created here have NO application role
// and cannot open any workspace until a system administrator assigns one. The login
// page deliberately no longer links here; production accounts are provisioned by an
// administrator from the admin workspace.
export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err) {
      setError('Failed to create account: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <h2>Create account</h2>
      <p className="panel__description">
        New accounts have no access until a system administrator assigns a role.
      </p>

      {error && (
        <div style={{ marginTop: '1.25rem' }}>
          <Notice variant="danger">{error}</Notice>
        </div>
      )}

      <form onSubmit={handleSignup} className="form-stack">
        <FormField
          id="signup-email"
          label="Email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <FormField
          id="signup-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 6 characters."
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="auth__alt">
        Already have an account? <Link to="/">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
