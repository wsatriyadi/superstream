const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const channelController = require('../controllers/channelController');
const { apiLimiter, oauthLimiter } = require('../middleware/security');

// All channel routes require authentication
router.use(requireAuth);

// OAuth routes - with strict rate limiting
router.get('/channels/connect', oauthLimiter, channelController.initiateOAuth);
router.get('/channels/oauth/callback', oauthLimiter, channelController.handleOAuthCallback);

// Page routes
router.get('/dashboard', channelController.renderDashboard);
router.get('/channels', channelController.renderChannelsPage);

// API routes - with rate limiting
router.get('/api/channels', apiLimiter, channelController.getChannels);
router.get('/api/channels/:id', apiLimiter, channelController.getChannel);
router.put('/api/channels/:id/settings', apiLimiter, channelController.updateChannelSettings);
router.delete('/api/channels/:id', apiLimiter, channelController.deleteChannel);

module.exports = router;
