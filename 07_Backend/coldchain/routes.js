'use strict';

const express = require('express');
const { ServiceError, statusForServiceError } = require('../serviceError');
const { DEFAULT_KEY } = require('./profiles');

const BATCH_ID_PATTERN = /^BATCH-\d{1,20}$/;
const EVENT_ID_PATTERN = /^EVENT-\d{1,20}-[TH][AB]$/;
const PROFILE_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;

// Routes (all mounted under /api):
//   GET    /thresholds                                   any application role
//   PUT    /thresholds/:profileKey                       system_admin
//   DELETE /thresholds/:profileKey                       system_admin
//   GET    /events?status=&limit=                        any application role
//   GET    /batches/:batchId/events                      any application role
//   GET    /batches/:batchId/thresholds                  any application role
//   POST   /batches/:batchId/events/:eventId/acknowledge supply_chain_operator
//
// The role middleware is injected from server.js so authorization stays defined in one
// place; this file adds no new way to be authorised.
function createColdChainRouter({ authMiddleware, requireOperator, requireBatchViewer, requireSystemAdmin, coldChain }) {
  const router = express.Router();

  const fail = (res, error) => {
    if (error instanceof ServiceError) {
      return res.status(statusForServiceError(error)).json({ error: error.message });
    }
    console.error('Cold-chain request failed:', error.code || error.name || 'unknown error');
    return res.status(500).json({ error: 'Internal server error' });
  };

  const validBatchId = (req, res, next) => (BATCH_ID_PATTERN.test(req.params.batchId)
    ? next()
    : res.status(400).json({ error: 'Invalid traceability ID format.' }));

  const validProfileKey = (req, res, next) => (PROFILE_KEY_PATTERN.test(req.params.profileKey)
    ? next()
    : res.status(400).json({ error: 'Invalid threshold profile key.' }));

  router.get('/thresholds', authMiddleware, requireBatchViewer, async (req, res) => {
    try {
      return res.json({ data: await coldChain.getThresholds() });
    } catch (error) {
      return fail(res, error);
    }
  });

  router.put('/thresholds/:profileKey', authMiddleware, requireSystemAdmin, validProfileKey, async (req, res) => {
    try {
      const profile = await coldChain.saveProfile(req.params.profileKey, req.body, req.authUser);
      console.info('System administrator action:', {
        action: 'save_threshold_profile',
        actor_uid: req.authUser.uid,
        profile_key: profile.profile_key
      });
      return res.json({ data: profile });
    } catch (error) {
      return fail(res, error);
    }
  });

  router.delete('/thresholds/:profileKey', authMiddleware, requireSystemAdmin, validProfileKey, async (req, res) => {
    try {
      if (req.params.profileKey === DEFAULT_KEY) {
        return res.status(400).json({ error: 'The default profile cannot be deleted. Edit it instead.' });
      }
      await coldChain.deleteProfile(req.params.profileKey);
      console.info('System administrator action:', {
        action: 'delete_threshold_profile',
        actor_uid: req.authUser.uid,
        profile_key: req.params.profileKey
      });
      return res.status(204).end();
    } catch (error) {
      return fail(res, error);
    }
  });

  router.get('/events', authMiddleware, requireBatchViewer, async (req, res) => {
    try {
      const { status, limit } = req.query;
      if (status !== undefined && typeof status !== 'string') {
        return res.status(400).json({ error: 'status must be a string.' });
      }
      const data = await coldChain.listEvents({ status: status || 'all', limit });
      return res.json({ data });
    } catch (error) {
      return fail(res, error);
    }
  });

  router.get('/batches/:batchId/events', authMiddleware, requireBatchViewer, validBatchId, async (req, res) => {
    try {
      return res.json({ data: await coldChain.listBatchEvents(req.params.batchId) });
    } catch (error) {
      return fail(res, error);
    }
  });

  router.get('/batches/:batchId/thresholds', authMiddleware, requireBatchViewer, validBatchId, async (req, res) => {
    try {
      return res.json({ data: await coldChain.getBatchThresholds(req.params.batchId) });
    } catch (error) {
      return fail(res, error);
    }
  });

  router.post(
    '/batches/:batchId/events/:eventId/acknowledge',
    authMiddleware,
    requireOperator,
    validBatchId,
    async (req, res) => {
      try {
        if (!EVENT_ID_PATTERN.test(req.params.eventId)) {
          return res.status(400).json({ error: 'Invalid event ID format.' });
        }
        const note = req.body && typeof req.body === 'object' ? req.body.note : undefined;
        const result = await coldChain.acknowledge(req.params.batchId, req.params.eventId, req.authUser, note);
        return res.json({
          message: result.alreadyAcknowledged ? 'Already acknowledged.' : 'Alert acknowledged.',
          data: result.event
        });
      } catch (error) {
        return fail(res, error);
      }
    }
  );

  return router;
}

module.exports = { EVENT_ID_PATTERN, createColdChainRouter };
