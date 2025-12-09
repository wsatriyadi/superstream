const path = require('path');

/**
 * Sanitize file path to prevent directory traversal attacks
 * @param {string} filePath - The file path to sanitize
 * @returns {string} Sanitized file path
 */
function sanitizeFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path');
  }

  // Remove null bytes
  filePath = filePath.replace(/\0/g, '');

  // Normalize the path to resolve .. and .
  const normalized = path.normalize(filePath);

  // Check for directory traversal attempts
  if (normalized.includes('..') || normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
    throw new Error('Invalid file path: directory traversal detected');
  }

  return normalized;
}

/**
 * Sanitize filename to prevent injection and path traversal
 * @param {string} filename - The filename to sanitize
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Invalid filename');
  }

  // Remove null bytes
  filename = filename.replace(/\0/g, '');

  // Remove path separators
  filename = filename.replace(/[/\\]/g, '');

  // Remove potentially dangerous characters
  filename = filename.replace(/[<>:"|?*]/g, '');

  // Limit length
  if (filename.length > 255) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    filename = base.substring(0, 255 - ext.length) + ext;
  }

  return filename;
}

/**
 * Validate and sanitize RTMP URL
 * @param {string} rtmpUrl - The RTMP URL to validate
 * @returns {string} Sanitized RTMP URL
 */
function sanitizeRtmpUrl(rtmpUrl) {
  if (!rtmpUrl || typeof rtmpUrl !== 'string') {
    throw new Error('Invalid RTMP URL');
  }

  // Remove null bytes and whitespace
  rtmpUrl = rtmpUrl.replace(/\0/g, '').trim();

  // Validate RTMP URL format
  const rtmpPattern = /^rtmps?:\/\/[a-zA-Z0-9.-]+(?::\d+)?(?:\/[a-zA-Z0-9._-]+)*$/;
  if (!rtmpPattern.test(rtmpUrl)) {
    throw new Error('Invalid RTMP URL format');
  }

  return rtmpUrl;
}

/**
 * Validate and sanitize stream key
 * @param {string} streamKey - The stream key to validate
 * @returns {string} Sanitized stream key
 */
function sanitizeStreamKey(streamKey) {
  if (!streamKey || typeof streamKey !== 'string') {
    throw new Error('Invalid stream key');
  }

  // Remove null bytes and whitespace
  streamKey = streamKey.replace(/\0/g, '').trim();

  // Stream keys should only contain alphanumeric characters, hyphens, and underscores
  const streamKeyPattern = /^[a-zA-Z0-9_-]+$/;
  if (!streamKeyPattern.test(streamKey)) {
    throw new Error('Invalid stream key format');
  }

  // Limit length (YouTube stream keys are typically 20-40 characters)
  if (streamKey.length < 10 || streamKey.length > 100) {
    throw new Error('Invalid stream key length');
  }

  return streamKey;
}

/**
 * Validate loop count parameter
 * @param {number|string} loopCount - The loop count to validate
 * @returns {number} Validated loop count
 */
function validateLoopCount(loopCount) {
  const count = parseInt(loopCount, 10);

  if (isNaN(count) || count < 1 || count > 100) {
    throw new Error('Loop count must be between 1 and 100');
  }

  return count;
}

/**
 * Validate video file MIME type
 * @param {string} mimeType - The MIME type to validate
 * @returns {boolean} True if valid video MIME type
 */
function isValidVideoMimeType(mimeType) {
  const allowedMimeTypes = [
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
    'video/webm',
    'video/x-flv',
    'video/3gpp',
  ];

  return allowedMimeTypes.includes(mimeType);
}

/**
 * Validate file extension
 * @param {string} filename - The filename to check
 * @returns {boolean} True if valid video extension
 */
function hasValidVideoExtension(filename) {
  const allowedExtensions = ['.mp4', '.mpeg', '.mpg', '.mov', '.avi', '.mkv', '.webm', '.flv', '.3gp'];
  const ext = path.extname(filename).toLowerCase();
  return allowedExtensions.includes(ext);
}

/**
 * Sanitize text input to prevent XSS
 * @param {string} text - The text to sanitize
 * @returns {string} Sanitized text
 */
function sanitizeText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Remove null bytes
  text = text.replace(/\0/g, '');

  // Remove control characters except newlines and tabs
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return text.trim();
}

/**
 * Validate MongoDB ObjectId format
 * @param {string} id - The ID to validate
 * @returns {boolean} True if valid ObjectId format
 */
function isValidObjectId(id) {
  if (!id || typeof id !== 'string') {
    return false;
  }

  // MongoDB ObjectId is 24 hex characters
  return /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * Validate email format
 * @param {string} email - The email to validate
 * @returns {boolean} True if valid email format
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

/**
 * Validate username format
 * @param {string} username - The username to validate
 * @returns {boolean} True if valid username format
 */
function isValidUsername(username) {
  if (!username || typeof username !== 'string') {
    return false;
  }

  // Username: 3-30 characters, alphanumeric, underscore, hyphen
  const usernamePattern = /^[a-zA-Z0-9_-]{3,30}$/;
  return usernamePattern.test(username);
}

/**
 * Sanitize FFmpeg command arguments
 * Prevents command injection by validating all arguments
 * @param {Array<string>} args - FFmpeg arguments
 * @returns {Array<string>} Sanitized arguments
 */
function sanitizeFFmpegArgs(args) {
  if (!Array.isArray(args)) {
    throw new Error('FFmpeg arguments must be an array');
  }

  return args.map((arg) => {
    if (typeof arg !== 'string' && typeof arg !== 'number') {
      throw new Error('Invalid FFmpeg argument type');
    }

    const argStr = String(arg);

    // Remove null bytes
    const sanitized = argStr.replace(/\0/g, '');

    // Check for shell metacharacters that could be dangerous
    const dangerousChars = /[;&|`$(){}[\]<>]/;
    if (dangerousChars.test(sanitized)) {
      throw new Error('Invalid characters in FFmpeg argument');
    }

    return sanitized;
  });
}

module.exports = {
  sanitizeFilePath,
  sanitizeFilename,
  sanitizeRtmpUrl,
  sanitizeStreamKey,
  validateLoopCount,
  isValidVideoMimeType,
  hasValidVideoExtension,
  sanitizeText,
  isValidObjectId,
  isValidEmail,
  isValidUsername,
  sanitizeFFmpegArgs,
};
