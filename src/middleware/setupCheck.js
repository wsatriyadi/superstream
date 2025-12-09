const { isSetupNeeded } = require('../controllers/setupController');

/**
 * Middleware to check if initial setup is needed
 * Redirects to setup page if no users exist in the database
 */
const checkSetup = async (req, res, next) => {
  // Skip setup check for setup routes and static assets
  if (
    req.path === '/setup' || 
    req.path.startsWith('/css/') || 
    req.path.startsWith('/js/') ||
    req.path.startsWith('/images/')
  ) {
    return next();
  }

  try {
    const setupNeeded = await isSetupNeeded();
    
    if (setupNeeded) {
      // Redirect to setup page
      return res.redirect('/setup');
    }
    
    // Setup completed, continue
    next();
  } catch (error) {
    // If there's an error checking setup status, continue anyway
    // to avoid blocking the application
    next();
  }
};

module.exports = checkSetup;
