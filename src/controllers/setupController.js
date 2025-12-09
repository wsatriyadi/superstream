const User = require('../models/User');
const logger = require('../config/logger');

/**
 * Check if setup is needed (no users exist)
 */
const isSetupNeeded = async () => {
  try {
    const userCount = await User.countDocuments();
    return userCount === 0;
  } catch (error) {
    logger.error('Error checking setup status', { error: error.message });
    return false;
  }
};

/**
 * Display setup page
 */
const showSetupPage = async (req, res) => {
  try {
    const setupNeeded = await isSetupNeeded();
    
    if (!setupNeeded) {
      // Setup already completed, redirect to login
      return res.redirect('/login');
    }

    res.render('setup', {
      title: 'First Time Setup - Super Stream',
      error: req.flash('error'),
      csrfToken: req.csrfToken ? req.csrfToken() : null,
    });
  } catch (error) {
    logger.error('Error displaying setup page', { error: error.message });
    res.status(500).send('Server error');
  }
};

/**
 * Handle setup form submission
 */
const createInitialUser = async (req, res) => {
  try {
    const setupNeeded = await isSetupNeeded();
    
    if (!setupNeeded) {
      // Setup already completed
      req.flash('error', 'Setup has already been completed.');
      return res.redirect('/login');
    }

    const { username, password, confirmPassword } = req.body;

    // Validate input
    if (!username || !password || !confirmPassword) {
      req.flash('error', 'All fields are required.');
      return res.redirect('/setup');
    }

    // Validate username format
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      req.flash('error', 'Username must be 3-20 characters and contain only letters, numbers, and underscores.');
      return res.redirect('/setup');
    }

    // Validate password length
    if (password.length < 6) {
      req.flash('error', 'Password must be at least 6 characters long.');
      return res.redirect('/setup');
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match.');
      return res.redirect('/setup');
    }

    // Create the first user
    const user = new User({
      username,
      passwordHash: password, // Will be hashed by the pre-save hook
    });

    await user.save();

    logger.info('Initial admin user created', { username });

    // Redirect to login with success message
    req.flash('success', 'Admin account created successfully! Please log in.');
    res.redirect('/login');
  } catch (error) {
    logger.error('Error creating initial user', { 
      error: error.message,
      stack: error.stack 
    });

    if (error.code === 11000) {
      req.flash('error', 'Username already exists.');
    } else {
      req.flash('error', 'An error occurred during setup. Please try again.');
    }
    
    res.redirect('/setup');
  }
};

module.exports = {
  isSetupNeeded,
  showSetupPage,
  createInitialUser,
};
