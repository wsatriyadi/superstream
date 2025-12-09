const express = require('express');
const router = express.Router();
const setupController = require('../controllers/setupController');
const { csrfProtection } = require('../middleware/security');

// Setup routes (no authentication required)
router.get('/setup', csrfProtection, setupController.showSetupPage);
router.post('/setup', csrfProtection, setupController.createInitialUser);

module.exports = router;
