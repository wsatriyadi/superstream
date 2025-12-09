const Channel = require('../models/Channel');
const Stream = require('../models/Stream');
const { getTokensFromCode, getChannelInfo, getChannelStats } = require('./youtubeApiService');
const logger = require('../config/logger');

/**
 * Connect a new YouTube channel via OAuth
 */
async function connectChannel(authCode) {
  try {
    logger.info('Connecting new YouTube channel', { authCode: authCode ? 'present' : 'missing' });

    // Exchange code for tokens
    const tokens = await getTokensFromCode(authCode);

    if (!tokens.access_token) {
      logger.error('Failed to obtain access token from YouTube');
      throw new Error('Failed to obtain access token from YouTube');
    }

    if (!tokens.refresh_token) {
      logger.warn('No refresh token received - user may have already authorized this app');
      logger.warn('To get a new refresh token, revoke access at: https://myaccount.google.com/permissions');
      throw new Error('No refresh token received. Please revoke app access in your Google account and try again.');
    }

    // Get channel information
    const channelInfo = await getChannelInfo(tokens.access_token);

    // Check if channel already exists
    let channel = await Channel.findOne({ channelId: channelInfo.channelId });

    if (channel) {
      logger.info('Updating existing channel', { channelId: channelInfo.channelId });
      // Update existing channel
      channel.channelName = channelInfo.channelName;
      channel.thumbnailUrl = channelInfo.thumbnailUrl;
      channel.accessToken = tokens.access_token;
      channel.refreshToken = tokens.refresh_token;
      channel.tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
      channel.subscriberCount = channelInfo.subscriberCount;
      channel.totalViews = channelInfo.totalViews;
      channel.lastSyncedAt = new Date();
    } else {
      logger.info('Creating new channel', { channelId: channelInfo.channelId });
      // Create new channel
      channel = new Channel({
        channelId: channelInfo.channelId,
        channelName: channelInfo.channelName,
        thumbnailUrl: channelInfo.thumbnailUrl,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        subscriberCount: channelInfo.subscriberCount,
        totalViews: channelInfo.totalViews,
        connectedAt: new Date(),
        lastSyncedAt: new Date(),
      });
    }

    await channel.save();
    logger.info('Channel connected successfully', { channelId: channel.channelId });
    return channel;
  } catch (error) {
    logger.error('Error connecting channel', { error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Get all connected channels with active stream counts
 */
async function getAllChannels() {
  try {
    const channels = await Channel.find().sort({ connectedAt: -1 }).lean();
    
    // Add active stream count for each channel
    for (const channel of channels) {
      const activeStreamCount = await Stream.getActiveStreamCount(channel._id);
      channel.activeStreamCount = activeStreamCount;
    }
    
    logger.debug('Retrieved all channels', { count: channels.length });
    return channels;
  } catch (error) {
    logger.error('Error retrieving channels', { error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Get a single channel by ID
 */
async function getChannelById(channelId) {
  try {
    const channel = await Channel.findOne({ channelId });
    if (!channel) {
      logger.warn('Channel not found', { channelId });
    }
    return channel;
  } catch (error) {
    logger.error('Error retrieving channel by ID', { channelId, error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Update channel settings
 */
async function updateChannelSettings(id, settings) {
  try {
    const channel = await Channel.findById(id);
    if (!channel) {
      logger.warn('Channel not found for settings update', { id });
      throw new Error('Channel not found');
    }

    if (settings.maxSimultaneousStreams !== undefined) {
      channel.maxSimultaneousStreams = settings.maxSimultaneousStreams;
    }

    await channel.save();
    logger.info('Channel settings updated', { id, settings });
    return channel;
  } catch (error) {
    logger.error('Error updating channel settings', { id, error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Delete a channel
 */
async function deleteChannel(id) {
  try {
    const result = await Channel.deleteOne({ _id: id });
    const deleted = result.deletedCount > 0;
    if (deleted) {
      logger.info('Channel deleted', { id });
    } else {
      logger.warn('Channel not found for deletion', { id });
    }
    return deleted;
  } catch (error) {
    logger.error('Error deleting channel', { id, error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Get aggregate statistics for all channels
 */
async function getAggregateStats() {
  try {
    const channels = await getAllChannels();
    
    const stats = {
      totalChannels: channels.length,
      totalSubscribers: 0,
      totalViews: 0,
      totalWatchTime: 0,
      totalActiveStreams: 0,
    };

    channels.forEach(channel => {
      stats.totalSubscribers += channel.subscriberCount || 0;
      stats.totalViews += channel.totalViews || 0;
      stats.totalWatchTime += channel.totalWatchTime || 0;
      stats.totalActiveStreams += channel.activeStreamCount || 0;
    });

    logger.debug('Calculated aggregate stats', stats);
    return stats;
  } catch (error) {
    logger.error('Error calculating aggregate stats', { error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Sync channel statistics from YouTube API
 */
async function syncChannelStats(channelId) {
  try {
    logger.info('Syncing channel statistics', { channelId });
    
    const channel = await Channel.findOne({ channelId });
    if (!channel) {
      logger.warn('Channel not found for stats sync', { channelId });
      throw new Error('Channel not found');
    }

    const stats = await getChannelStats(channelId);
    
    channel.subscriberCount = stats.subscriberCount;
    channel.totalViews = stats.totalViews;
    channel.totalWatchTime = stats.totalWatchTime;
    channel.lastSyncedAt = new Date();
    
    await channel.save();
    logger.info('Channel statistics synced successfully', { channelId, stats });
    return channel;
  } catch (error) {
    logger.error('Error syncing channel statistics', { channelId, error: error.message, stack: error.stack });
    throw error;
  }
}

module.exports = {
  connectChannel,
  getAllChannels,
  getChannelById,
  updateChannelSettings,
  deleteChannel,
  getAggregateStats,
  syncChannelStats,
};
