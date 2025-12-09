const streamHistoryService = require('../services/streamHistoryService');
const channelService = require('../services/channelService');
const logger = require('../config/logger');

/**
 * Render history page
 */
exports.getHistoryPage = async (req, res) => {
  try {
    const channels = await channelService.getAllChannels();
    const history = await streamHistoryService.getStreamHistory();
    const statistics = await streamHistoryService.getStreamStatistics();

    res.render('history', {
      title: 'Stream History',
      channels,
      history,
      statistics,
      csrfToken: req.csrfToken ? req.csrfToken() : null,
      messages: {
        success: req.flash('success'),
        error: req.flash('error'),
      },
    });
  } catch (error) {
    logger.error('Error rendering history page', { error: error.message });
    req.flash('error', 'Failed to load history');
    res.redirect('/dashboard');
  }
};

/**
 * Get stream history (API)
 */
exports.getHistory = async (req, res) => {
  try {
    const { channelId, status, startDate, endDate, limit } = req.query;
    
    const filters = {};
    if (channelId) filters.channelId = channelId;
    if (status) filters.status = status;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (limit) filters.limit = parseInt(limit, 10);
    
    const history = await streamHistoryService.getStreamHistory(filters);
    
    res.json({
      success: true,
      history: history.map(h => ({
        id: h._id,
        channelName: h.channelId?.channelName,
        videoTitle: h.videoId?.title,
        videoThumbnail: h.videoId?.thumbnailPath,
        startedAt: h.startedAt,
        endedAt: h.endedAt,
        duration: h.duration,
        status: h.status,
        statistics: h.statistics,
        videoUrl: h.videoUrl,
      })),
    });
  } catch (error) {
    logger.error('Error fetching history', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch history',
    });
  }
};

/**
 * Get stream statistics (API)
 */
exports.getStatistics = async (req, res) => {
  try {
    const { channelId, startDate, endDate } = req.query;
    
    const filters = {};
    if (channelId) filters.channelId = channelId;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    
    const statistics = await streamHistoryService.getStreamStatistics(filters);
    
    res.json({
      success: true,
      statistics,
    });
  } catch (error) {
    logger.error('Error fetching statistics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
    });
  }
};

/**
 * Delete stream history
 */
exports.deleteHistory = async (req, res) => {
  try {
    const { id } = req.params;
    
    await streamHistoryService.deleteStreamHistory(id);
    
    res.json({
      success: true,
      message: 'History deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting history', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete history',
    });
  }
};
