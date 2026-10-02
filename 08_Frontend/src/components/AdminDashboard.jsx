import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('supply_chain_operator');
  const [message, setMessage] = useState('');

  const handleLogout = () => {
    sessionStorage.removeItem('accessToken');
    navigate('/');
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const token = sessionStorage.getItem('accessToken');
      await axios.post('http://localhost:5000/api/admin/users', {
        email: email,
        password: password,
        role: role,
        display_name: role // Optional field supported by the backend
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMessage(`✅ Successfully created account for ${email} as ${role}`);
      setEmail('');
      setPassword('');
    } catch (error) {
      console.error(error);
      setMessage(`❌ Failed to create user: ${error.response?.data?.error || error.message}`);
    }
  };

  return (
    <div style={{ padding: '30px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
        <h2>⚙️ Admin Control Panel</h2>
        <button onClick={handleLogout} style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px' }}>Logout</button>
      </div>
      
      <div style={{ marginTop: '20px', backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px' }}>
        <h3>Module 1: User & Role Management</h3>
        <p style={{ fontSize: '14px', color: '#666' }}>Provision accounts for Supply Chain Operators and Traceability Users.</p>
        
        {message && <p style={{ fontWeight: 'bold', color: message.startsWith('✅') ? 'green' : 'red' }}>{message}</p>}
        
        <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '400px', marginTop: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>User Email:</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Temporary Password (Min 6 chars):</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength="6" style={{ width: '100%', padding: '8px' }} />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Assign System Role:</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%', padding: '8px' }}>
              <option value="supply_chain_operator">Supply Chain Operator (Warehouse/Dispatch)</option>
              <option value="authorized_traceability_user">Traceability User (Customs/Importer)</option>
            </select>
          </div>
          
          <button type="submit" style={{ padding: '10px', backgroundColor: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', marginTop: '10px' }}>
            Provision User Account
          </button>
        </form>
      </div>

      <div style={{ marginTop: '20px', opacity: '0.6' }}>
        <h3>Module 2: Device Provisioning</h3>
        <p><em>(Hardware registration pipeline to be implemented)</em></p>
        
        <h3>Module 3: Threshold Profile Configuration</h3>
        <p><em>(Temperature limit configuration to be implemented)</em></p>
      </div>
    </div>
  );
}