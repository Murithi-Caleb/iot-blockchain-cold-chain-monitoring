import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Dashboard() {
  const [sensorData, setSensorData] = useState([]);
  const [produceType, setProduceType] = useState('Avocados');
  const [quantity, setQuantity] = useState(500);
  const [sourceLocation, setSourceLocation] = useState("Murang'a Farm");
  const [generatedQrId, setGeneratedQrId] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const batchId = "BATCH-123456789"; 
    const sensorRef = ref(db, `ENVIRONMENTAL_READING/${batchId}`);
    onValue(sensorRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const formattedData = Object.values(data).map(reading => ({
          time: new Date(reading.recorded_at).toLocaleTimeString(),
          Temperature: reading.temperature,
          Humidity: reading.humidity
        }));
        setSensorData(formattedData.slice(-10));
      }
    });
  }, []);

  const handleRegisterBatch = async (e) => {
    e.preventDefault();
    try {
      const token = sessionStorage.getItem('accessToken');
      const response = await axios.post('http://localhost:5000/api/batches', {
        produce_type: produceType,
        quantity: quantity,
        source_location: sourceLocation
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setGeneratedQrId(response.data.traceability_id);
      alert('Batch Registered Successfully!');
    } catch (error) {
      console.error("Error:", error);
      alert('Failed to register batch. Ensure you are an Admin.');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('accessToken');
    navigate('/');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Horticultural Cold Chain Dashboard</h1>
        <button onClick={handleLogout} style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Logout</button>
      </div>
      
      <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', marginTop: '20px' }}>
        <div style={{ flex: '1', minWidth: '400px', backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '8px' }}>
          <h2>Live Environmental Monitoring</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={sensorData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Temperature" stroke="#ff7300" strokeWidth={3} />
              <Line type="monotone" dataKey="Humidity" stroke="#387908" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ flex: '1', minWidth: '300px', backgroundColor: '#f0f8ff', padding: '20px', borderRadius: '8px' }}>
          <h2>Register Produce Batch</h2>
          <form onSubmit={handleRegisterBatch} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label>Produce Type:</label>
            <input value={produceType} onChange={(e) => setProduceType(e.target.value)} required />
            <label>Quantity (Boxes/Kg):</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} required />
            <label>Source Location:</label>
            <input value={sourceLocation} onChange={(e) => setSourceLocation(e.target.value)} required />
            <button type="submit" style={{ padding: '10px', marginTop: '10px', backgroundColor: '#0056b3', color: '#fff', border: 'none', borderRadius: '4px' }}>Register & Generate QR</button>
          </form>

          {generatedQrId && (
            <div style={{ marginTop: '20px', textAlign: 'center', backgroundColor: '#fff', padding: '15px', border: '1px solid #ccc', borderRadius: '8px' }}>
              <h3>Traceability QR Code</h3>
              <QRCodeSVG value={`https://your-system.com/trace/${generatedQrId}`} size={150} />
              <p style={{ fontSize: '12px', color: '#666' }}>ID: {generatedQrId}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}