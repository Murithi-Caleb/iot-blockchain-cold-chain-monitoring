import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const handleLogout = () => {
    sessionStorage.removeItem('accessToken');
    navigate('/');
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h2>⚙️ Admin Control Panel</h2>
        <button onClick={handleLogout}>Logout</button>
      </div>
      <hr />
      <p>Module 1: User & Role Management</p>
      <p>Module 2: Device Provisioning (ESP32/DHT22 Registration)</p>
      <p>Module 3: Threshold Profile Configuration (e.g., Avocados 2-6°C)</p>
    </div>
  );
}