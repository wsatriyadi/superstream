const rateLimit = require('express-rate-limit');
const csurf = require('csurf');
const { body, validationResult } = require('express-validator');
const logger = require('../config/logger');

/**
 * Rate limiting configurations for different endpoint types
 */

// General API rate limiter - 100 requests per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      success: false,
      errors: ['Too many requests from this IP, please try again later.'],
    });
  },
});

// Strict rate limiter for authentication endpoints - 5 requests per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      username: req.body?.username,
    });
    res.status(429).json({
      success: false,
      errors: ['Too many login attempts, please try again later.'],
    });
  },
});

// Upload rate limiter - 10 uploads per hour
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Too many uploads, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Upload rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.id,
    });
    res.status(429).json({
      success: false,
      errors: ['Too many uploads, please try again later.'],
    });
  },
});

// OAuth rate limiter - 3 attempts per hour
const oauthLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: 'Too many OAuth attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('OAuth rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.id,
    });
    req.flash('error', 'Too many OAuth attempts, please try again later.');
    res.redirect('/channels');
  },
});

/**
 * CSRF Protection middleware
 * Protects against Cross-Site Request Forgery attacks
 */
const csrfProtection = csurf({
  cookie: false, // Use session instead of cookies
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
  value: (req) => {
    // Check multiple sources for CSRF token
    return (
      req.body._csrf ||
      req.query._csrf ||
      req.headers['csrf-token'] ||
      req.headers['xsrf-token'] ||
      req.headers['x-csrf-token'] ||
      req.headers['x-xsrf-token']
    );
  },
});

/**
 * Middleware to add CSRF token to response locals
 * Makes token available in templates
 */
const addCsrfToken = (req, res, next) => {
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : null;
  next();
};

/**
 * CSRF error handler
 * Provides user-friendly error messages for CSRF failures
 */
const csrfErrorHandler = (err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    logger.warn('CSRF token validation failed', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: req.user?.id,
    });

    // Handle API requests differently
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({
        success: false,
        errors: ['Invalid security token. Please refresh the page and try again.'],
      });
    }

    // For page requests, redirect with error message
    req.flash('error', 'Invalid security token. Please try again.');
    return res.redirect('back');
  }
  next(err);
};

/**
 * Input sanitization middleware
 * Sanitizes common user inputs to prevent injection attacks
 */
const sanitizeInput = (req, res, next) => {
  // Sanitize body parameters
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        // Remove null bytes
        req.body[key] = req.body[key].replace(/\0/g, '');
        
        // Trim whitespace
        req.body[key] = req.body[key].trim();
      }
    }
  }

  // Sanitize query parameters
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        // Remove null bytes
        req.query[key] = req.query[key].replace(/\0/g, '');
        
        // Trim whitespace
        req.query[key] = req.query[key].trim();
      }
    }
  }

  next();
};

/**
 * Validation error handler
 * Extracts and formats validation errors from express-validator
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((err) => err.msg);
    
    logger.warn('Validation errors', {
      path: req.path,
      errors: errorMessages,
      userId: req.user?.id,
    });

    // Handle API requests
    if (req.path.startsWith('/api/')) {
      return res.status(400).json({
        success: false,
        errors: errorMessages,
      });
    }

    // For page requests, redirect with error messages
    errorMessages.forEach((msg) => req.flash('error', msg));
    return res.redirect('back');
  }

  next();
};

module.exports = {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  oauthLimiter,
  csrfProtection,
  addCsrfToken,
  csrfErrorHandler,
  sanitizeInput,
  handleValidationErrors,
};
