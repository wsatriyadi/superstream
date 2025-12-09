const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');
const historyController = require('../controllers/historyController');

// All routes require authentication
router.use(requireAuth);

// History page
router.get('/history', historyController.getHistoryPage);

// API routes
router.get('/api/history', apiLimiter, historyController.getHistory);
router.get('/api/history/statistics', apiLimiter, historyController.getStatistics);
router.delete('/api/history/:id', apiLimiter, historyController.deleteHistory);

module.exports = router;
