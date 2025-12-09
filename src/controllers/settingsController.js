const settingsService = require('../services/settingsService');
const logger = require('../config/logger');

/**
 * Render settings page
 */
async function renderSettingsPage(req, res) {
  try {
    const settings = await settingsService.getSettings();
    
    res.render('settings', {
      title: 'Settings',
      settings,
      messages: {
        success: req.flash('success'),
        error: req.flash('error'),
      },
      body: '',
    });
  } catch (error) {
    logger.error('Error rendering settings page:', { error: error.message });
    req.flash('error', 'Failed to load settings');
    res.redirect('/dashboard');
  }
}

/**
 * Update settings
 */
async function updateSettings(req, res) {
  try {
    const updates = {};
    
    logger.info('Updating settings', {
      fields: Object.keys(req.body),
      hasGoogleClientId: !!req.body.googleClientId,
      hasGoogleClientSecret: !!req.body.googleClientSecret,
      hasGoogleRedirectUri: !!req.body.googleRedirectUri,
      redirectUriValue: req.body.googleRedirectUri
    });
    
    // Extract and validate fields
    if (req.body.googleClientId !== undefined && req.body.googleClientId.trim() !== '') {
      updates.googleClientId = req.body.googleClientId.trim();
    }
    
    if (req.body.googleClientSecret !== undefined && req.body.googleClientSecret.trim() !== '') {
      updates.googleClientSecret = req.body.googleClientSecret.trim();
    }
    
    if (req.body.googleRedirectUri !== undefined && req.body.googleRedirectUri.trim() !== '') {
      updates.googleRedirectUri = req.body.googleRedirectUri.trim();
    }
    
    if (req.body.schedulerInterval !== undefined) {
      updates.schedulerInterval = parseInt(req.body.schedulerInterval, 10);
      if (isNaN(updates.schedulerInterval)) {
        throw new Error('Scheduler interval must be a number');
      }
    }
    
    if (req.body.maxUploadSize !== undefined) {
      updates.maxUploadSize = parseInt(req.body.maxUploadSize, 10);
      if (isNaN(updates.maxUploadSize)) {
        throw new Error('Max upload size must be a number');
      }
    }

    await settingsService.updateSettings(updates);
    
    req.flash('success', 'Settings updated successfully');
    res.redirect('/settings');
  } catch (error) {
    logger.error('Error updating settings:', { error: error.message });
    req.flash('error', error.message || 'Failed to update settings');
    res.redirect('/settings');
  }
}

/**
 * Get settings API endpoint
 */
async function getSettings(req, res) {
  try {
    const settings = await settingsService.getSettings();
    res.json({ success: true, settings });
  } catch (error) {
    logger.error('Error getting settings via API:', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  renderSettingsPage,
  updateSettings,
  getSettings,
};
