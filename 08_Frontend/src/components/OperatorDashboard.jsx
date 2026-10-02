import { useNavigate } from 'react-router-dom';

export default function OperatorDashboard() {
  const navigate = useNavigate();
  const handleLogout = () => {
    sessionStorage.removeItem('accessToken');
    navigate('/');
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h2>📦 Supply Chain Operator Workspace</h2>
        <button onClick={handleLogout}>Logout</button>
      </div>
      <hr />
      <p>Module 1: Produce Batch Registration</p>
      <p>Module 2: Generate & Print Traceability QR Code</p>
      <p>Module 3: Assign IoT Device to Batch</p>
    </div>
  );
}