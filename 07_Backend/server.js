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

  // Read-only batch access: any provisioned application role may view batches.
  // Writing a batch stays operator-only (requireOperator above).
  const requireBatchViewer = (req, res, next) => {
    if (!req.authUser) return res.status(401).json({ error: 'Unauthorized' });

    const viewerRoles = ['system_admin', 'supply_chain_operator', 'authorized_traceability_user'];
    if (viewerRoles.some((role) => req.authUser.role === role || req.authUser[role] === true)) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: No application role assigned.' });
  };

  // Batch IDs are generated server-side as BATCH-<timestamp>; reject anything else
  // before it is used as a Realtime Database path segment.
  const BATCH_ID_PATTERN = /^BATCH-\d{1,20}$/;
  const MAX_LISTED_BATCHES = 200;
  const DEFAULT_READINGS = 50;
  const MAX_READINGS = 500;

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

  // List registered batches, newest first (capped). Read-only.
  app.get('/api/batches', createAuthMiddleware(auth), requireBatchViewer, async (req, res) => {
    try {
      const snapshot = await db.ref('PRODUCE_BATCH').once('value');
      const batches = Object.values(snapshot.val() || {})
        .sort((a, b) => String(b.registration_date).localeCompare(String(a.registration_date)))
        .slice(0, MAX_LISTED_BATCHES);

      return res.json({ data: batches });
    } catch (error) {
      console.error('Error listing batches:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Look up a single batch by its traceability ID. Read-only.
  app.get('/api/batches/:batchId', createAuthMiddleware(auth), requireBatchViewer, async (req, res) => {
    try {
      const { batchId } = req.params;
      if (!BATCH_ID_PATTERN.test(batchId)) {
        return res.status(400).json({ error: 'Invalid traceability ID format.' });
      }

      const snapshot = await db.ref(`PRODUCE_BATCH/${batchId}`).once('value');
      const batch = snapshot.val();
      if (!batch) {
        return res.status(404).json({ error: 'No batch found for that traceability ID.' });
      }

      return res.json({ data: batch });
    } catch (error) {
      console.error('Error reading batch:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Most recent environmental readings for a batch (oldest to newest). Read-only.
  app.get('/api/batches/:batchId/readings', createAuthMiddleware(auth), requireBatchViewer, async (req, res) => {
    try {
      const { batchId } = req.params;
      if (!BATCH_ID_PATTERN.test(batchId)) {
        return res.status(400).json({ error: 'Invalid traceability ID format.' });
      }

      const requested = Number.parseInt(req.query.limit, 10);
      const limit = Number.isInteger(requested) && requested > 0
        ? Math.min(requested, MAX_READINGS)
        : DEFAULT_READINGS;

      // Reading keys are READING-<epoch ms>, so key order is chronological.
      const snapshot = await db
        .ref(`ENVIRONMENTAL_READING/${batchId}`)
        .orderByKey()
        .limitToLast(limit)
        .once('value');
      const readings = Object.values(snapshot.val() || {})
        .sort((a, b) => String(a.recorded_at).localeCompare(String(b.recorded_at)));

      return res.json({ data: readings });
    } catch (error) {
      console.error('Error reading environmental readings:', error);
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
