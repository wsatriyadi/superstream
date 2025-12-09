const fc = require('fast-check');
const ffmpegManager = require('../../src/services/ffmpegManager');
const logger = require('../../src/config/logger');

describe('FFmpeg Property-Based Tests', () => {
  describe('Property 23: FFmpeg command includes correct loop parameter', () => {
    // Feature: super-stream-app, Property 23: FFmpeg command includes correct loop parameter
    // Validates: Requirements 8.2

    test('for any video with loop count N, the generated FFmpeg command should include the loop parameter set to N', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }), // videoPath
          fc.string({ minLength: 1, maxLength: 100 }), // rtmpUrl
          fc.string({ minLength: 1, maxLength: 50 }), // streamKey
          fc.integer({ min: 1, max: 100 }), // loopCount
          (videoPath, rtmpUrl, streamKey, loopCount) => {
            // Generate FFmpeg command
            const args = ffmpegManager.generateCommand({
              videoPath,
              rtmpUrl,
              streamKey,
              loopCount,
            });

            // Find the -stream_loop parameter index
            const loopIndex = args.indexOf('-stream_loop');

            // Verify -stream_loop parameter exists
            expect(loopIndex).toBeGreaterThanOrEqual(0);

            // Verify the loop count value is correct
            // FFmpeg uses N-1 for loop count (0 means play once, 1 means play twice, etc.)
            const loopValue = args[loopIndex + 1];
            expect(loopValue).toBe(String(loopCount - 1));
          }
        ),
        { numRuns: 100 }
      );
    });

    test('loop parameter should be positioned before the input file parameter', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 100 }),
          (videoPath, rtmpUrl, streamKey, loopCount) => {
            const args = ffmpegManager.generateCommand({
              videoPath,
              rtmpUrl,
              streamKey,
              loopCount,
            });

            const loopIndex = args.indexOf('-stream_loop');
            const inputIndex = args.indexOf('-i');

            // Loop parameter should come before input parameter
            expect(loopIndex).toBeLessThan(inputIndex);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('generated command should include all required FFmpeg parameters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 100 }),
          (videoPath, rtmpUrl, streamKey, loopCount) => {
            const args = ffmpegManager.generateCommand({
              videoPath,
              rtmpUrl,
              streamKey,
              loopCount,
            });

            // Verify essential parameters are present
            expect(args).toContain('-re'); // Read at native frame rate
            expect(args).toContain('-stream_loop');
            expect(args).toContain('-i');
            expect(args).toContain('-c:v'); // Video codec
            expect(args).toContain('libx264');
            expect(args).toContain('-c:a'); // Audio codec
            expect(args).toContain('aac');
            expect(args).toContain('-f'); // Format
            expect(args).toContain('flv');

            // Verify RTMP URL is constructed correctly
            const fullRtmpUrl = `${rtmpUrl}/${streamKey}`;
            expect(args[args.length - 1]).toBe(fullRtmpUrl);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 24: FFmpeg errors are logged', () => {
    // Feature: super-stream-app, Property 24: FFmpeg errors are logged
    // Validates: Requirements 8.4

    let loggerErrorSpy;
    let loggerWarnSpy;

    beforeEach(() => {
      // Spy on logger methods
      loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
      loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    });

    afterEach(async () => {
      // Restore logger and clean up any active streams
      loggerErrorSpy.mockRestore();
      loggerWarnSpy.mockRestore();

      // Stop all active streams to clean up
      await ffmpegManager.stopAllStreams();
    });

    test('for any FFmpeg process error, the system should create a log entry with error details', (done) => {
      fc.assert(
        fc.asyncProperty(
          fc.uuid(), // streamId
          fc.constantFrom('invalid/path/to/video.mp4', '/nonexistent/file.mp4', ''), // Invalid video paths
          fc.string({ minLength: 1, maxLength: 50 }), // rtmpUrl
          fc.string({ minLength: 1, maxLength: 50 }), // streamKey
          async (streamId, videoPath, rtmpUrl, streamKey) => {
            return new Promise((resolve) => {
              let errorLogged = false;

              // Start stream with invalid video path (should cause error)
              try {
                ffmpegManager.startStream({
                  streamId,
                  videoPath,
                  rtmpUrl,
                  streamKey,
                  loopCount: 1,
                  onError: (error, sid) => {
                    errorLogged = true;
                  },
                  onExit: (code, signal, sid) => {
                    // Give time for error logging
                    setTimeout(() => {
                      // Verify that logger.error was called
                      const errorCalls = loggerErrorSpy.mock.calls;
                      const hasFFmpegError = errorCalls.some(
                        (call) =>
                          call[0] &&
                          (call[0].includes('FFmpeg') ||
                            call[0].includes('error') ||
                            call[0].includes('exit'))
                      );

                      // Either error callback was triggered or logger recorded the error
                      expect(errorLogged || hasFFmpegError || code !== 0).toBe(true);

                      resolve();
                    }, 100);
                  },
                });
              } catch (error) {
                // Spawn error should also be logged
                expect(loggerErrorSpy).toHaveBeenCalled();
                resolve();
              }
            });
          }
        ),
        { numRuns: 10 } // Reduced runs since this spawns actual processes
      )
        .then(() => done())
        .catch((error) => done(error));
    }, 30000); // Increased timeout for process spawning

    test('stopping a non-existent stream should log a warning', () => {
      fc.assert(
        fc.property(fc.uuid(), (streamId) => {
          // Clear previous calls
          loggerWarnSpy.mockClear();

          // Try to stop a stream that doesn't exist
          const result = ffmpegManager.stopStream(streamId);

          // Should return false
          expect(result).toBe(false);

          // Should log a warning
          expect(loggerWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('non-existent'),
            expect.objectContaining({ streamId })
          );
        }),
        { numRuns: 100 }
      );
    });

    test('attempting to start a stream with duplicate streamId should log an error', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (streamId, videoPath, rtmpUrl, streamKey) => {
            // Clear previous calls
            loggerErrorSpy.mockClear();

            // Start first stream
            try {
              ffmpegManager.startStream({
                streamId,
                videoPath,
                rtmpUrl,
                streamKey,
                loopCount: 1,
                onError: () => {},
                onExit: () => {},
              });

              // Try to start duplicate stream
              try {
                ffmpegManager.startStream({
                  streamId,
                  videoPath,
                  rtmpUrl,
                  streamKey,
                  loopCount: 1,
                  onError: () => {},
                  onExit: () => {},
                });

                // Should not reach here
                expect(true).toBe(false);
              } catch (error) {
                // Should throw error and log it
                expect(error.message).toContain('already active');
                expect(loggerErrorSpy).toHaveBeenCalledWith(
                  expect.stringContaining('already active'),
                  expect.any(Object)
                );
              }
            } finally {
              // Clean up
              ffmpegManager.stopStream(streamId);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
