const Bull = require('bull');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);
const videoService = require('./videoService');
const logger = require('../config/logger');
const { sanitizeFilename } = require('../utils/validators');

// Create queue
const downloadQueue = new Bull('video-downloads', {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
  },
});

// Store for SSE clients
const sseClients = new Map();

// Process download jobs with extended timeout
downloadQueue.process({ timeout: 0 }, async (job) => {
  const { url, title, description, channelId, loopCount, thumbnailPath, jobId } = job.data;

  try {
    // Convert Google Drive link
    let downloadUrl = url;
    const gdriveLinkMatch = url.match(/\/file\/d\/([^\/]+)/);
    if (gdriveLinkMatch) {
      const fileId = gdriveLinkMatch[1];
      downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    }

    logger.info('Starting background video download', { jobId, url: downloadUrl });

    // Get file info
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream',
      maxRedirects: 5,
      timeout: 0,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    // Get filename
    let filename = 'video.mp4';
    const contentDisposition = response.headers['content-disposition'];
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
      if (filenameMatch) filename = filenameMatch[1];
    } else {
      const urlPath = new URL(url).pathname;
      const urlFilename = path.basename(urlPath);
      if (urlFilename) filename = urlFilename;
    }

    // Sanitize filename
    const ext = path.extname(filename);
    const basename = path.basename(filename, ext);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitizedFilename = `${sanitizeFilename(basename)}-${uniqueSuffix}${ext || '.mp4'}`;

    // Save file
    const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads/videos');
    const filePath = path.join(uploadDir, sanitizedFilename);

    let downloaded = 0;
    let lastTime = Date.now();
    let lastLoaded = 0;

    const writeStream = fs.createWriteStream(filePath);
    
    response.data.on('data', (chunk) => {
      downloaded += chunk.length;
      const now = Date.now();
      const timeDiff = (now - lastTime) / 1000;
      
      if (timeDiff >= 0.5) {
        const speed = (downloaded - lastLoaded) / timeDiff;
        lastTime = now;
        lastLoaded = downloaded;
        
        const progress = {
          loaded: downloaded,
          total: parseInt(response.headers['content-length']) || 0,
          percent: response.headers['content-length'] 
            ? Math.round((downloaded / parseInt(response.headers['content-length'])) * 100) 
            : 0,
          speed: Math.round(speed),
        };
        
        job.progress(progress);
        sendProgressToClients(jobId, progress);
      }
    });

    await pipeline(response.data, writeStream);

    // Get file size
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    // Create video record
    const videoData = {
      channelId,
      title: title || basename,
      description: description || '',
      filePath,
      fileName: sanitizedFilename,
      fileSize,
      loopCount: loopCount ? parseInt(loopCount, 10) : 1,
    };

    if (thumbnailPath) {
      videoData.thumbnailPath = thumbnailPath;
    }

    const video = await videoService.createVideo(videoData);

    logger.info('Background video download completed', {
      jobId,
      videoId: video._id,
      title: video.title,
    });

    return { success: true, video };
  } catch (error) {
    logger.error('Background video download failed', {
      jobId,
      error: error.message,
    });
    throw error;
  }
});

// Send progress to SSE clients
function sendProgressToClients(jobId, progress) {
  const clients = sseClients.get(jobId);
  if (clients) {
    const data = JSON.stringify(progress);
    clients.forEach((client) => {
      client.write(`data: ${data}\n\n`);
    });
  }
}

// Add SSE client
function addSSEClient(jobId, res) {
  if (!sseClients.has(jobId)) {
    sseClients.set(jobId, new Set());
  }
  sseClients.get(jobId).add(res);
}

// Remove SSE client
function removeSSEClient(jobId, res) {
  const clients = sseClients.get(jobId);
  if (clients) {
    clients.delete(res);
    if (clients.size === 0) {
      sseClients.delete(jobId);
    }
  }
}

module.exports = {
  downloadQueue,
  addSSEClient,
  removeSSEClient,
};
