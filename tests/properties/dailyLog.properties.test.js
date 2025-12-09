const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const DailyStreamLog = require('../../src/models/DailyStreamLog');
const Video = require('../../src/models/Video');
const Channel = require('../../src/models/Channel');
const Stream = require('../../src/models/Stream');
const dailyLogService = require('../../src/services/dailyLogService');
const { getTodayUTC, normalizeToMidnightUTC } = require('../../src/utils/dateUtils');

// Feature: super-stream-app, Property 21: Daily stream log excludes already-streamed videos
// Feature: super-stream-app, Property 28: Date change resets video eligibility
// Feature: super-stream-app, Property 29: Successful stream start creates log entry
// Validates: Requirements 7.5, 10.2, 10.4, 10.5

describe('Daily Log Property Tests', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await DailyStreamLog.deleteMany({});
    await Video.deleteMany({});
    await Channel.deleteMany({});
    await Stream.deleteMany({});
  });

  // Arbitrary for generating channel data
  const channelDataArbitrary = fc.record({
    channelId: fc.uuid(),
    channelName: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
    thumbnailUrl: fc.webUrl(),
    accessToken: fc.string({ minLength: 20, maxLength: 200 }).filter((s) => s.trim().length > 0),
    refreshToken: fc.string({ minLength: 20, maxLength: 200 }).filter((s) => s.trim().length > 0),
  });

  // Arbitrary for generating video data
  const videoDataArbitrary = fc.record({
    title: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
    description: fc.string({ maxLength: 5000 }),
    filePath: fc
      .string({ minLength: 1, maxLength: 100 })
      .filter((s) => s.trim().length > 0)
      .map((s) => `/uploads/${s.replace(/[^a-zA-Z0-9.-]/g, '_')}.mp4`),
    fileName: fc
      .string({ minLength: 1, maxLength: 100 })
      .filter((s) => s.trim().length > 0)
      .map((s) => s.replace(/[^a-zA-Z0-9.-]/g, '_') + '.mp4'),
  });

  describe('Property 21: Daily stream log excludes already-streamed videos', () => {
    test('For any video that has been streamed on the current date, the video should not appear in the eligible video pool for that channel', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelDataArbitrary,
          fc.array(videoDataArbitrary, { minLength: 2, maxLength: 10 }),
          fc.integer({ min: 0, max: 9 }), // Index of video to stream
          async (channelData, videosData, streamedVideoIndex) => {
            try {
              // Create channel
              const channel = await Channel.create(channelData);

              // Create videos
              const videos = await Promise.all(
                videosData.map((videoData) =>
                  Video.create({
                    channelId: channel._id,
                    title: videoData.title,
                    description: videoData.description,
                    filePath: videoData.filePath,
                    fileName: videoData.fileName,
                  })
                )
              );

              // Ensure we have a valid index
              const actualIndex = streamedVideoIndex % videos.length;
              const streamedVideo = videos[actualIndex];

              // Create a stream for one video
              const stream = await Stream.create({
                channelId: channel._id,
                videoId: streamedVideo._id,
                status: 'active',
                startedAt: new Date(),
              });

              // Create log entry for the streamed video (today)
              await dailyLogService.createLogEntry(streamedVideo._id, channel._id, stream._id);

              // Get all video IDs
              const allVideoIds = videos.map((v) => v._id);

              // Get eligible videos (should exclude the streamed one)
              const eligibleVideos = await dailyLogService.getEligibleVideos(
                channel._id,
                allVideoIds
              );

              // Verify the streamed video is NOT in the eligible list
              const eligibleVideoIds = eligibleVideos.map((id) => id.toString());
              expect(eligibleVideoIds).not.toContain(streamedVideo._id.toString());

              // Verify other videos ARE in the eligible list
              const otherVideos = videos.filter((v) => v._id.toString() !== streamedVideo._id.toString());
              otherVideos.forEach((video) => {
                expect(eligibleVideoIds).toContain(video._id.toString());
              });

              // Verify the count is correct
              expect(eligibleVideos.length).toBe(videos.length - 1);
            } finally {
              await DailyStreamLog.deleteMany({});
              await Stream.deleteMany({});
              await Video.deleteMany({});
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('For any set of videos where some have been streamed today, only non-streamed videos should be eligible', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelDataArbitrary,
          fc.array(videoDataArbitrary, { minLength: 3, maxLength: 10 }),
          fc.integer({ min: 1, max: 5 }), // Number of videos to stream
          async (channelData, videosData, numToStream) => {
            try {
              // Create channel
              const channel = await Channel.create(channelData);

              // Create videos
              const videos = await Promise.all(
                videosData.map((videoData) =>
                  Video.create({
                    channelId: channel._id,
                    title: videoData.title,
                    description: videoData.description,
                    filePath: videoData.filePath,
                    fileName: videoData.fileName,
                  })
                )
              );

              // Stream some videos (but not all)
              const actualNumToStream = Math.min(numToStream, videos.length - 1);
              const streamedVideos = videos.slice(0, actualNumToStream);

              for (const video of streamedVideos) {
                const stream = await Stream.create({
                  channelId: channel._id,
                  videoId: video._id,
                  status: 'active',
                  startedAt: new Date(),
                });
                await dailyLogService.createLogEntry(video._id, channel._id, stream._id);
              }

              // Get eligible videos
              const allVideoIds = videos.map((v) => v._id);
              const eligibleVideos = await dailyLogService.getEligibleVideos(
                channel._id,
                allVideoIds
              );

              // Verify streamed videos are NOT eligible
              const eligibleVideoIds = eligibleVideos.map((id) => id.toString());
              streamedVideos.forEach((video) => {
                expect(eligibleVideoIds).not.toContain(video._id.toString());
              });

              // Verify non-streamed videos ARE eligible
              const nonStreamedVideos = videos.slice(actualNumToStream);
              nonStreamedVideos.forEach((video) => {
                expect(eligibleVideoIds).toContain(video._id.toString());
              });

              // Verify count
              expect(eligibleVideos.length).toBe(videos.length - actualNumToStream);
            } finally {
              await DailyStreamLog.deleteMany({});
              await Stream.deleteMany({});
              await Video.deleteMany({});
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 28: Date change resets video eligibility', () => {
    test('For any video that was streamed on a previous date, the video should be eligible for streaming on the current date', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelDataArbitrary,
          videoDataArbitrary,
          fc.integer({ min: 1, max: 30 }), // Days in the past
          async (channelData, videoData, daysAgo) => {
            try {
              // Create channel
              const channel = await Channel.create(channelData);

              // Create video
              const video = await Video.create({
                channelId: channel._id,
                title: videoData.title,
                description: videoData.description,
                filePath: videoData.filePath,
                fileName: videoData.fileName,
              });

              // Create stream
              const stream = await Stream.create({
                channelId: channel._id,
                videoId: video._id,
                status: 'completed',
                startedAt: new Date(),
              });

              // Create log entry for a previous date
              const previousDate = new Date();
              previousDate.setDate(previousDate.getDate() - daysAgo);
              const normalizedPreviousDate = normalizeToMidnightUTC(previousDate);

              await DailyStreamLog.create({
                videoId: video._id,
                channelId: channel._id,
                streamDate: normalizedPreviousDate,
                streamId: stream._id,
              });

              // Check if video was streamed on the previous date
              const wasStreamedOnPreviousDate = await dailyLogService.hasStreamedOnDate(
                video._id,
                previousDate
              );
              expect(wasStreamedOnPreviousDate).toBe(true);

              // Check if video was streamed today (should be false)
              const wasStreamedToday = await dailyLogService.hasStreamedToday(video._id);
              expect(wasStreamedToday).toBe(false);

              // Get eligible videos for today
              const eligibleVideos = await dailyLogService.getEligibleVideos(channel._id, [
                video._id,
              ]);

              // Video should be eligible today since it was only streamed on a previous date
              expect(eligibleVideos.length).toBe(1);
              expect(eligibleVideos[0].toString()).toBe(video._id.toString());
            } finally {
              await DailyStreamLog.deleteMany({});
              await Stream.deleteMany({});
              await Video.deleteMany({});
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('For any video streamed on multiple previous dates but not today, it should be eligible today', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelDataArbitrary,
          videoDataArbitrary,
          fc.array(fc.integer({ min: 1, max: 30 }), { minLength: 2, maxLength: 5 }), // Multiple past dates
          async (channelData, videoData, daysAgoArray) => {
            try {
              // Create channel
              const channel = await Channel.create(channelData);

              // Create video
              const video = await Video.create({
                channelId: channel._id,
                title: videoData.title,
                description: videoData.description,
                filePath: videoData.filePath,
                fileName: videoData.fileName,
              });

              // Create log entries for multiple previous dates
              for (const daysAgo of daysAgoArray) {
                const previousDate = new Date();
                previousDate.setDate(previousDate.getDate() - daysAgo);
                const normalizedPreviousDate = normalizeToMidnightUTC(previousDate);

                const stream = await Stream.create({
                  channelId: channel._id,
                  videoId: video._id,
                  status: 'completed',
                  startedAt: previousDate,
                });

                await DailyStreamLog.create({
                  videoId: video._id,
                  channelId: channel._id,
                  streamDate: normalizedPreviousDate,
                  streamId: stream._id,
                });
              }

              // Check that video was NOT streamed today
              const wasStreamedToday = await dailyLogService.hasStreamedToday(video._id);
              expect(wasStreamedToday).toBe(false);

              // Get eligible videos for today
              const eligibleVideos = await dailyLogService.getEligibleVideos(channel._id, [
                video._id,
              ]);

              // Video should be eligible today
              expect(eligibleVideos.length).toBe(1);
              expect(eligibleVideos[0].toString()).toBe(video._id.toString());
            } finally {
              await DailyStreamLog.deleteMany({});
              await Stream.deleteMany({});
              await Video.deleteMany({});
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 29: Successful stream start creates log entry', () => {
    test('For any successfully started livestream, the system should immediately create a daily stream log entry with the video ID and current date', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelDataArbitrary,
          videoDataArbitrary,
          async (channelData, videoData) => {
            try {
              // Create channel
              const channel = await Channel.create(channelData);

              // Create video
              const video = await Video.create({
                channelId: channel._id,
                title: videoData.title,
                description: videoData.description,
                filePath: videoData.filePath,
                fileName: videoData.fileName,
              });

              // Create stream (simulating successful start)
              const stream = await Stream.create({
                channelId: channel._id,
                videoId: video._id,
                status: 'active',
                startedAt: new Date(),
              });

              // Create log entry (this is what should happen when stream starts)
              const logEntry = await dailyLogService.createLogEntry(
                video._id,
                channel._id,
                stream._id
              );

              // Verify log entry was created
              expect(logEntry).toBeDefined();
              expect(logEntry.videoId.toString()).toBe(video._id.toString());
              expect(logEntry.channelId.toString()).toBe(channel._id.toString());
              expect(logEntry.streamId.toString()).toBe(stream._id.toString());

              // Verify the date is today
              const today = getTodayUTC();
              expect(logEntry.streamDate.getTime()).toBe(today.getTime());

              // Verify we can query it back
              const hasStreamed = await dailyLogService.hasStreamedToday(video._id);
              expect(hasStreamed).toBe(true);

              // Verify it appears in today's streamed videos
              const streamedToday = await dailyLogService.getTodayStreamedVideos(channel._id);
              expect(streamedToday.length).toBe(1);
              expect(streamedToday[0].toString()).toBe(video._id.toString());
            } finally {
              await DailyStreamLog.deleteMany({});
              await Stream.deleteMany({});
              await Video.deleteMany({});
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('For any set of streams started on the same day, each should create a separate log entry', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelDataArbitrary,
          fc.array(videoDataArbitrary, { minLength: 2, maxLength: 5 }),
          async (channelData, videosData) => {
            try {
              // Create channel
              const channel = await Channel.create(channelData);

              // Create videos
              const videos = await Promise.all(
                videosData.map((videoData) =>
                  Video.create({
                    channelId: channel._id,
                    title: videoData.title,
                    description: videoData.description,
                    filePath: videoData.filePath,
                    fileName: videoData.fileName,
                  })
                )
              );

              // Start streams for all videos
              const logEntries = [];
              for (const video of videos) {
                const stream = await Stream.create({
                  channelId: channel._id,
                  videoId: video._id,
                  status: 'active',
                  startedAt: new Date(),
                });

                const logEntry = await dailyLogService.createLogEntry(
                  video._id,
                  channel._id,
                  stream._id
                );
                logEntries.push(logEntry);
              }

              // Verify all log entries were created
              expect(logEntries.length).toBe(videos.length);

              // Verify each video has a log entry
              for (let i = 0; i < videos.length; i++) {
                expect(logEntries[i].videoId.toString()).toBe(videos[i]._id.toString());
                expect(logEntries[i].channelId.toString()).toBe(channel._id.toString());
              }

              // Verify all videos show as streamed today
              const streamedToday = await dailyLogService.getTodayStreamedVideos(channel._id);
              expect(streamedToday.length).toBe(videos.length);

              // Verify each video is in the streamed list
              const streamedTodayIds = streamedToday.map((id) => id.toString());
              videos.forEach((video) => {
                expect(streamedTodayIds).toContain(video._id.toString());
              });
            } finally {
              await DailyStreamLog.deleteMany({});
              await Stream.deleteMany({});
              await Video.deleteMany({});
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Log entry creation is immediate and queryable', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelDataArbitrary,
          videoDataArbitrary,
          async (channelData, videoData) => {
            try {
              // Create channel and video
              const channel = await Channel.create(channelData);
              const video = await Video.create({
                channelId: channel._id,
                title: videoData.title,
                description: videoData.description,
                filePath: videoData.filePath,
                fileName: videoData.fileName,
              });

              // Before stream starts, video should not be logged
              const beforeStream = await dailyLogService.hasStreamedToday(video._id);
              expect(beforeStream).toBe(false);

              // Start stream and create log entry
              const stream = await Stream.create({
                channelId: channel._id,
                videoId: video._id,
                status: 'active',
                startedAt: new Date(),
              });

              await dailyLogService.createLogEntry(video._id, channel._id, stream._id);

              // Immediately after, video should be logged
              const afterStream = await dailyLogService.hasStreamedToday(video._id);
              expect(afterStream).toBe(true);
            } finally {
              await DailyStreamLog.deleteMany({});
              await Stream.deleteMany({});
              await Video.deleteMany({});
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
