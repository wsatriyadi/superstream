const Video = require('../models/Video');
const Channel = require('../models/Channel');
const logger = require('../config/logger');
const fs = require('fs').promises;
const path = require('path');

class VideoService {
  /**
   * Create a new video record with file metadata
   * @param {Object} videoData - Video data including file info
   * @returns {Promise<Object>} Created video document
   */
  async createVideo(videoData) {
    try {
      // Validate channel exists
      const channel = await Channel.findById(videoData.channelId);
      if (!channel) {
        throw new Error('Channel not found');
      }

      const video = new Video(videoData);
      await video.save();

      logger.info('Video created successfully', {
        videoId: video._id,
        channelId: video.channelId,
        title: video.title,
      });

      return video;
    } catch (error) {
      logger.error('Error creating video', {
        error: error.message,
        videoData,
      });
      throw error;
    }
  }

  /**
   * Get all videos, optionally filtered by channel
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of video documents
   */
  async getVideos(filters = {}) {
    try {
      const query = {};

      // Filter by channel if provided
      if (filters.channelId) {
        query.channelId = filters.channelId;
      }

      const videos = await Video.find(query)
        .populate('channelId', 'channelName thumbnailUrl')
        .sort({ createdAt: -1 });

      return videos;
    } catch (error) {
      logger.error('Error fetching videos', {
        error: error.message,
        filters,
      });
      throw error;
    }
  }

  /**
   * Get a single video by ID
   * @param {string} videoId - Video ID
   * @returns {Promise<Object>} Video document
   */
  async getVideoById(videoId) {
    try {
      const video = await Video.findById(videoId);

      if (!video) {
        throw new Error('Video not found');
      }

      // Try to populate channel, but don't fail if channel is missing
      await video.populate('channelId', 'channelName thumbnailUrl').catch(() => {
        // Channel might have been deleted, that's okay
        logger.warn('Channel not found for video', { videoId, channelId: video.channelId });
      });

      return video;
    } catch (error) {
      logger.error('Error fetching video by ID', {
        error: error.message,
        videoId,
      });
      throw error;
    }
  }

  /**
   * Update video metadata
   * @param {string} videoId - Video ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated video document
   */
  async updateVideo(videoId, updateData) {
    try {
      // Don't allow updating filePath
      const allowedUpdates = ['title', 'description', 'loopCount', 'thumbnailPath', 'channelId'];
      const filteredUpdates = {};

      for (const key of allowedUpdates) {
        if (updateData[key] !== undefined) {
          filteredUpdates[key] = updateData[key];
        }
      }

      const video = await Video.findByIdAndUpdate(videoId, filteredUpdates, {
        new: true,
        runValidators: true,
      });

      if (!video) {
        throw new Error('Video not found');
      }

      logger.info('Video updated successfully', {
        videoId: video._id,
        updates: filteredUpdates,
      });

      return video;
    } catch (error) {
      logger.error('Error updating video', {
        error: error.message,
        videoId,
        updateData,
      });
      throw error;
    }
  }

  /**
   * Delete a video and its associated file
   * @param {string} videoId - Video ID
   * @returns {Promise<void>}
   */
  async deleteVideo(videoId) {
    try {
      const video = await Video.findById(videoId);

      if (!video) {
        throw new Error('Video not found');
      }

      // Delete the file from disk
      try {
        await fs.unlink(video.filePath);
        logger.info('Video file deleted from disk', {
          filePath: video.filePath,
        });
      } catch (fileError) {
        logger.warn('Could not delete video file from disk', {
          filePath: video.filePath,
          error: fileError.message,
        });
        // Continue with database deletion even if file deletion fails
      }

      // Delete thumbnail if exists
      if (video.thumbnailPath) {
        try {
          await fs.unlink(video.thumbnailPath);
        } catch (thumbError) {
          logger.warn('Could not delete thumbnail file', {
            thumbnailPath: video.thumbnailPath,
            error: thumbError.message,
          });
        }
      }

      // Delete from database
      await Video.findByIdAndDelete(videoId);

      logger.info('Video deleted successfully', {
        videoId,
        title: video.title,
      });
    } catch (error) {
      logger.error('Error deleting video', {
        error: error.message,
        videoId,
      });
      throw error;
    }
  }

  /**
   * Get videos by channel ID
   * @param {string} channelId - Channel ID
   * @returns {Promise<Array>} Array of video documents
   */
  async getVideosByChannel(channelId) {
    return this.getVideos({ channelId });
  }

  /**
   * Check if a video belongs to a specific channel
   * @param {string} videoId - Video ID
   * @param {string} channelId - Channel ID
   * @returns {Promise<boolean>} True if video belongs to channel
   */
  async videobelongsToChannel(videoId, channelId) {
    try {
      const video = await Video.findById(videoId);
      if (!video) {
        return false;
      }
      return video.channelId.toString() === channelId.toString();
    } catch (error) {
      logger.error('Error checking video channel association', {
        error: error.message,
        videoId,
        channelId,
      });
      return false;
    }
  }
}

module.exports = new VideoService();
