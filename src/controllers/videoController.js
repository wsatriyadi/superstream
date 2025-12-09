const videoService = require('../services/videoService');
const channelService = require('../services/channelService');
const logger = require('../config/logger');
const { validationResult } = require('express-validator');
const Settings = require('../models/Settings');

/**
 * Middleware to check file size against settings
 */
exports.checkFileSize = async (req, res, next) => {
  try {
    // Only check if files were uploaded
    if (!req.files && !req.file) {
      return next();
    }

    const settings = await Settings.getSettings();
    const maxUploadSize = settings.maxUploadSize || 5368709120; // 5GB default

    // Check video file size
    const videoFile = req.files?.video?.[0] || req.file;
    if (videoFile && videoFile.size > maxUploadSize) {
      const maxSizeGB = (maxUploadSize / 1073741824).toFixed(2);
      const fileSizeGB = (videoFile.size / 1073741824).toFixed(2);
      
      // Clean up the uploaded file
      const fs = require('fs').promises;
      try {
        await fs.unlink(videoFile.path);
      } catch (unlinkError) {
        logger.error('Failed to clean up oversized file', { error: unlinkError.message });
      }

      return res.status(413).json({
        success: false,
        errors: [`File size (${fileSizeGB} GB) exceeds maximum allowed size (${maxSizeGB} GB)`],
      });
    }

    next();
  } catch (error) {
    logger.error('Error checking file size', { error: error.message });
    next(error);
  }
};

/**
 * Render the gallery page
 */
exports.getGalleryPage = async (req, res) => {
  try {
    const channels = await channelService.getAllChannels();
    const videos = await videoService.getVideos();

    res.render('gallery', {
      title: 'Video Gallery',
      channels,
      videos,
      csrfToken: req.csrfToken ? req.csrfToken() : null,
      messages: {
        success: req.flash('success'),
        error: req.flash('error'),
      },
    });
  } catch (error) {
    logger.error('Error rendering gallery page', { error: error.message });
    req.flash('error', 'Failed to load gallery');
    res.redirect('/dashboard');
  }
};

/**
 * Handle video upload
 */
exports.uploadVideo = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map((err) => err.msg);
      return res.status(400).json({
        success: false,
        errors: errorMessages,
      });
    }

    // Check if video file was uploaded
    if (!req.files || !req.files.video || !req.files.video[0]) {
      return res.status(400).json({
        success: false,
        errors: ['No video file uploaded'],
      });
    }

    const videoFile = req.files.video[0];
    const thumbnailFile = req.files.thumbnail ? req.files.thumbnail[0] : null;
    const { title, description, channelId, loopCount } = req.body;

    // Create video record
    const videoData = {
      channelId,
      title,
      description: description || '',
      filePath: videoFile.path,
      fileName: videoFile.filename,
      fileSize: videoFile.size,
      loopCount: loopCount ? parseInt(loopCount, 10) : 1,
    };

    // Add thumbnail path if uploaded
    if (thumbnailFile) {
      videoData.thumbnailPath = `/uploads/thumbnails/${thumbnailFile.filename}`;
    }

    const video = await videoService.createVideo(videoData);

    logger.info('Video uploaded successfully', {
      videoId: video._id,
      title: video.title,
      channelId: video.channelId,
      hasThumbnail: !!thumbnailFile,
    });

    res.status(201).json({
      success: true,
      message: 'Video uploaded successfully',
      video: {
        id: video._id,
        title: video.title,
        description: video.description,
        channelId: video.channelId,
        fileName: video.fileName,
        fileSize: video.fileSize,
        loopCount: video.loopCount,
        thumbnailPath: video.thumbnailPath,
        uploadedAt: video.uploadedAt,
      },
    });
  } catch (error) {
    logger.error('Error uploading video', {
      error: error.message,
      body: req.body,
    });

    // Clean up uploaded files if video creation failed
    const fs = require('fs').promises;
    if (req.files) {
      if (req.files.video && req.files.video[0]) {
        try {
          await fs.unlink(req.files.video[0].path);
        } catch (unlinkError) {
          logger.error('Failed to clean up video file', { error: unlinkError.message });
        }
      }
      if (req.files.thumbnail && req.files.thumbnail[0]) {
        try {
          await fs.unlink(req.files.thumbnail[0].path);
        } catch (unlinkError) {
          logger.error('Failed to clean up thumbnail file', { error: unlinkError.message });
        }
      }
    }

    res.status(500).json({
      success: false,
      errors: [error.message || 'Failed to upload video'],
    });
  }
};

/**
 * Get all videos with optional channel filter
 */
exports.getVideos = async (req, res) => {
  try {
    const { channelId } = req.query;

    const filters = {};
    if (channelId) {
      filters.channelId = channelId;
    }

    const videos = await videoService.getVideos(filters);

    res.json({
      success: true,
      videos: videos.map((video) => ({
        id: video._id,
        title: video.title,
        description: video.description,
        channelId: video.channelId._id,
        channelName: video.channelId.channelName,
        fileName: video.fileName,
        fileSize: video.fileSize,
        duration: video.duration,
        loopCount: video.loopCount,
        thumbnailPath: video.thumbnailPath,
        uploadedAt: video.uploadedAt,
        createdAt: video.createdAt,
      })),
    });
  } catch (error) {
    logger.error('Error fetching videos', {
      error: error.message,
      query: req.query,
    });

    res.status(500).json({
      success: false,
      errors: ['Failed to fetch videos'],
    });
  }
};

/**
 * Get a single video by ID
 */
