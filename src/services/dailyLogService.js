const DailyStreamLog = require('../models/DailyStreamLog');
const { getTodayUTC, normalizeToMidnightUTC, isBeforeDay } = require('../utils/dateUtils');
const logger = require('../config/logger');

/**
 * Service for managing daily stream logs
 * Tracks which videos have been streamed on which dates
 */
class DailyLogService {
  /**
   * Create a log entry for a stream that has started
   * @param {ObjectId} videoId - The video being streamed
   * @param {ObjectId} channelId - The channel streaming the video
   * @param {ObjectId} streamId - The stream ID
   * @returns {Promise<DailyStreamLog>} - The created log entry
   */
  async createLogEntry(videoId, channelId, streamId) {
    try {
      const today = getTodayUTC();

      const logEntry = await DailyStreamLog.create({
        videoId,
        channelId,
        streamDate: today,
        streamId,
      });

      logger.info('Daily log entry created', { videoId, channelId, streamId, streamDate: today });
      return logEntry;
    } catch (error) {
      logger.error('Error creating daily log entry', { 
        videoId, 
        channelId, 
        streamId, 
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Check if a video has been streamed today
   * @param {ObjectId} videoId - The video to check
   * @returns {Promise<boolean>} - True if video was streamed today
   */
  async hasStreamedToday(videoId) {
    try {
      const today = getTodayUTC();

      const log = await DailyStreamLog.findOne({
        videoId,
        streamDate: today,
      });

      return !!log;
    } catch (error) {
      logger.error('Error checking if video streamed today', { 
        videoId, 
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Check if a video has been streamed on a specific date
   * @param {ObjectId} videoId - The video to check
   * @param {Date} date - The date to check
   * @returns {Promise<boolean>} - True if video was streamed on that date
   */
  async hasStreamedOnDate(videoId, date) {
    try {
      const normalizedDate = normalizeToMidnightUTC(date);

      const log = await DailyStreamLog.findOne({
        videoId,
        streamDate: normalizedDate,
      });

      return !!log;
    } catch (error) {
      logger.error('Error checking if video streamed on date', { 
        videoId, 
        date, 
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Get all videos that have been streamed today for a specific channel
   * @param {ObjectId} channelId - The channel to check
   * @returns {Promise<Array<ObjectId>>} - Array of video IDs that were streamed today
   */
  async getTodayStreamedVideos(channelId) {
    try {
      const today = getTodayUTC();

      const logs = await DailyStreamLog.find({
        channelId,
        streamDate: today,
      }).select('videoId');

      return logs.map((log) => log.videoId);
    } catch (error) {
      logger.error('Error getting today streamed videos', { 
        channelId, 
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Get all videos that have been streamed on a specific date for a channel
   * @param {ObjectId} channelId - The channel to check
   * @param {Date} date - The date to check
   * @returns {Promise<Array<ObjectId>>} - Array of video IDs that were streamed on that date
   */
  async getStreamedVideosOnDate(channelId, date) {
    try {
      const normalizedDate = normalizeToMidnightUTC(date);

      const logs = await DailyStreamLog.find({
        channelId,
        streamDate: normalizedDate,
      }).select('videoId');

      return logs.map((log) => log.videoId);
    } catch (error) {
      logger.error('Error getting streamed videos on date', { 
        channelId, 
        date, 
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Get all log entries for a specific video
   * @param {ObjectId} videoId - The video to query
   * @returns {Promise<Array<DailyStreamLog>>} - Array of log entries
   */
  async getLogsByVideo(videoId) {
    try {
      return await DailyStreamLog.find({ videoId }).sort({ streamDate: -1 });
    } catch (error) {
      logger.error('Error getting logs by video', { 
        videoId, 
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Get all log entries for a specific channel
   * @param {ObjectId} channelId - The channel to query
   * @returns {Promise<Array<DailyStreamLog>>} - Array of log entries
   */
  async getLogsByChannel(channelId) {
    try {
      return await DailyStreamLog.find({ channelId }).sort({ streamDate: -1 });
    } catch (error) {
      logger.error('Error getting logs by channel', { 
        channelId, 
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Get log entries within a date range
   * @param {Date} startDate - Start date (inclusive)
   * @param {Date} endDate - End date (inclusive)
   * @returns {Promise<Array<DailyStreamLog>>} - Array of log entries
   */
  async getLogsByDateRange(startDate, endDate) {
    try {
      const normalizedStart = normalizeToMidnightUTC(startDate);
      const normalizedEnd = normalizeToMidnightUTC(endDate);

      return await DailyStreamLog.find({
        streamDate: {
          $gte: normalizedStart,
          $lte: normalizedEnd,
        },
      }).sort({ streamDate: -1 });
    } catch (error) {
      logger.error('Error getting logs by date range', { 
        startDate, 
        endDate, 
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Clean up old log entries (optional maintenance)
   * Removes logs older than the specified number of days
   * @param {number} daysToKeep - Number of days to keep (default: 30)
   * @returns {Promise<number>} - Number of deleted entries
   */
  async cleanupOldLogs(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const normalizedCutoff = normalizeToMidnightUTC(cutoffDate);

      const result = await DailyStreamLog.deleteMany({
        streamDate: { $lt: normalizedCutoff },
      });

      logger.info('Old logs cleaned up', { 
        daysToKeep, 
        deletedCount: result.deletedCount 
      });
      return result.deletedCount;
    } catch (error) {
      logger.error('Error cleaning up old logs', { 
        daysToKeep, 
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Get eligible videos for streaming (videos not streamed today)
   * @param {ObjectId} channelId - The channel to check
   * @param {Array<ObjectId>} allVideoIds - All video IDs for the channel
   * @returns {Promise<Array<ObjectId>>} - Array of eligible video IDs
   */
  async getEligibleVideos(channelId, allVideoIds) {
    try {
      const streamedToday = await this.getTodayStreamedVideos(channelId);
      const streamedTodaySet = new Set(streamedToday.map((id) => id.toString()));

      const eligible = allVideoIds.filter((videoId) => !streamedTodaySet.has(videoId.toString()));
      logger.debug('Eligible videos calculated', { 
        channelId, 
        totalVideos: allVideoIds.length, 
        eligibleCount: eligible.length 
      });
      return eligible;
    } catch (error) {
      logger.error('Error getting eligible videos', { 
        channelId, 
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Check if all videos for a channel have been streamed today
   * @param {ObjectId} channelId - The channel to check
   * @param {number} totalVideos - Total number of videos for the channel
   * @returns {Promise<boolean>} - True if all videos have been streamed today
   */
  async allVideosStreamedToday(channelId, totalVideos) {
    try {
      const streamedToday = await this.getTodayStreamedVideos(channelId);
      const allStreamed = streamedToday.length >= totalVideos;
      logger.debug('Checked if all videos streamed today', { 
        channelId, 
        totalVideos, 
        streamedCount: streamedToday.length, 
        allStreamed 
      });
      return allStreamed;
    } catch (error) {
      logger.error('Error checking if all videos streamed today', { 
        channelId, 
        totalVideos, 
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  }
}

module.exports = new DailyLogService();
