/**
 * Middleware to check if user is authenticated
 * Redirects to login page if not authenticated
 */
const requireAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  
  // Return JSON for API requests
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({
      success: false,
      errors: ['Authentication required. Please log in again.']
    });
  }
  
  // Store the original URL for redirect after login
  req.session.returnTo = req.originalUrl;
  res.redirect('/login');
};

/**
 * Middleware to check if user is already authenticated
 * Redirects to dashboard if authenticated (for login/register pages)
 */
const redirectIfAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  next();
};

module.exports = {
  requireAuth,
  redirectIfAuthenticated,
};
