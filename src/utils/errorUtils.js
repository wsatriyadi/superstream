const logger = require('../config/logger');

/**
 * Log and throw error with context
 * @param {string} message - Error message
 * @param {Object} context - Additional context for logging
 * @param {Error} originalError - Original error if wrapping
 */
function logAndThrow(message, context = {}, originalError = null) {
  const error = new Error(message);
  
  if (originalError) {
    error.stack = originalError.stack;
    context.originalError = originalError.message;
  }
  
  logger.error(message, { ...context, stack: error.stack });
  throw error;
}

/**
 * Log error without throwing
 * @param {string} message - Error message
 * @param {Object} context - Additional context for logging
 */
function logError(message, context = {}) {
  logger.error(message, context);
}

/**
 * Log warning
 * @param {string} message - Warning message
 * @param {Object} context - Additional context for logging
 */
function logWarning(message, context = {}) {
  logger.warn(message, context);
}

/**
 * Log info
 * @param {string} message - Info message
 * @param {Object} context - Additional context for logging
 */
function logInfo(message, context = {}) {
  logger.info(message, context);
}

/**
 * Wrap async function with error logging
 * @param {Function} fn - Async function to wrap
 * @param {string} operationName - Name of the operation for logging
 */
function withErrorLogging(fn, operationName) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      logger.error(`Error in ${operationName}`, {
        error: error.message,
        stack: error.stack,
        args: JSON.stringify(args),
      });
      throw error;
    }
  };
}

/**
 * Create a standardized error response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {Object} details - Additional error details
 */
function createErrorResponse(message, statusCode = 500, details = null) {
  const response = {
    success: false,
    error: {
      message,
      statusCode,
    },
  };
  
  if (details) {
    response.error.details = details;
  }
  
  return response;
}

/**
 * Create a standardized success response
 * @param {*} data - Response data
 * @param {string} message - Success message
 */
function createSuccessResponse(data, message = 'Success') {
  return {
    success: true,
    message,
    data,
  };
}

module.exports = {
  logAndThrow,
  logError,
  logWarning,
  logInfo,
  withErrorLogging,
  createErrorResponse,
  createSuccessResponse,
};
