require('dotenv').config();
const express = require('express');
const cors = require('cors');

// 1. Initialize Firebase Admin SDK (Modern Modular Syntax)
const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const serviceAccount = require('./serviceAccountKey.json');

const firebaseApp = initializeApp({
  credential: cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = getDatabase(firebaseApp);
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
// ---------------------------------------------------------
// ENDPOINT 1: Register a Produce Batch & Generate Traceability ID
// ---------------------------------------------------------
app.post('/api/batches', async (req, res) => {
    try {
        const { produce_type, quantity, source_location } = req.body;

        // Validation
        if (!produce_type || !quantity || !source_location) {
            return res.status(400).json({ error: 'Missing required batch details.' });
        }

        // Generate unique Traceability ID
        const batch_id = `BATCH-${Date.now()}`;
        const registration_date = new Date().toISOString();

        const batchData = {
            batch_id,
            produce_type,
            quantity,
            source_location,
            registration_date,
            status: 'In Transit'
        };

        // Save to Firebase
        await db.ref(`PRODUCE_BATCH/${batch_id}`).set(batchData);

        res.status(201).json({
            message: 'Produce batch registered successfully.',
            traceability_id: batch_id,
            data: batchData
        });
    } catch (error) {
        console.error('Error registering batch:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ---------------------------------------------------------
// ENDPOINT 2: Receive IoT Sensor Data from ESP32
// ---------------------------------------------------------
app.post('/api/sensor-data', async (req, res) => {
    try {
        const { device_id, batch_id, temperature, humidity } = req.body;

        // Data Validation (Reject invalid hardware payloads)
        if (!device_id || !batch_id || temperature == null || humidity == null) {
            return res.status(400).json({ error: 'Invalid sensor payload.' });
        }

        if (typeof temperature !== 'number' || typeof humidity !== 'number') {
            return res.status(400).json({ error: 'Sensor values must be numeric.' });
        }

        const reading_id = `READING-${Date.now()}`;
        const recorded_at = new Date().toISOString();

        const sensorData = {
            reading_id,
            device_id,
            batch_id,
            temperature,
            humidity,
            recorded_at
        };

        // Store reading in Firebase nested under the specific batch
        await db.ref(`ENVIRONMENTAL_READING/${batch_id}/${reading_id}`).set(sensorData);

        // Note: Threshold evaluation logic (Objective 1) will be integrated here in the next phase.

        res.status(201).json({
            message: 'Sensor data recorded successfully.',
            data: sensorData
        });
    } catch (error) {
        console.error('Error saving sensor data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Cold Chain Backend running on port ${PORT}`);
});