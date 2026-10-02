import { useNavigate } from 'react-router-dom';

export default function TraceabilityDashboard() {
  const navigate = useNavigate();
  const handleLogout = () => {
    sessionStorage.removeItem('accessToken');
    navigate('/');
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h2>🔍 Traceability & Cold Chain Monitoring</h2>
        <button onClick={handleLogout}>Logout</button>
      </div>
      <hr />
      <p>Module 1: Live Environmental Telemetry (Recharts)</p>
      <p>Module 2: Active Excursion Alerts & Acknowledgement</p>
      <p>Module 3: Verify Blockchain Anchored Records</p>
    </div>
  );
}