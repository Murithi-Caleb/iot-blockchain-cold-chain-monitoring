'use strict';

const express = require('express');
const { ServiceError, statusForServiceError } = require('../serviceError');

const BATCH_ID_PATTERN = /^BATCH-\d{1,20}$/;

// Routes (mounted under /api):
//   GET  /batches/:batchId/compliance   any application role: the decision, or the checks
//   POST /batches/:batchId/compliance   authorized_traceability_user: accept or reject
//
// `onDecided(record)` is called after a decision is stored (the server uses it to start
// blockchain anchoring in the background). Role middleware is injected from server.js.
function createComplianceRouter({ authMiddleware, requireBatchViewer, requireTraceabilityUser, compliance, onDecided }) {
  const router = express.Router();

  const fail = (res, error) => {
    if (error instanceof ServiceError) {
      return res.status(statusForServiceError(error)).json({
        error: error.message,
        ...(error.details ? { details: error.details } : {})
      });
    }
    console.error('Compliance request failed:', error.code || error.name || 'unknown error');
    return res.status(500).json({ error: 'Internal server error' });
  };

  const validBatchId = (req, res, next) => (BATCH_ID_PATTERN.test(req.params.batchId)
    ? next()
    : res.status(400).json({ error: 'Invalid traceability ID format.' }));

  router.get('/batches/:batchId/compliance', authMiddleware, requireBatchViewer, validBatchId, async (req, res) => {
    try {
      return res.json({ data: await compliance.getCompliance(req.params.batchId) });
    } catch (error) {
      return fail(res, error);
    }
  });

  router.post('/batches/:batchId/compliance', authMiddleware, requireTraceabilityUser, validBatchId, async (req, res) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const record = await compliance.decide(req.params.batchId, req.authUser, {
        decision: body.decision,
        note: body.note
      });
      console.info('Compliance decision:', {
        batch_id: record.batch_id,
        decision: record.decision,
        actor_uid: req.authUser.uid
      });
      if (onDecided) onDecided(record);
      return res.status(201).json({
        message: record.decision === 'accepted' ? 'Certificate of compliance issued.' : 'Batch rejected.',
        data: record
      });
    } catch (error) {
      return fail(res, error);
    }
  });

  return router;
}

module.exports = { createComplianceRouter };
