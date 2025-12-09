const { google } = require('googleapis');
const logger = require('../config/logger');
const youtubeApiService = require('./youtubeApiService');
const Channel = require('../models/Channel');

/**
 * BroadcastService - Manages YouTube Live Streaming API operations
 * Handles broadcast creation, metadata injection, and RTMP endpoint retrieval
 */
class BroadcastService {
  /**
   * Create a new YouTube live broadcast with metadata
   * @param {Object} options - Broadcast configuration
   * @param {string} options.channelId - MongoDB Channel ID
   * @param {string} options.title - Broadcast title
   * @param {string} options.description - Broadcast description
   * @returns {Promise<Object>} Broadcast details including RTMP endpoint
   */
  async createBroadcast({ channelId, title, description }) {
    try {
      logger.info('Creating YouTube broadcast', {
        channelId,
        title,
      });

      // Get authenticated YouTube client for the channel
      const channel = await Channel.findById(channelId);
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      const youtube = await youtubeApiService.getAuthenticatedClient(channel.channelId);

      // Create a live stream (this provides the RTMP endpoint)
      const streamResponse = await youtube.liveStreams.insert({
        part: ['snippet', 'cdn'],
        requestBody: {
          snippet: {
            title: `Stream for: ${title}`,
          },
          cdn: {
            frameRate: 'variable',
            ingestionType: 'rtmp',
            resolution: 'variable',
          },
        },
      });

      const stream = streamResponse.data;
      const streamId = stream.id;
      const rtmpUrl = stream.cdn.ingestionInfo.ingestionAddress;
      const streamKey = stream.cdn.ingestionInfo.streamName;

      logger.info('Live stream created', {
        streamId,
        channelId,
      });

      // Create a live broadcast with the provided metadata
      const broadcastResponse = await youtube.liveBroadcasts.insert({
        part: ['snippet', 'status', 'contentDetails'],
        requestBody: {
          snippet: {
            title: title,
            description: description || '',
            scheduledStartTime: new Date().toISOString(),
          },
          status: {
            privacyStatus: 'public',
            selfDeclaredMadeForKids: false,
          },
          contentDetails: {
            enableAutoStart: true,
            enableAutoStop: false,
          },
        },
      });

      const broadcast = broadcastResponse.data;
      const broadcastId = broadcast.id;

      logger.info('Live broadcast created', {
        broadcastId,
        channelId,
        title,
      });

      // Bind the stream to the broadcast
      await youtube.liveBroadcasts.bind({
        part: ['id', 'snippet', 'status'],
        id: broadcastId,
        streamId: streamId,
      });

      logger.info('Stream bound to broadcast', {
        broadcastId,
        streamId,
        channelId,
      });

      // Verify metadata was set correctly
      const verifyResponse = await youtube.liveBroadcasts.list({
        part: ['snippet'],
        id: [broadcastId],
      });

      if (!verifyResponse.data.items || verifyResponse.data.items.length === 0) {
        const error = new Error('Failed to verify broadcast metadata');
        logger.error('Metadata verification failed', {
          broadcastId,
          channelId,
        });
        throw error;
      }

      const verifiedBroadcast = verifyResponse.data.items[0];
      const metadataMatches =
        verifiedBroadcast.snippet.title === title &&
        (verifiedBroadcast.snippet.description === description ||
          (verifiedBroadcast.snippet.description === '' && !description));

      if (!metadataMatches) {
        const error = new Error('Broadcast metadata does not match expected values');
        logger.error('Metadata mismatch detected', {
          broadcastId,
          channelId,
          expected: { title, description },
          actual: {
            title: verifiedBroadcast.snippet.title,
            description: verifiedBroadcast.snippet.description,
          },
        });
        throw error;
      }

      logger.info('Broadcast metadata verified successfully', {
        broadcastId,
        channelId,
      });

      return {
        broadcastId,
        streamId,
        rtmpUrl,
        streamKey,
        title: verifiedBroadcast.snippet.title,
        description: verifiedBroadcast.snippet.description,
      };
    } catch (error) {
      logger.error('Failed to create broadcast', {
        channelId,
        title,
        error: error.message,
        stack: error.stack,
      });

      // If metadata injection failed, abort the stream
      if (error.message.includes('metadata')) {
        logger.error('Metadata injection failure - aborting stream', {
          channelId,
          title,
        });
      }

      throw error;
    }
  }

