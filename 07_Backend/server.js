require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createAdminRouter, createAuthMiddleware, requireSystemAdmin } = require('./adminRouter');
const { initializeFirebase } = require('./firebase');

function createApp({ auth, db }) {
  if (!auth || !db) {
    throw new Error('Firebase Auth and Realtime Database instances are required.');
  }

  const app = express();
  app.use(cors());
  app.use(express.json());
  // Security middleware for Supply Chain Operators
  const requireOperator = (req, res, next) => {
    if (!req.authUser) return res.status(401).json({ error: 'Unauthorized' });
    
    if (req.authUser.role === 'supply_chain_operator' || req.authUser.supply_chain_operator) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: Requires Supply Chain Operator privileges.' });
  };

  app.get('/api/auth/me', createAuthMiddleware(auth), (req, res) => {
    res.json({
      data: {
        uid: req.authUser.uid,
        email: req.authUser.email || null,
        display_name: req.authUser.name || null,
        role: req.authUser.role || null
      }
    });
  });

  app.use('/api/admin', createAdminRouter(auth));

  app.post('/api/batches', createAuthMiddleware(auth), requireOperator, async (req, res) => {
    try {
      const { produce_type, quantity, source_location } = req.body;

      if (!produce_type || !quantity || !source_location) {
        return res.status(400).json({ error: 'Missing required batch details.' });
      }

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

      await db.ref(`PRODUCE_BATCH/${batch_id}`).set(batchData);

      return res.status(201).json({
        message: 'Produce batch registered successfully.',
        traceability_id: batch_id,
        data: batchData
      });
    } catch (error) {
      console.error('Error registering batch:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/sensor-data', async (req, res) => {
    try {
      const { device_id, batch_id, temperature, humidity } = req.body;

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

      await db.ref(`ENVIRONMENTAL_READING/${batch_id}/${reading_id}`).set(sensorData);

      return res.status(201).json({
        message: 'Sensor data recorded successfully.',
        data: sensorData
      });
    } catch (error) {
      console.error('Error saving sensor data:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body must contain valid JSON.' });
    }

    const statusByCode = {
      'auth/email-already-exists': 409,
      'auth/invalid-display-name': 400,
      'auth/invalid-email': 400,
      'auth/invalid-password': 400,
      'auth/uid-already-exists': 409,
      'auth/user-not-found': 404,
      'auth/uid-not-found': 404
    };
    const status = statusByCode[error.code] || 500;
    console.error('API request failed:', error.code || error.name || 'unknown error');

    return res.status(status).json({
      error: status === 500 ? 'Internal server error.' : 'The requested user operation could not be completed.'
    });
  });

  return app;
}

if (require.main === module) {
  try {
    const { auth, db } = initializeFirebase();
    const app = createApp({ auth, db });
    const port = process.env.PORT || 5000;
    app.listen(port, () => {
      console.log(`Cold Chain Backend running on port ${port}`);
    });
  } catch (error) {
    console.error('Unable to start Cold Chain Backend:', error.message);
    process.exitCode = 1;
  }
}

module.exports = { createApp };
