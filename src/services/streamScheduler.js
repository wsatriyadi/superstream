const cron = require('node-cron');
const Channel = require('../models/Channel');
const Video = require('../models/Video');
const streamService = require('./streamService');
const broadcastService = require('./broadcastService');
const dailyLogService = require('./dailyLogService');
const logger = require('../config/logger');

/**
 * StreamScheduler - Automates stream initiation based on business rules
 * Runs on a cron schedule to check channel eligibility and start streams
 */
class StreamScheduler {
  constructor() {
    this.cronJob = null;
    this.isRunning = false;
    this.lockAcquired = false;
  }

  /**
   * Initialize and start the scheduler
   * @param {string} cronExpression - Cron expression (default: every 5 minutes)
   */
  start(cronExpression = '*/5 * * * *') {
    if (this.cronJob) {
      logger.warn('Scheduler already running');
      return;
    }

    logger.info('Starting stream scheduler', { cronExpression });

    this.cronJob = cron.schedule(cronExpression, async () => {
      await this.execute();
    });

    logger.info('Stream scheduler started successfully');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Stream scheduler stopped');
    }
  }

  /**
   * Execute the scheduler logic
   * Processes all channels and starts eligible streams
   */
  async execute() {
    // Implement locking to prevent concurrent execution
    if (this.lockAcquired) {
      logger.warn('Scheduler execution already in progress, skipping this cycle');
      return;
    }

    this.lockAcquired = true;
    this.isRunning = true;

    try {
      logger.info('Scheduler execution started');

      // Get all connected channels
      const channels = await Channel.find().lean();

      if (channels.length === 0) {
        logger.info('No channels connected, skipping scheduler execution');
        return;
      }

      logger.info(`Processing ${channels.length} channels`);

      // Process each channel
      const results = [];
      for (const channel of channels) {
        try {
          const result = await this.processChannel(channel);
          results.push(result);
        } catch (error) {
          logger.error('Error processing channel', {
            channelId: channel._id,
            channelName: channel.channelName,
            error: error.message,
          });
          results.push({
            channelId: channel._id,
            success: false,
            error: error.message,
          });
          // Continue with next channel on error (partial failure handling)
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      logger.info('Scheduler execution completed', {
        totalChannels: channels.length,
        successCount,
        failureCount,
        skippedCount: results.filter((r) => r.skipped).length,
      });
    } catch (error) {
      logger.error('Scheduler execution failed', {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      this.lockAcquired = false;
      this.isRunning = false;
    }
  }

  /**
   * Process a single channel
   * @param {Object} channel - Channel document
   * @returns {Promise<Object>} Processing result
   */
  async processChannel(channel) {
    logger.info('Processing channel', {
      channelId: channel._id,
      channelName: channel.channelName,
    });

    // Check channel eligibility
    const eligibility = await this.checkChannelEligibility(channel._id);

    if (!eligibility.eligible) {
      logger.info('Channel not eligible for streaming', {
        channelId: channel._id,
        reason: eligibility.reason,
      });
      return {
        channelId: channel._id,
        success: false,
        skipped: true,
        reason: eligibility.reason,
      };
    }

    // Select a video to stream
    const video = await this.selectVideo(channel._id);

    if (!video) {
      logger.info('No eligible videos for channel', {
        channelId: channel._id,
      });
      return {
        channelId: channel._id,
        success: false,
        skipped: true,
        reason: 'No eligible videos available',
      };
    }

    // Start the stream
    try {
      await this.initiateStream(channel._id, video);

      logger.info('Stream initiated successfully', {
        channelId: channel._id,
        videoId: video._id,
        videoTitle: video.title,
      });

      return {
        channelId: channel._id,
        success: true,
        videoId: video._id,
      };
    } catch (error) {
      logger.error('Failed to initiate stream', {
        channelId: channel._id,
        videoId: video._id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Check if a channel is eligible to start a new stream
   * @param {ObjectId} channelId - Channel ID
   * @returns {Promise<Object>} Eligibility result with reason
   */
  async checkChannelEligibility(channelId) {
    try {
      // Get channel
      const channel = await Channel.findById(channelId);
      if (!channel) {
        return {
          eligible: false,
          reason: 'Channel not found',
        };
      }

      // Get active stream count
      const activeStreamCount = await streamService.getActiveStreamCountForChannel(channelId);

      // Check against maximum simultaneous streams limit
      if (activeStreamCount >= channel.maxSimultaneousStreams) {
        return {
          eligible: false,
          reason: `Channel has reached maximum simultaneous streams (${activeStreamCount}/${channel.maxSimultaneousStreams})`,
        };
      }

      return {
        eligible: true,
        reason: null,
      };
    } catch (error) {
      logger.error('Error checking channel eligibility', {
        channelId,
        error: error.message,
      });
      return {
        eligible: false,
        reason: `Error checking eligibility: ${error.message}`,
      };
    }
  }

  /**
   * Select a video to stream for a channel
   * Randomly selects from eligible videos (not streamed today)
   * @param {ObjectId} channelId - Channel ID
   * @returns {Promise<Object|null>} Selected video or null if none available
   */
  async selectVideo(channelId) {
    try {
      // Get all videos for the channel
      const allVideos = await Video.find({ channelId }).lean();

      if (allVideos.length === 0) {
        logger.info('No videos found for channel', { channelId });
        return null;
      }

      // Get videos that have been streamed today
      const streamedTodayIds = await dailyLogService.getTodayStreamedVideos(channelId);
      const streamedTodaySet = new Set(streamedTodayIds.map((id) => id.toString()));

      // Filter out videos that have been streamed today
      const eligibleVideos = allVideos.filter(
        (video) => !streamedTodaySet.has(video._id.toString())
      );

      if (eligibleVideos.length === 0) {
        logger.info('All videos have been streamed today for channel', {
          channelId,
          totalVideos: allVideos.length,
        });
        return null;
      }

      // Randomly select from eligible videos
      const randomIndex = Math.floor(Math.random() * eligibleVideos.length);
      const selectedVideo = eligibleVideos[randomIndex];

      logger.info('Video selected for streaming', {
        channelId,
        videoId: selectedVideo._id,
        videoTitle: selectedVideo.title,
        eligibleCount: eligibleVideos.length,
        totalCount: allVideos.length,
      });

      return selectedVideo;
    } catch (error) {
      logger.error('Error selecting video', {
        channelId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Initiate a stream for a video
   * @param {ObjectId} channelId - Channel ID
   * @param {Object} video - Video document
   * @returns {Promise<void>}
   */
  async initiateStream(channelId, video) {
    try {
      logger.info('Initiating stream', {
        channelId,
        videoId: video._id,
        videoTitle: video.title,
      });

      // Create YouTube broadcast with video metadata
      const broadcast = await broadcastService.createBroadcast({
        channelId,
        title: video.title,
        description: video.description || '',
      });

      logger.info('Broadcast created', {
        broadcastId: broadcast.broadcastId,
        channelId,
        videoId: video._id,
      });

      // Start the stream
      const stream = await streamService.startStream({
        channelId,
        videoId: video._id,
        broadcastId: broadcast.broadcastId,
        rtmpUrl: broadcast.rtmpUrl,
        streamKey: broadcast.streamKey,
      });

      logger.info('Stream started', {
        streamId: stream.streamId,
        channelId,
        videoId: video._id,
      });

      // Create daily log entry
      await dailyLogService.createLogEntry(video._id, channelId, stream.streamId);

      logger.info('Daily log entry created', {
        streamId: stream.streamId,
        videoId: video._id,
        channelId,
      });
    } catch (error) {
      logger.error('Failed to initiate stream', {
        channelId,
        videoId: video._id,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get scheduler status
   * @returns {Object} Scheduler status information
   */
  getStatus() {
    return {
      running: !!this.cronJob,
      executing: this.isRunning,
      locked: this.lockAcquired,
    };
  }
}

module.exports = new StreamScheduler();