  /**
   * Get RTMP endpoint for a channel
   * @param {string} channelId - MongoDB Channel ID
   * @returns {Promise<Object>} RTMP URL and stream key
   */
  async getRtmpEndpoint(channelId) {
    try {
      logger.info('Retrieving RTMP endpoint', { channelId });

      const channel = await Channel.findById(channelId);
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      const youtube = await youtubeApiService.getAuthenticatedClient(channel.channelId);

      // List existing live streams for the channel
      const streamResponse = await youtube.liveStreams.list({
        part: ['cdn'],
        mine: true,
        maxResults: 1,
      });

      if (streamResponse.data.items && streamResponse.data.items.length > 0) {
        const stream = streamResponse.data.items[0];
        const rtmpUrl = stream.cdn.ingestionInfo.ingestionAddress;
        const streamKey = stream.cdn.ingestionInfo.streamName;

        logger.info('RTMP endpoint retrieved from existing stream', {
          channelId,
          streamId: stream.id,
        });

        return {
          rtmpUrl,
          streamKey,
          streamId: stream.id,
        };
      }

      // If no existing stream, create a new one
      const newStreamResponse = await youtube.liveStreams.insert({
        part: ['snippet', 'cdn'],
        requestBody: {
          snippet: {
            title: 'Default Stream',
          },
          cdn: {
            frameRate: 'variable',
            ingestionType: 'rtmp',
            resolution: 'variable',
          },
        },
      });

      const stream = newStreamResponse.data;
      const rtmpUrl = stream.cdn.ingestionInfo.ingestionAddress;
      const streamKey = stream.cdn.ingestionInfo.streamName;

      logger.info('RTMP endpoint created', {
        channelId,
        streamId: stream.id,
      });

      return {
        rtmpUrl,
        streamKey,
        streamId: stream.id,
      };
    } catch (error) {
      logger.error('Failed to get RTMP endpoint', {
        channelId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get broadcast status
   * @param {string} channelId - MongoDB Channel ID
   * @param {string} broadcastId - YouTube broadcast ID
   * @returns {Promise<Object>} Broadcast status information
   */
  async getBroadcastStatus(channelId, broadcastId) {
    try {
      const channel = await Channel.findById(channelId);
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      const youtube = await youtubeApiService.getAuthenticatedClient(channel.channelId);

      const response = await youtube.liveBroadcasts.list({
        part: ['status', 'snippet'],
        id: [broadcastId],
      });

      if (!response.data.items || response.data.items.length === 0) {
        throw new Error(`Broadcast not found: ${broadcastId}`);
      }

      const broadcast = response.data.items[0];

      logger.info('Broadcast status retrieved', {
        broadcastId,
        channelId,
        status: broadcast.status.lifeCycleStatus,
      });

      return {
        broadcastId,
        lifeCycleStatus: broadcast.status.lifeCycleStatus,
        privacyStatus: broadcast.status.privacyStatus,
        title: broadcast.snippet.title,
        description: broadcast.snippet.description,
      };
    } catch (error) {
      logger.error('Failed to get broadcast status', {
        channelId,
        broadcastId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Transition broadcast to live
   * @param {string} channelId - MongoDB Channel ID
   * @param {string} broadcastId - YouTube broadcast ID
   * @returns {Promise<Object>} Updated broadcast status
   */
  async transitionBroadcastToLive(channelId, broadcastId) {
    try {
      logger.info('Transitioning broadcast to live', {
        channelId,
        broadcastId,
      });

      const channel = await Channel.findById(channelId);
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      const youtube = await youtubeApiService.getAuthenticatedClient(channel.channelId);

      const response = await youtube.liveBroadcasts.transition({
        part: ['status'],
        id: broadcastId,
        broadcastStatus: 'live',
      });

      logger.info('Broadcast transitioned to live', {
        broadcastId,
        channelId,
      });

      return {
        broadcastId,
        status: response.data.status.lifeCycleStatus,
      };
    } catch (error) {
      logger.error('Failed to transition broadcast to live', {
        channelId,
        broadcastId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * End a live broadcast
   * @param {string} channelId - MongoDB Channel ID
   * @param {string} broadcastId - YouTube broadcast ID
   * @returns {Promise<Object>} Final broadcast status
   */
  async endBroadcast(channelId, broadcastId) {
    try {
      logger.info('Ending broadcast', {
        channelId,
        broadcastId,
      });

      const channel = await Channel.findById(channelId);
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      const youtube = await youtubeApiService.getAuthenticatedClient(channel.channelId);

      const response = await youtube.liveBroadcasts.transition({
        part: ['status'],
        id: broadcastId,
        broadcastStatus: 'complete',
      });

      logger.info('Broadcast ended', {
        broadcastId,
        channelId,
      });

      return {
        broadcastId,
        status: response.data.status.lifeCycleStatus,
      };
    } catch (error) {
      logger.error('Failed to end broadcast', {
        channelId,
        broadcastId,
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = new BroadcastService();
