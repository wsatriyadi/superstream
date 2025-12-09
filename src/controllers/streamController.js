const streamService = require('../services/streamService');
const logger = require('../config/logger');

/**
 * StreamController - Handles HTTP requests for stream management
 */
class StreamController {
  /**
   * Render the Live Menu page with active streams
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  async renderLivePage(req, res) {
    try {
      const activeStreams = await streamService.getActiveStreams();

      res.render('live', {
        title: 'Live Streams',
        streams: activeStreams,
        csrfToken: req.csrfToken ? req.csrfToken() : null,
        messages: {
          success: req.flash('success'),
          error: req.flash('error'),
        },
      });
    } catch (error) {
      logger.error('Failed to render live page', {
        error: error.message,
      });

      req.flash('error', 'Failed to load active streams');
      res.render('live', {
        title: 'Live Streams',
        streams: [],
        csrfToken: req.csrfToken ? req.csrfToken() : null,
        messages: {
          success: req.flash('success'),
          error: req.flash('error'),
        },
      });
    }
  }

  /**
   * Get active streams as JSON
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  async getActiveStreams(req, res) {
    try {
      const activeStreams = await streamService.getActiveStreams();

      res.json({
        success: true,
        streams: activeStreams,
      });
    } catch (error) {
      logger.error('Failed to get active streams', {
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve active streams',
      });
    }
  }

  /**
   * Stop a stream manually
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  async stopStream(req, res) {
    try {
      const { streamId } = req.params;

      if (!streamId) {
        return res.status(400).json({
          success: false,
          error: 'Stream ID is required',
        });
      }

      const stopped = await streamService.stopStream(streamId);

      if (stopped) {
        req.flash('success', 'Stream stopped successfully');
        res.json({
          success: true,
          message: 'Stream stopped successfully',
        });
      } else {
        req.flash('error', 'Stream could not be stopped or was already inactive');
        res.status(400).json({
          success: false,
          error: 'Stream could not be stopped or was already inactive',
        });
      }
    } catch (error) {
      logger.error('Failed to stop stream', {
        streamId: req.params.streamId,
        error: error.message,
      });

      req.flash('error', 'Failed to stop stream');
      res.status(500).json({
        success: false,
        error: 'Failed to stop stream',
      });
    }
  }

  /**
   * Get stream details by ID
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  async getStreamById(req, res) {
    try {
      const { streamId } = req.params;

      if (!streamId) {
        return res.status(400).json({
          success: false,
          error: 'Stream ID is required',
        });
      }

      const stream = await streamService.getStreamById(streamId);

      if (!stream) {
        return res.status(404).json({
          success: false,
          error: 'Stream not found',
        });
      }

      res.json({
        success: true,
        stream,
      });
    } catch (error) {
      logger.error('Failed to get stream details', {
        streamId: req.params.streamId,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve stream details',
      });
    }
  }
}

module.exports = new StreamController();
