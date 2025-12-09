const Stream = require('../models/Stream');
const Video = require('../models/Video');
const Channel = require('../models/Channel');
const ffmpegManager = require('./ffmpegManager');
const logger = require('../config/logger');

/**
 * StreamService - Manages stream lifecycle and database operations
 */
class StreamService {
  /**
   * Create a new stream record in the database
   * @param {Object} streamData - Stream information
   * @returns {Promise<Object>} Created stream document
   */
  async createStream(streamData) {
    try {
      const stream = new Stream({
        channelId: streamData.channelId,
        videoId: streamData.videoId,
        broadcastId: streamData.broadcastId,
        rtmpUrl: streamData.rtmpUrl,
        status: 'starting',
        startedAt: new Date(),
      });

      await stream.save();

      logger.info('Stream record created', {
        streamId: stream._id.toString(),
        channelId: streamData.channelId,
        videoId: streamData.videoId,
      });

      return stream;
    } catch (error) {
      logger.error('Failed to create stream record', {
        error: error.message,
        streamData,
      });
      throw error;
    }
  }

  /**
   * Start a new stream with FFmpeg
   * @param {Object} options - Stream configuration
   * @param {string} options.channelId - Channel ID
   * @param {string} options.videoId - Video ID
   * @param {string} options.broadcastId - YouTube broadcast ID
   * @param {string} options.rtmpUrl - RTMP server URL
   * @param {string} options.streamKey - YouTube stream key
   * @returns {Promise<Object>} Stream information
   */
  async startStream({ channelId, videoId, broadcastId, rtmpUrl, streamKey }) {
    try {
      // Fetch video details
      const video = await Video.findById(videoId);
      if (!video) {
        throw new Error(`Video not found: ${videoId}`);
      }

      // Verify channel association
      if (video.channelId.toString() !== channelId.toString()) {
        throw new Error('Video does not belong to the specified channel');
      }

      // Create stream record
      const stream = await this.createStream({
        channelId,
        videoId,
        broadcastId,
        rtmpUrl,
      });

      const streamId = stream._id.toString();

      // Start FFmpeg process
      try {
        const processInfo = ffmpegManager.startStream({
          streamId,
          videoPath: video.filePath,
          rtmpUrl,
          streamKey,
          loopCount: video.loopCount,
          onError: async (error, sid) => {
            await this.handleStreamError(sid, error);
          },
          onExit: async (code, signal, sid) => {
            await this.handleStreamExit(sid, code, signal);
          },
        });

        // Update stream with process ID and set to active
        stream.ffmpegProcessId = processInfo.processId;
        stream.status = 'active';
        await stream.save();

        logger.info('Stream started successfully', {
          streamId,
          processId: processInfo.processId,
          videoTitle: video.title,
        });

        return {
          streamId,
          processId: processInfo.processId,
          status: 'active',
          video: {
            title: video.title,
            loopCount: video.loopCount,
          },
        };
      } catch (ffmpegError) {
        // FFmpeg failed to start, update stream status
        stream.status = 'failed';
        stream.errorMessage = ffmpegError.message;
        stream.endedAt = new Date();
        await stream.save();

        throw ffmpegError;
      }
    } catch (error) {
      logger.error('Failed to start stream', {
        error: error.message,
        channelId,
        videoId,
      });
      throw error;
    }
  }

