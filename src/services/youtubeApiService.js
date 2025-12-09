const { google } = require('googleapis');
const Settings = require('../models/Settings');
const Channel = require('../models/Channel');
const logger = require('../config/logger');

/**
 * Get OAuth2 client configured with credentials from settings
 */
async function getOAuth2Client() {
  try {
    const settings = await Settings.getSettings();
    const clientId = settings.getGoogleClientId();
    const clientSecret = settings.getGoogleClientSecret();
    const redirectUri = settings.getGoogleRedirectUri();

    if (!clientId || !clientSecret) {
      logger.error('Google API credentials not configured in settings');
      throw new Error('Google API credentials not configured. Please configure in Settings page.');
    }

    if (!redirectUri) {
      logger.error('Google Redirect URI not configured in settings');
      throw new Error('Google Redirect URI not configured. Please configure in Settings page.');
    }

    logger.info('Creating OAuth2 client', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      clientIdPrefix: clientId?.substring(0, 10) + '...',
      redirectUri
    });

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    return oauth2Client;
  } catch (error) {
    logger.error('Error getting OAuth2 client', { error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Generate OAuth authorization URL
 */
async function getAuthorizationUrl() {
  try {
    const oauth2Client = await getOAuth2Client();

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/youtube',
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.force-ssl',
      ],
      prompt: 'consent', // Force consent screen to get refresh token
      include_granted_scopes: true, // Include previously granted scopes
    });

    logger.info('Generated OAuth authorization URL');
    return authUrl;
  } catch (error) {
    logger.error('Error generating authorization URL', { error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Exchange authorization code for tokens
 */
async function getTokensFromCode(code) {
  try {
    logger.info('Exchanging authorization code for tokens', {
      codeLength: code?.length,
      codePrefix: code?.substring(0, 10) + '...'
    });
    
    const oauth2Client = await getOAuth2Client();
    
    logger.info('OAuth2 client created, calling getToken...');
    const { tokens } = await oauth2Client.getToken(code);
    
    logger.info('Successfully exchanged authorization code for tokens', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      tokenType: tokens.token_type,
      scope: tokens.scope
    });
    
    return tokens;
  } catch (error) {
    logger.error('Error exchanging authorization code for tokens', { 
      error: error.message,
      errorCode: error.code,
      errorResponse: error.response?.data,
      stack: error.stack 
    });
    throw error;
  }
}

/**
 * Get channel information from YouTube API
 */
async function getChannelInfo(accessToken) {
  try {
    const oauth2Client = await getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    const response = await youtube.channels.list({
      part: ['snippet', 'statistics'],
      mine: true,
    });

    if (!response.data.items || response.data.items.length === 0) {
      logger.error('No channel found for this account');
      throw new Error('No channel found for this account');
    }

    const channelData = response.data.items[0];
    const channelInfo = {
      channelId: channelData.id,
      channelName: channelData.snippet.title,
      thumbnailUrl: channelData.snippet.thumbnails?.default?.url || '',
      subscriberCount: parseInt(channelData.statistics.subscriberCount) || 0,
      totalViews: parseInt(channelData.statistics.viewCount) || 0,
    };
    
    logger.info('Retrieved channel information', { channelId: channelInfo.channelId });
    return channelInfo;
  } catch (error) {
    logger.error('Error getting channel information', { error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(channelId) {
  try {
    logger.info('Refreshing access token', { channelId });
    
    const channel = await Channel.findOne({ channelId });
    if (!channel) {
      logger.error('Channel not found for token refresh', { channelId });
      throw new Error('Channel not found');
    }

    if (!channel.refreshToken) {
      logger.error('No refresh token available for channel', { channelId });
      throw new Error('No refresh token available. Please reconnect the channel.');
    }

    logger.info('Attempting token refresh', { 
      channelId, 
      hasRefreshToken: !!channel.refreshToken,
      refreshTokenLength: channel.refreshToken?.length,
      tokenExpiry: channel.tokenExpiry,
      channelName: channel.channelName
    });

    const oauth2Client = await getOAuth2Client();
    
    // Log the OAuth client configuration (without sensitive data)
    logger.info('OAuth client configuration', {
      redirectUri: `${process.env.BASE_URL || 'http://localhost:3000'}/channels/oauth/callback`,
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET
    });
    
    oauth2Client.setCredentials({
      refresh_token: channel.getRefreshToken(),
    });

    logger.info('Calling refreshAccessToken...');
    const { credentials } = await oauth2Client.refreshAccessToken();
    logger.info('Token refresh successful');
    
    // Update channel with new access token and refresh token if provided
    channel.accessToken = credentials.access_token;
    if (credentials.refresh_token) {
      channel.refreshToken = credentials.refresh_token;
    }
    channel.tokenExpiry = new Date(credentials.expiry_date);
    await channel.save();

    logger.info('Access token refreshed successfully', { 
      channelId,
      newExpiryDate: credentials.expiry_date,
      hasNewRefreshToken: !!credentials.refresh_token
    });
    return credentials.access_token;
  } catch (error) {
    logger.error('Error refreshing access token', { 
      channelId, 
      error: error.message, 
      errorCode: error.code,
      stack: error.stack 
    });
    throw error;
  }
}

/**
 * Get authenticated YouTube API client for a channel
 */
async function getAuthenticatedClient(channelId) {
  try {
    const channel = await Channel.findOne({ channelId });
    if (!channel) {
      logger.error('Channel not found for authenticated client', { channelId });
      throw new Error('Channel not found');
    }

    const oauth2Client = await getOAuth2Client();
    
    // Check if token is expired or about to expire (within 5 minutes)
    const now = new Date();
    const expiryBuffer = new Date(now.getTime() + 5 * 60 * 1000);
    
    if (channel.tokenExpiry && channel.tokenExpiry < expiryBuffer) {
      // Token expired or about to expire, refresh it
      logger.info('Token expired or about to expire, refreshing', { channelId });
      await refreshAccessToken(channelId);
      // Reload channel to get updated token
      const updatedChannel = await Channel.findOne({ channelId });
      oauth2Client.setCredentials({
        access_token: updatedChannel.getAccessToken(),
        refresh_token: updatedChannel.getRefreshToken(),
      });
    } else {
      oauth2Client.setCredentials({
        access_token: channel.getAccessToken(),
        refresh_token: channel.getRefreshToken(),
      });
    }

    return google.youtube({ version: 'v3', auth: oauth2Client });
  } catch (error) {
    logger.error('Error getting authenticated client', { channelId, error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Get channel statistics from YouTube API
 */
async function getChannelStats(channelId) {
  try {
    logger.info('Fetching channel statistics', { channelId });
    
    const youtube = await getAuthenticatedClient(channelId);
    const channel = await Channel.findOne({ channelId });

    const response = await youtube.channels.list({
      part: ['statistics'],
      id: [channel.channelId],
    });

    if (!response.data.items || response.data.items.length === 0) {
      logger.error('Channel not found on YouTube', { channelId });
      throw new Error('Channel not found on YouTube');
    }

    const stats = response.data.items[0].statistics;
    
    const channelStats = {
      subscriberCount: parseInt(stats.subscriberCount) || 0,
      totalViews: parseInt(stats.viewCount) || 0,
      totalWatchTime: 0, // YouTube API doesn't provide watch time in basic stats
    };
    
    logger.info('Channel statistics retrieved', { channelId, stats: channelStats });
    return channelStats;
  } catch (error) {
    logger.error('Error getting channel statistics', { channelId, error: error.message, stack: error.stack });
    throw error;
  }
}

module.exports = {
  getOAuth2Client,
  getAuthorizationUrl,
  getTokensFromCode,
  getChannelInfo,
  refreshAccessToken,
  getAuthenticatedClient,
  getChannelStats,
};
