const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { redirectIfAuthenticated } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');

// Login page
router.get('/login', redirectIfAuthenticated, authController.showLoginPage);

// Login POST - with rate limiting
router.post('/login', authLimiter, authController.login);

// Logout
router.post('/logout', authController.logout);
router.get('/logout', authController.logout);

module.exports = router;
