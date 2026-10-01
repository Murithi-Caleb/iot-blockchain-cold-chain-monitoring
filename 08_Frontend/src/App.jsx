import { useState, useEffect } from 'react';
import { db } from './firebase';
import { ref, onValue } from 'firebase/database';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';
import './App.css';

function App() {
  const [sensorData, setSensorData] = useState([]);
  
  // Batch Registration State
  const [produceType, setProduceType] = useState('Avocados');
  const [quantity, setQuantity] = useState(500);
  const [sourceLocation, setSourceLocation] = useState("Murang'a Farm");
  const [generatedQrId, setGeneratedQrId] = useState('');

  // 1. Fetch Live IoT Data from Firebase
  useEffect(() => {
    // We are listening to the exact BATCH_ID used by your mockSensor.js
    const batchId = "BATCH-123456789"; 
    const sensorRef = ref(db, `ENVIRONMENTAL_READING/${batchId}`);

    onValue(sensorRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Convert Firebase object to an array for Recharts
        const formattedData = Object.values(data).map(reading => ({
          time: new Date(reading.recorded_at).toLocaleTimeString(),
          Temperature: reading.temperature,
          Humidity: reading.humidity
        }));
        
        // Keep only the latest 10 readings for a clean graph
        setSensorData(formattedData.slice(-10));
      }
    });
  }, []);

  // 2. Handle Batch Registration
  const handleRegisterBatch = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5000/api/batches', {
        produce_type: produceType,
        quantity: quantity,
        source_location: sourceLocation
      });
      
      // Set the returned ID to generate the QR Code
      setGeneratedQrId(response.data.traceability_id);
      alert('Batch Registered Successfully!');
    } catch (error) {
      console.error("Error registering batch:", error);
      alert('Failed to register batch.');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Horticultural Cold Chain Dashboard</h1>
      
      <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
        
        {/* LEFT COLUMN: Live Environmental Graph */}
        <div style={{ flex: '1', minWidth: '400px', backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '8px' }}>
          <h2>Live Environmental Monitoring</h2>
          <p><strong>Tracking Batch:</strong> BATCH-123456789</p>
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

        {/* RIGHT COLUMN: Batch Registration & QR Generation */}
        <div style={{ flex: '1', minWidth: '300px', backgroundColor: '#f0f8ff', padding: '20px', borderRadius: '8px' }}>
          <h2>Register Produce Batch</h2>
          <form onSubmit={handleRegisterBatch} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label>Produce Type:</label>
            <input value={produceType} onChange={(e) => setProduceType(e.target.value)} required />
            
            <label>Quantity (Boxes/Kg):</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} required />
            
            <label>Source Location:</label>
            <input value={sourceLocation} onChange={(e) => setSourceLocation(e.target.value)} required />
            
            <button type="submit" style={{ padding: '10px', marginTop: '10px', backgroundColor: '#0056b3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Register & Generate QR
            </button>
          </form>

          {/* Render QR Code if Registration is Successful */}
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

export default App;