const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const streamController = require('../controllers/streamController');
const { apiLimiter } = require('../middleware/security');

// All stream routes require authentication
router.use(requireAuth);

// Page routes
router.get('/live', streamController.renderLivePage);

// API routes - with rate limiting
router.get('/api/streams/active', apiLimiter, streamController.getActiveStreams);
router.get('/api/streams/:streamId', apiLimiter, streamController.getStreamById);
router.post('/api/streams/:streamId/stop', apiLimiter, streamController.stopStream);

module.exports = router;
