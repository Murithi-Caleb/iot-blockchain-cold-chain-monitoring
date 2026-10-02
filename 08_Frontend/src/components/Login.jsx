import { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate, Link } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const token = await userCredential.user.getIdToken();
      sessionStorage.setItem('accessToken', token);
      
      // Decode and route intelligently
      const decoded = jwtDecode(token);
      if (decoded.system_admin) {
        navigate('/admin');
      } else if (decoded.supply_chain_operator) {
        navigate('/operator');
      } else if (decoded.authorized_traceability_user) {
        navigate('/traceability');
      } else {
        // Fallback for standard users with no custom claims yet
        alert("Account pending role assignment.");
      }
    } catch (err) {
    setError('Failed to log in. Check your credentials.');
    }
  };

   return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>System Login</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" style={{ padding: '10px', backgroundColor: '#0056b3', color: '#fff', border: 'none', borderRadius: '4px' }}>Log In</button>
      </form>
      <p style={{ marginTop: '15px' }}>No account? <Link to="/signup">Sign Up</Link></p>
    </div>
  );
}

    