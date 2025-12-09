const logger = require('../config/logger');

/**
 * Error response formatter
 * Creates consistent error response structure
 */
function formatErrorResponse(error, includeStack = false) {
  const response = {
    success: false,
    error: {
      message: error.message || 'An unexpected error occurred',
      type: error.name || 'Error',
    },
  };

  // Add error code if available
  if (error.code) {
    response.error.code = error.code;
  }

  // Add validation errors if available
  if (error.errors) {
    response.error.details = error.errors;
  }

  // Include stack trace in development
  if (includeStack && error.stack) {
    response.error.stack = error.stack;
  }

  return response;
}

/**
 * Custom error classes for different error types
 */
class ValidationError extends Error {
  constructor(message, errors = null) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.errors = errors;
  }
}

class AuthenticationError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
  }
}

class AuthorizationError extends Error {
  constructor(message = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
  }
}

class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class ConflictError extends Error {
  constructor(message = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}

class ExternalServiceError extends Error {
  constructor(message = 'External service error', service = null) {
    super(message);
    this.name = 'ExternalServiceError';
    this.statusCode = 502;
    this.service = service;
  }
}

/**
 * Express error handling middleware
 * Catches all errors and formats them consistently
 */
function errorHandler(err, req, res, next) {
  // Log the error
  const errorContext = {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id,
  };

  // Log based on error severity
  if (err.statusCode && err.statusCode < 500) {
    // Client errors (4xx) - log as warning
    logger.warn('Client error occurred', errorContext);
  } else {
    // Server errors (5xx) - log as error
    logger.error('Server error occurred', errorContext);
  }

  // Determine status code
  const statusCode = err.statusCode || 500;

  // Determine if we should include stack trace
  const includeStack = process.env.NODE_ENV !== 'production';

  // Format error response
  const errorResponse = formatErrorResponse(err, includeStack);

  // Send response
  res.status(statusCode).json(errorResponse);
}

/**
 * 404 Not Found handler
 * Catches requests to undefined routes
 */
function notFoundHandler(req, res, next) {
  const error = new NotFoundError(`Route not found: ${req.method} ${req.url}`);
  next(error);
}

/**
 * Async route handler wrapper
 * Catches errors in async route handlers and passes them to error middleware
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  formatErrorResponse,
  // Export custom error classes
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  ExternalServiceError,
};