  /**
   * Stop an active stream
   * @param {string} streamId - Stream ID
   * @returns {Promise<boolean>} True if stopped successfully
   */
  async stopStream(streamId) {
    try {
      const stream = await Stream.findById(streamId);

      if (!stream) {
        throw new Error(`Stream not found: ${streamId}`);
      }

      if (!stream.isActive()) {
        logger.warn('Attempted to stop inactive stream', {
          streamId,
          status: stream.status,
        });
        return false;
      }

      // Update status to stopping
      stream.status = 'stopping';
      await stream.save();

      // Stop FFmpeg process
      const stopped = ffmpegManager.stopStream(streamId);

      if (stopped) {
        // Update stream status
        stream.status = 'completed';
        stream.endedAt = new Date();
        await stream.save();

        logger.info('Stream stopped successfully', { streamId });
        return true;
      } else {
        // Process not found, mark as completed anyway
        stream.status = 'completed';
        stream.endedAt = new Date();
        await stream.save();

        return false;
      }
    } catch (error) {
      logger.error('Failed to stop stream', {
        streamId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get all active streams
   * @returns {Promise<Array>} Array of active streams with details
   */
  async getActiveStreams() {
    try {
      const streams = await Stream.find({
        status: { $in: ['starting', 'active'] },
      })
        .populate('videoId', 'title thumbnailPath')
        .populate('channelId', 'channelName')
        .sort({ startedAt: -1 });

      return streams.map((stream) => ({
        streamId: stream._id.toString(),
        status: stream.status,
        startedAt: stream.startedAt,
        duration: stream.duration,
        video: stream.videoId
          ? {
              title: stream.videoId.title,
              thumbnailPath: stream.videoId.thumbnailPath,
            }
          : null,
        channel: stream.channelId
          ? {
              name: stream.channelId.channelName,
            }
          : null,
        viewerCount: stream.viewerCount,
      }));
    } catch (error) {
      logger.error('Failed to get active streams', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get stream by ID with details
   * @param {string} streamId - Stream ID
   * @returns {Promise<Object>} Stream details
   */
  async getStreamById(streamId) {
    try {
      const stream = await Stream.findById(streamId)
        .populate('videoId', 'title description thumbnailPath loopCount')
        .populate('channelId', 'channelName channelId');

      if (!stream) {
        return null;
      }

      return {
        streamId: stream._id.toString(),
        status: stream.status,
        startedAt: stream.startedAt,
        endedAt: stream.endedAt,
        duration: stream.duration,
        video: stream.videoId,
        channel: stream.channelId,
        broadcastId: stream.broadcastId,
        errorMessage: stream.errorMessage,
      };
    } catch (error) {
      logger.error('Failed to get stream by ID', {
        streamId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Handle stream errors
   * @param {string} streamId - Stream ID
   * @param {Error} error - Error object
   */
  async handleStreamError(streamId, error) {
    try {
      const stream = await Stream.findById(streamId);

      if (stream && stream.isActive()) {
        stream.status = 'failed';
        stream.errorMessage = error.message;
        stream.endedAt = new Date();
        await stream.save();

        logger.error('Stream failed', {
          streamId,
          error: error.message,
        });
      }
    } catch (dbError) {
      logger.error('Failed to update stream error status', {
        streamId,
        error: dbError.message,
      });
    }
  }

  /**
   * Handle stream exit
   * @param {string} streamId - Stream ID
   * @param {number} code - Exit code
   * @param {string} signal - Exit signal
   */
  async handleStreamExit(streamId, code, signal) {
    try {
      const stream = await Stream.findById(streamId);

      if (stream && stream.status !== 'completed' && stream.status !== 'failed') {
        // Determine if exit was successful
        if (code === 0 || code === null) {
          stream.status = 'completed';
        } else {
          stream.status = 'failed';
          stream.errorMessage = `FFmpeg exited with code ${code}`;
        }

        stream.endedAt = new Date();
        await stream.save();

        logger.info('Stream exit handled', {
          streamId,
          exitCode: code,
          signal,
          finalStatus: stream.status,
        });
      }
    } catch (error) {
      logger.error('Failed to handle stream exit', {
        streamId,
        error: error.message,
      });
    }
  }

  /**
   * Get active stream count for a channel
   * @param {string} channelId - Channel ID
   * @returns {Promise<number>} Number of active streams
   */
  async getActiveStreamCountForChannel(channelId) {
    try {
      return await Stream.getActiveStreamCount(channelId);
    } catch (error) {
      logger.error('Failed to get active stream count', {
        channelId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Clean up old completed/failed streams
   * @param {number} daysOld - Delete streams older than this many days
   * @returns {Promise<number>} Number of deleted streams
   */
  async cleanupOldStreams(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await Stream.deleteMany({
        status: { $in: ['completed', 'failed'] },
        endedAt: { $lt: cutoffDate },
      });

      logger.info('Old streams cleaned up', {
        deletedCount: result.deletedCount,
        daysOld,
      });

      return result.deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old streams', {
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = new StreamService();
