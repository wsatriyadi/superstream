const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const settingsController = require('../controllers/settingsController');
const { apiLimiter, handleValidationErrors } = require('../middleware/security');

// All settings routes require authentication
router.use(requireAuth);

// Settings page
router.get('/settings', settingsController.renderSettingsPage);

// Update settings - with validation and rate limiting
router.post(
  '/settings',
  apiLimiter,
  [
    body('googleClientId')
      .optional()
      .trim()
      .isLength({ min: 10, max: 500 })
      .withMessage('Google Client ID must be between 10 and 500 characters')
      .matches(/^[a-zA-Z0-9._-]+$/)
      .withMessage('Google Client ID contains invalid characters'),
    body('googleClientSecret')
      .optional()
      .trim()
      .isLength({ min: 10, max: 500 })
      .withMessage('Google Client Secret must be between 10 and 500 characters'),
    body('googleRedirectUri')
      .optional()
      .trim()
      .custom((value) => {
        if (!value) return true; // Allow empty
        // Check if it's a valid URL format
        try {
          const url = new URL(value);
          if (!['http:', 'https:'].includes(url.protocol)) {
            throw new Error('Protocol must be http or https');
          }
          return true;
        } catch (error) {
          throw new Error('Must be a valid URL');
        }
      })
      .withMessage('Google Redirect URI must be a valid URL (http:// or https://)'),
    body('schedulerInterval')
      .optional()
      .isInt({ min: 1, max: 60 })
      .withMessage('Scheduler interval must be between 1 and 60 minutes')
      .toInt(),
    body('maxUploadSize')
      .optional()
      .isInt({ min: 1048576, max: 161061273600 })
      .withMessage('Max upload size must be between 1MB and 150GB')
      .toInt(),
  ],
  handleValidationErrors,
  settingsController.updateSettings
);

// API endpoint to get settings
router.get('/api/settings', apiLimiter, settingsController.getSettings);

module.exports = router;
