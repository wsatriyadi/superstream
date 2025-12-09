const { spawn } = require('child_process');
const logger = require('../config/logger');
const path = require('path');
const {
  sanitizeFilePath,
  sanitizeRtmpUrl,
  sanitizeStreamKey,
  validateLoopCount,
  sanitizeFFmpegArgs,
} = require('../utils/validators');

/**
 * FFmpegManager - Manages FFmpeg processes for streaming videos to YouTube
 * Handles process spawning, monitoring, and graceful termination
 */
class FFmpegManager {
  constructor() {
    // Store active FFmpeg processes: Map<streamId, processInfo>
    this.activeProcesses = new Map();
  }

  /**
   * Generate FFmpeg command arguments for streaming
   * @param {Object} options - Stream configuration
   * @param {string} options.videoPath - Path to video file
   * @param {string} options.rtmpUrl - RTMP server URL
   * @param {string} options.streamKey - YouTube stream key
   * @param {number} options.loopCount - Number of times to loop the video
   * @returns {Array<string>} FFmpeg command arguments
   */
  generateCommand({ videoPath, rtmpUrl, streamKey, loopCount = 1 }) {
    try {
      // Sanitize and validate all inputs to prevent command injection
      const sanitizedVideoPath = sanitizeFilePath(videoPath);
      const sanitizedRtmpUrl = sanitizeRtmpUrl(rtmpUrl);
      const sanitizedStreamKey = sanitizeStreamKey(streamKey);
      const validatedLoopCount = validateLoopCount(loopCount);

      // Construct full RTMP URL
      const fullRtmpUrl = `${sanitizedRtmpUrl}/${sanitizedStreamKey}`;

      // FFmpeg command for streaming with loop
      const args = [
        '-re', // Read input at native frame rate
        '-stream_loop',
        String(validatedLoopCount - 1), // FFmpeg uses 0 for 1 loop, 1 for 2 loops, etc.
        '-i',
        sanitizedVideoPath,
        '-c:v',
        'libx264', // Video codec
        '-preset',
        'veryfast', // Encoding preset
        '-maxrate',
        '3000k', // Maximum bitrate
        '-bufsize',
        '6000k', // Buffer size
        '-pix_fmt',
        'yuv420p', // Pixel format
        '-g',
        '50', // GOP size
        '-c:a',
        'aac', // Audio codec
        '-b:a',
        '128k', // Audio bitrate
        '-ar',
        '44100', // Audio sample rate
        '-f',
        'flv', // Output format
        fullRtmpUrl,
      ];

      // Final sanitization check on all arguments
      return sanitizeFFmpegArgs(args);
    } catch (error) {
      logger.error('Failed to generate FFmpeg command', {
        error: error.message,
        videoPath,
      });
      throw new Error(`Invalid FFmpeg parameters: ${error.message}`);
    }
  }

  /**
   * Start a new FFmpeg streaming process
   * @param {Object} options - Stream configuration
   * @param {string} options.streamId - Unique stream identifier
   * @param {string} options.videoPath - Path to video file
   * @param {string} options.rtmpUrl - RTMP server URL
   * @param {string} options.streamKey - YouTube stream key
   * @param {number} options.loopCount - Number of times to loop the video
   * @param {Function} options.onError - Error callback
   * @param {Function} options.onExit - Exit callback
   * @returns {Object} Process information
   */
  startStream({ streamId, videoPath, rtmpUrl, streamKey, loopCount = 1, onError, onExit }) {
    // Check if stream already exists
    if (this.activeProcesses.has(streamId)) {
      const error = new Error(`Stream ${streamId} is already active`);
      logger.error('Failed to start stream - already active', {
        streamId,
        error: error.message,
      });
      throw error;
    }

    // Generate FFmpeg command
    const args = this.generateCommand({ videoPath, rtmpUrl, streamKey, loopCount });

    logger.info('Starting FFmpeg stream', {
      streamId,
      videoPath,
      loopCount,
      command: `ffmpeg ${args.join(' ')}`,
    });

    // Spawn FFmpeg process
    const ffmpegProcess = spawn('ffmpeg', args);

    // Store process information
    const processInfo = {
      process: ffmpegProcess,
      pid: ffmpegProcess.pid,
      streamId,
      videoPath,
      loopCount,
      startedAt: new Date(),
      stderr: [], // Store stderr output for debugging
    };

    this.activeProcesses.set(streamId, processInfo);

    // Handle stdout (usually minimal for FFmpeg)
    ffmpegProcess.stdout.on('data', (data) => {
      logger.debug('FFmpeg stdout', {
        streamId,
        data: data.toString(),
      });
    });

    // Handle stderr (FFmpeg outputs progress here)
    ffmpegProcess.stderr.on('data', (data) => {
      const output = data.toString();
      processInfo.stderr.push(output);

      // Keep only last 50 lines to prevent memory issues
      if (processInfo.stderr.length > 50) {
        processInfo.stderr.shift();
      }

      // Log errors and warnings
      if (output.toLowerCase().includes('error')) {
        logger.error('FFmpeg error output', {
          streamId,
          output,
        });

        if (onError) {
          onError(new Error(output), streamId);
        }
      }

      // Log progress at debug level
      logger.debug('FFmpeg progress', {
        streamId,
        output: output.substring(0, 200), // Truncate long output
      });
    });

    // Handle process errors
    ffmpegProcess.on('error', (error) => {
      logger.error('FFmpeg process error', {
        streamId,
        error: error.message,
        stack: error.stack,
      });

      if (onError) {
        onError(error, streamId);
      }
    });

    // Handle process exit
    ffmpegProcess.on('exit', (code, signal) => {
      logger.info('FFmpeg process exited', {
        streamId,
        exitCode: code,
        signal,
        duration: processInfo.startedAt ? Date.now() - processInfo.startedAt.getTime() : 0,
      });

      // Log last stderr output if exit was unexpected
      if (code !== 0 && code !== null) {
        logger.error('FFmpeg unexpected exit', {
          streamId,
          exitCode: code,
          lastStderr: processInfo.stderr.slice(-10).join('\n'),
        });
      }

      // Clean up
      this.activeProcesses.delete(streamId);

      if (onExit) {
        onExit(code, signal, streamId);
      }
    });

    return {
      processId: ffmpegProcess.pid,
      streamId,
      startedAt: processInfo.startedAt,
    };
  }

