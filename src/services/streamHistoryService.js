const StreamHistory = require('../models/StreamHistory');
const logger = require('../config/logger');

/**
 * Create stream history record
 */
exports.createStreamHistory = async (data) => {
  try {
    const history = new StreamHistory(data);
    await history.save();
    logger.info('Stream history created', { historyId: history._id });
    return history;
  } catch (error) {
    logger.error('Error creating stream history', { error: error.message });
    throw error;
  }
};

/**
 * Update stream history
 */
exports.updateStreamHistory = async (id, data) => {
  try {
    const history = await StreamHistory.findByIdAndUpdate(id, data, { new: true })
      .populate('channelId', 'channelName')
      .populate('videoId', 'title fileName');
    
    if (!history) {
      throw new Error('Stream history not found');
    }
    
    logger.info('Stream history updated', { historyId: id });
    return history;
  } catch (error) {
    logger.error('Error updating stream history', { error: error.message });
    throw error;
  }
};

/**
 * Get all stream history with filters
 */
exports.getStreamHistory = async (filters = {}) => {
  try {
    const query = {};
    
    if (filters.channelId) {
      query.channelId = filters.channelId;
    }
    
    if (filters.status) {
      query.status = filters.status;
    }
    
    if (filters.startDate || filters.endDate) {
      query.startedAt = {};
      if (filters.startDate) {
        query.startedAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.startedAt.$lte = new Date(filters.endDate);
      }
    }
    
    const history = await StreamHistory.find(query)
      .populate('channelId', 'channelName')
      .populate('videoId', 'title fileName thumbnailPath')
      .sort({ startedAt: -1 })
      .limit(filters.limit || 100);
    
    return history;
  } catch (error) {
    logger.error('Error fetching stream history', { error: error.message });
    throw error;
  }
};

/**
 * Get stream history by ID
 */
exports.getStreamHistoryById = async (id) => {
  try {
    const history = await StreamHistory.findById(id)
      .populate('channelId', 'channelName channelId')
      .populate('videoId', 'title fileName thumbnailPath');
    
    if (!history) {
      throw new Error('Stream history not found');
    }
    
    return history;
  } catch (error) {
    logger.error('Error fetching stream history', { error: error.message });
    throw error;
  }
};

/**
 * Get stream statistics summary
 */
exports.getStreamStatistics = async (filters = {}) => {
  try {
    const matchStage = { status: 'completed' };
    
    if (filters.channelId) {
      matchStage.channelId = filters.channelId;
    }
    
    if (filters.startDate || filters.endDate) {
      matchStage.startedAt = {};
      if (filters.startDate) {
        matchStage.startedAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        matchStage.startedAt.$lte = new Date(filters.endDate);
      }
    }
    
    const stats = await StreamHistory.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalStreams: { $sum: 1 },
          totalDuration: { $sum: '$duration' },
          totalViews: { $sum: '$statistics.totalViews' },
          totalLikes: { $sum: '$statistics.likes' },
          totalComments: { $sum: '$statistics.comments' },
          avgPeakViewers: { $avg: '$statistics.peakViewers' },
          maxPeakViewers: { $max: '$statistics.peakViewers' },
        },
      },
    ]);
    
    return stats[0] || {
      totalStreams: 0,
      totalDuration: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      avgPeakViewers: 0,
      maxPeakViewers: 0,
    };
  } catch (error) {
    logger.error('Error fetching stream statistics', { error: error.message });
    throw error;
  }
};

/**
 * Delete stream history
 */
exports.deleteStreamHistory = async (id) => {
  try {
    const history = await StreamHistory.findByIdAndDelete(id);
    
    if (!history) {
      throw new Error('Stream history not found');
    }
    
    logger.info('Stream history deleted', { historyId: id });
    return history;
  } catch (error) {
    logger.error('Error deleting stream history', { error: error.message });
    throw error;
  }
};
