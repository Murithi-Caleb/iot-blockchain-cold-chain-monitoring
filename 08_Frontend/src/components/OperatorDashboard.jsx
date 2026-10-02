import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';

export default function OperatorDashboard() {
  const navigate = useNavigate();
  const [produceType, setProduceType] = useState('Avocados');
  const [quantity, setQuantity] = useState(500);
  const [sourceLocation, setSourceLocation] = useState("Murang'a Farm");
  const [generatedQrId, setGeneratedQrId] = useState('');

  const handleLogout = () => {
    sessionStorage.removeItem('accessToken');
    navigate('/');
  };

  const handleRegisterBatch = async (e) => {
    e.preventDefault();
    try {
      const token = sessionStorage.getItem('accessToken');
      // This routes to the backend endpoint to log the physical batch
      const response = await axios.post('http://localhost:5000/api/batches', {
        produce_type: produceType,
        quantity: quantity,
        source_location: sourceLocation
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // The backend should return a unique traceability ID for the QR code
      setGeneratedQrId(response.data.traceability_id || `BATCH-${Math.floor(Math.random() * 100000)}`);
      alert('✅ Produce Batch Registered Successfully!');
    } catch (error) {
      console.error("Error:", error);
      alert('❌ Failed to register batch. Check terminal for details.');
    }
  };

  return (
    <div style={{ padding: '30px', maxWidth: '900px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
        <h2>📦 Supply Chain Operator Workspace</h2>
        <button onClick={handleLogout} style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Logout</button>
      </div>

      <div style={{ display: 'flex', gap: '30px', marginTop: '20px', flexWrap: 'wrap' }}>
        
        {/* Module 1: Batch Registration Form */}
        <div style={{ flex: '1', minWidth: '350px', backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px' }}>
          <h3>Module 1: Produce Batch Registration</h3>
          <p style={{ fontSize: '14px', color: '#666' }}>Enter the physical details of the cargo being dispatched.</p>
          
          <form onSubmit={handleRegisterBatch} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px' }}>Produce Type:</label>
              <input value={produceType} onChange={(e) => setProduceType(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '5px' }}>Quantity (Boxes/Kg):</label>
              <input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} required style={{ width: '100%', padding: '8px' }} />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '5px' }}>Source Location:</label>
              <input value={sourceLocation} onChange={(e) => setSourceLocation(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
            </div>
            
            <button type="submit" style={{ padding: '10px', backgroundColor: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', marginTop: '10px', cursor: 'pointer' }}>
              Register Batch & Generate QR
            </button>
          </form>
        </div>

        {/* Module 2: QR Code Generation */}
        <div style={{ flex: '1', minWidth: '300px', backgroundColor: '#e9ecef', padding: '20px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h3>Module 2: Traceability QR</h3>
          
          {generatedQrId ? (
            <div style={{ marginTop: '20px', textAlign: 'center', backgroundColor: '#fff', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
              <QRCodeSVG value={`https://your-system.com/trace/${generatedQrId}`} size={180} />
              <p style={{ marginTop: '15px', fontWeight: 'bold', letterSpacing: '1px' }}>ID: {generatedQrId}</p>
              <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>Print and attach to pallet.</p>
            </div>
          ) : (
            <p style={{ color: '#666', textAlign: 'center', marginTop: '20px' }}>
              Awaiting batch registration.<br/>Fill out the form to generate the label.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}