exports.getVideoById = async (req, res) => {
  try {
    const { id } = req.params;
    const video = await videoService.getVideoById(id);

    res.json({
      success: true,
      video: {
        id: video._id,
        title: video.title,
        description: video.description,
        channelId: video.channelId?._id || video.channelId,
        channelName: video.channelId?.channelName || 'Unknown Channel',
        fileName: video.fileName,
        fileSize: video.fileSize,
        duration: video.duration,
        loopCount: video.loopCount,
        thumbnailPath: video.thumbnailPath,
        uploadedAt: video.uploadedAt,
        createdAt: video.createdAt,
      },
    });
  } catch (error) {
    logger.error('Error fetching video', {
      error: error.message,
      videoId: req.params.id,
    });

    res.status(404).json({
      success: false,
      errors: ['Video not found'],
    });
  }
};

/**
 * Update a video
 */
exports.updateVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, loopCount, channelId } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (loopCount !== undefined) updateData.loopCount = parseInt(loopCount, 10);
    if (channelId !== undefined && channelId !== '') updateData.channelId = channelId;

    // Add thumbnail if uploaded
    if (req.file) {
      updateData.thumbnailPath = `/uploads/thumbnails/${req.file.filename}`;
    }

    const video = await videoService.updateVideo(id, updateData);

    logger.info('Video updated via API', { videoId: id, updateData, hasThumbnail: !!req.file });

    res.json({
      success: true,
      message: 'Video updated successfully',
      video: {
        id: video._id,
        title: video.title,
        description: video.description,
        loopCount: video.loopCount,
        channelId: video.channelId,
        thumbnailPath: video.thumbnailPath,
      },
    });
  } catch (error) {
    logger.error('Error updating video', {
      error: error.message,
      videoId: req.params.id,
    });

    // Clean up uploaded thumbnail if update failed
    if (req.file) {
      const fs = require('fs').promises;
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        logger.error('Failed to clean up thumbnail file', { error: unlinkError.message });
      }
    }

    const statusCode = error.message === 'Video not found' ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      errors: [error.message || 'Failed to update video'],
    });
  }
};

/**
 * Delete a video
 */
exports.deleteVideo = async (req, res) => {
  try {
    const { id } = req.params;

    await videoService.deleteVideo(id);

    logger.info('Video deleted via API', { videoId: id });

    res.json({
      success: true,
      message: 'Video deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting video', {
      error: error.message,
      videoId: req.params.id,
    });

    const statusCode = error.message === 'Video not found' ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      errors: [error.message || 'Failed to delete video'],
    });
  }
};


/**
 * Download video from external URL
 */
exports.downloadFromUrl = async (req, res) => {
  const { downloadQueue } = require('../services/downloadQueue');
  const { v4: uuidv4 } = require('uuid');

  try {
    const { url, title, description, channelId, loopCount } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        errors: ['URL is required'],
      });
    }

    // Handle thumbnail if uploaded
    let thumbnailPath = null;
    if (req.file) {
      thumbnailPath = `/uploads/thumbnails/${req.file.filename}`;
    }

    // Create unique job ID
    const jobId = uuidv4();

    // Add to queue with no timeout
    const job = await downloadQueue.add({
      jobId,
      url,
      title,
      description,
      channelId,
      loopCount,
      thumbnailPath,
    }, {
      timeout: 0, // No timeout for large file downloads
      attempts: 3, // Retry up to 3 times on failure
    });

    logger.info('Video download job created', {
      jobId,
      queueJobId: job.id,
      url,
    });

    res.status(202).json({
      success: true,
      message: 'Download started',
      jobId,
      queueJobId: job.id,
    });
  } catch (error) {
    logger.error('Error creating download job', {
      error: error.message,
      url: req.body.url,
    });

    // Clean up thumbnail if job creation failed
    if (req.file) {
      const fs = require('fs');
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        logger.error('Failed to clean up thumbnail file', { error: unlinkError.message });
      }
    }

    res.status(500).json({
      success: false,
      errors: [error.message || 'Failed to start download'],
    });
  }
};

/**
 * Get download job status
 */
exports.getDownloadStatus = async (req, res) => {
  const { downloadQueue } = require('../services/downloadQueue');
  const { jobId } = req.params;

  try {
    const jobs = await downloadQueue.getJobs(['waiting', 'active', 'completed', 'failed']);
    const job = jobs.find(j => j.data.jobId === jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    const state = await job.getState();
    const progress = job._progress || { loaded: 0, total: 0, percent: 0, speed: 0 };

    res.json({
      success: true,
      jobId,
      state,
      progress,
    });
  } catch (error) {
    logger.error('Error getting download status', {
      error: error.message,
      jobId,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get download status',
    });
  }
};

/**
 * SSE endpoint for download progress
 */
exports.downloadProgress = async (req, res) => {
  const { addSSEClient, removeSSEClient, downloadQueue } = require('../services/downloadQueue');
  const { jobId } = req.params;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Add client
  addSSEClient(jobId, res);

  // Send initial state
  try {
    const jobs = await downloadQueue.getJobs(['waiting', 'active', 'completed', 'failed']);
    const job = jobs.find(j => j.data.jobId === jobId);

    if (job) {
      const state = await job.getState();
      const progress = job._progress || { loaded: 0, total: 0, percent: 0, speed: 0 };
      res.write(`data: ${JSON.stringify({ ...progress, state })}\n\n`);
    }
  } catch (error) {
    logger.error('Error sending initial SSE state', { error: error.message });
  }

  // Handle client disconnect
  req.on('close', () => {
    removeSSEClient(jobId, res);
  });
};
