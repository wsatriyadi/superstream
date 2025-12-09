const Settings = require('../models/Settings');
const logger = require('../config/logger');

/**
 * Get current settings
 * @returns {Promise<Object>} Settings object with decrypted credentials
 */
async function getSettings() {
  try {
    const settings = await Settings.getSettings();
    
    // Return settings with decrypted credentials
    return {
      googleClientId: settings.getGoogleClientId(),
      googleClientSecret: settings.getGoogleClientSecret(),
      googleRedirectUri: settings.getGoogleRedirectUri(),
      schedulerInterval: settings.schedulerInterval,
      uploadDirectory: settings.uploadDirectory,
      maxUploadSize: settings.maxUploadSize,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  } catch (error) {
    logger.error('Error retrieving settings:', { error: error.message });
    throw error;
  }
}

/**
 * Update settings
 * @param {Object} updates - Settings updates
 * @returns {Promise<Object>} Updated settings object
 */
async function updateSettings(updates) {
  try {
    // Validate Google Client ID format if provided
    if (updates.googleClientId !== undefined && updates.googleClientId !== null && updates.googleClientId !== '') {
      if (!isValidGoogleClientId(updates.googleClientId)) {
        const error = new Error('Invalid Google Client ID format');
        logger.error('Settings update failed: Invalid Google Client ID format', {
          providedValue: updates.googleClientId,
        });
        throw error;
      }
    }

    // Validate Google Client Secret format if provided
    if (updates.googleClientSecret !== undefined && updates.googleClientSecret !== null && updates.googleClientSecret !== '') {
      if (!isValidGoogleClientSecret(updates.googleClientSecret)) {
        const error = new Error('Invalid Google Client Secret format');
        logger.error('Settings update failed: Invalid Google Client Secret format');
        throw error;
      }
    }

    const settings = await Settings.updateSettings(updates);
    
    logger.info('Settings updated successfully', {
      updatedFields: Object.keys(updates),
    });

    // Return settings with decrypted credentials
    return {
      googleClientId: settings.getGoogleClientId(),
      googleClientSecret: settings.getGoogleClientSecret(),
      googleRedirectUri: settings.getGoogleRedirectUri(),
      schedulerInterval: settings.schedulerInterval,
      uploadDirectory: settings.uploadDirectory,
      maxUploadSize: settings.maxUploadSize,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  } catch (error) {
    logger.error('Error updating settings:', { error: error.message });
    throw error;
  }
}

/**
 * Validate Google Client ID format
 * @param {string} clientId - Google Client ID
 * @returns {boolean} True if valid
 */
function isValidGoogleClientId(clientId) {
  if (!clientId || typeof clientId !== 'string') {
    return false;
  }
  
  // Google Client IDs typically end with .apps.googleusercontent.com
  // and are alphanumeric with hyphens
  const pattern = /^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/;
  return pattern.test(clientId);
}

/**
 * Validate Google Client Secret format
 * @param {string} clientSecret - Google Client Secret
 * @returns {boolean} True if valid
 */
function isValidGoogleClientSecret(clientSecret) {
  if (!clientSecret || typeof clientSecret !== 'string') {
    return false;
  }
  
  // Google Client Secrets are typically 24 characters, alphanumeric with hyphens and underscores
  // Being more lenient to accommodate different formats
  return clientSecret.length >= 20 && /^[a-zA-Z0-9_-]+$/.test(clientSecret);
}

/**
 * Get settings for API usage (raw model with methods)
 * @returns {Promise<Settings>} Settings model instance
 */
async function getSettingsForAPI() {
  try {
    return await Settings.getSettings();
  } catch (error) {
    logger.error('Error retrieving settings for API:', { error: error.message });
    throw error;
  }
}

module.exports = {
  getSettings,
  updateSettings,
  getSettingsForAPI,
  isValidGoogleClientId,
  isValidGoogleClientSecret,
};