  /**
   * Stop a running FFmpeg stream gracefully
   * @param {string} streamId - Stream identifier
   * @returns {boolean} True if stream was stopped, false if not found
   */
  stopStream(streamId) {
    const processInfo = this.activeProcesses.get(streamId);

    if (!processInfo) {
      logger.warn('Attempted to stop non-existent stream', { streamId });
      return false;
    }

    logger.info('Stopping FFmpeg stream', {
      streamId,
      pid: processInfo.pid,
    });

    try {
      // Send SIGTERM for graceful shutdown
      processInfo.process.kill('SIGTERM');

      // Set timeout to force kill if graceful shutdown fails
      setTimeout(() => {
        if (this.activeProcesses.has(streamId)) {
          logger.warn('Force killing FFmpeg process after timeout', {
            streamId,
            pid: processInfo.pid,
          });
          processInfo.process.kill('SIGKILL');
        }
      }, 5000); // 5 second timeout

      return true;
    } catch (error) {
      logger.error('Error stopping FFmpeg stream', {
        streamId,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get information about an active stream
   * @param {string} streamId - Stream identifier
   * @returns {Object|null} Process information or null if not found
   */
  getStreamInfo(streamId) {
    const processInfo = this.activeProcesses.get(streamId);

    if (!processInfo) {
      return null;
    }

    return {
      streamId: processInfo.streamId,
      pid: processInfo.pid,
      videoPath: processInfo.videoPath,
      loopCount: processInfo.loopCount,
      startedAt: processInfo.startedAt,
      uptime: Date.now() - processInfo.startedAt.getTime(),
    };
  }

  /**
   * Get all active streams
   * @returns {Array<Object>} Array of active stream information
   */
  getAllActiveStreams() {
    return Array.from(this.activeProcesses.values()).map((processInfo) => ({
      streamId: processInfo.streamId,
      pid: processInfo.pid,
      videoPath: processInfo.videoPath,
      loopCount: processInfo.loopCount,
      startedAt: processInfo.startedAt,
      uptime: Date.now() - processInfo.startedAt.getTime(),
    }));
  }

  /**
   * Stop all active streams (for graceful shutdown)
   * @returns {Promise<void>}
   */
  async stopAllStreams() {
    logger.info('Stopping all FFmpeg streams', {
      count: this.activeProcesses.size,
    });

    const streamIds = Array.from(this.activeProcesses.keys());

    for (const streamId of streamIds) {
      this.stopStream(streamId);
    }

    // Wait for all processes to exit (with timeout)
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.activeProcesses.size === 0) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // Force resolve after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        if (this.activeProcesses.size > 0) {
          logger.warn('Some FFmpeg processes did not exit gracefully', {
            remaining: this.activeProcesses.size,
          });
        }
        resolve();
      }, 10000);
    });
  }

  /**
   * Check if a stream is active
   * @param {string} streamId - Stream identifier
   * @returns {boolean} True if stream is active
   */
  isStreamActive(streamId) {
    return this.activeProcesses.has(streamId);
  }
}

// Export singleton instance
module.exports = new FFmpegManager();
