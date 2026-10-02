import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function TraceabilityDashboard() {
  const navigate = useNavigate();
  const [telemetry, setTelemetry] = useState([
    { time: '00:00', temperature: 4.2, humidity: 85 },
    { time: '00:05', temperature: 4.5, humidity: 86 },
    { time: '00:10', temperature: 4.8, humidity: 85 },
    { time: '00:15', temperature: 5.1, humidity: 87 },
  ]);

  const handleLogout = () => {
    sessionStorage.removeItem('accessToken');
    navigate('/');
  };

  // Simulate incoming IoT data from the ESP32
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry((prev) => {
        const lastEntry = prev[prev.length - 1];
        const newTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        // Add slight random fluctuations to simulate real sensors
        const newTemp = +(lastEntry.temperature + (Math.random() * 0.4 - 0.2)).toFixed(2);
        const newHum = +(lastEntry.humidity + (Math.random() * 2 - 1)).toFixed(2);
        
        const newData = [...prev, { time: newTime, temperature: newTemp, humidity: newHum }];
        return newData.length > 10 ? newData.slice(1) : newData; // Keep last 10 readings
      });
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '30px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
        <h2>🔍 Traceability & Cold Chain Monitoring</h2>
        <button onClick={handleLogout} style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Logout</button>
      </div>

      <div style={{ marginTop: '20px', backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Live Environmental Telemetry</h3>
          <span style={{ padding: '5px 10px', backgroundColor: '#198754', color: 'white', borderRadius: '15px', fontSize: '12px' }}>
            🟢 Active Transit: BATCH-1790981450938
          </span>
        </div>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>Monitoring ESP32/DHT22 Data Stream</p>
        
        <div style={{ width: '100%', height: 400, backgroundColor: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={telemetry} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis yAxisId="left" domain={['dataMin - 2', 'dataMax + 2']} label={{ value: 'Temp (°C)', angle: -90, position: 'insideLeft' }} />
              <YAxis yAxisId="right" orientation="right" domain={['dataMin - 5', 'dataMax + 5']} label={{ value: 'Humidity (%)', angle: 90, position: 'insideRight' }} />
              <Tooltip />
              <Legend />
              {/* Target threshold range for Avocados (e.g., 2°C to 6°C) */}
              <Line yAxisId="left" type="monotone" dataKey="temperature" stroke="#dc3545" strokeWidth={3} activeDot={{ r: 8 }} name="Temperature °C" />
              <Line yAxisId="right" type="monotone" dataKey="humidity" stroke="#0d6efd" strokeWidth={2} name="Humidity %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}