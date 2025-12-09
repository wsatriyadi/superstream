const channelService = require('../services/channelService');
const { getAuthorizationUrl } = require('../services/youtubeApiService');
const systemMonitor = require('../services/systemMonitor');

/**
 * Initiate OAuth flow - redirect to Google consent screen
 */
async function initiateOAuth(req, res, next) {
  try {
    const authUrl = await getAuthorizationUrl();
    res.redirect(authUrl);
  } catch (error) {
    console.error('OAuth initiation error:', error);
    req.flash('error', 'Failed to initiate OAuth flow. Please check API credentials in Settings.');
    res.redirect('/channels');
  }
}

/**
 * Handle OAuth callback from Google
 */
async function handleOAuthCallback(req, res, next) {
  try {
    const { code, error } = req.query;

    if (error) {
      req.flash('error', `OAuth error: ${error}`);
      return res.redirect('/channels');
    }

    if (!code) {
      req.flash('error', 'No authorization code received');
      return res.redirect('/channels');
    }

    // Connect the channel
    const channel = await channelService.connectChannel(code);

    req.flash('success', `Successfully connected channel: ${channel.channelName}`);
    res.redirect('/channels');
  } catch (error) {
    console.error('OAuth callback error:', error);
    req.flash('error', `Failed to connect channel: ${error.message}`);
    res.redirect('/channels');
  }
}

/**
 * Get all channels (API endpoint)
 */
async function getChannels(req, res, next) {
  try {
    const channels = await channelService.getAllChannels();
    res.json({ success: true, channels });
  } catch (error) {
    console.error('Get channels error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get single channel (API endpoint)
 */
async function getChannel(req, res, next) {
  try {
    const { id } = req.params;
    const channel = await channelService.getChannelById(id);
    
    if (!channel) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }

    res.json({ success: true, channel });
  } catch (error) {
    console.error('Get channel error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Update channel settings (API endpoint)
 */
async function updateChannelSettings(req, res, next) {
  try {
    const { id } = req.params;
    const settings = req.body;

    const channel = await channelService.updateChannelSettings(id, settings);
    res.json({ success: true, channel });
  } catch (error) {
    console.error('Update channel settings error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Delete channel (API endpoint)
 */
async function deleteChannel(req, res, next) {
  try {
    const { id } = req.params;
    const deleted = await channelService.deleteChannel(id);
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }

    res.json({ success: true, message: 'Channel deleted successfully' });
  } catch (error) {
    console.error('Delete channel error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Render channels page
 */
async function renderChannelsPage(req, res, next) {
  try {
    const channels = await channelService.getAllChannels();
    const stats = await channelService.getAggregateStats();
    
    res.render('channels', {
      title: 'Channels',
      channels,
      stats,
      csrfToken: req.csrfToken ? req.csrfToken() : null,
      messages: {
        success: req.flash('success'),
        error: req.flash('error'),
      },
    });
  } catch (error) {
    console.error('Render channels page error:', error);
    req.flash('error', 'Failed to load channels');
    res.redirect('/dashboard');
  }
}

/**
 * Render dashboard page
 */
async function renderDashboard(req, res, next) {
  try {
    const [channels, stats, systemStats] = await Promise.all([
      channelService.getAllChannels(),
      channelService.getAggregateStats(),
      systemMonitor.getSystemStats(),
    ]);
    
    res.render('dashboard', {
      title: 'Dashboard',
      channels,
      stats,
      systemStats,
      messages: {
        success: req.flash('success'),
        error: req.flash('error'),
      },
    });
  } catch (error) {
    console.error('Render dashboard error:', error);
    req.flash('error', 'Failed to load dashboard');
    res.render('dashboard', {
      title: 'Dashboard',
      channels: [],
      stats: {
        totalChannels: 0,
        totalSubscribers: 0,
        totalViews: 0,
        totalWatchTime: 0,
        totalActiveStreams: 0,
      },
      systemStats: {
        cpu: { usage: 0, cores: 0 },
        memory: { usagePercent: 0, totalGB: '0', usedGB: '0' },
        disk: { usagePercent: 0, totalGB: '0', usedGB: '0' },
        network: { interfaces: [] },
      },
      messages: {
        success: [],
        error: [error.message],
      },
    });
  }
}

module.exports = {
  initiateOAuth,
  handleOAuthCallback,
  getChannels,
  getChannel,
  updateChannelSettings,
  deleteChannel,
  renderChannelsPage,
  renderDashboard,
};
