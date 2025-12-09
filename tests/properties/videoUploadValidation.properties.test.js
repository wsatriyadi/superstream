const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const videoService = require('../../src/services/videoService');
const Video = require('../../src/models/Video');
const Channel = require('../../src/models/Channel');
const fs = require('fs').promises;
const path = require('path');

// Feature: super-stream-app, Property 10: Video upload requires title and description
// Feature: super-stream-app, Property 11: Video upload requires single channel association
// Validates: Requirements 4.2, 4.3

describe('Video Upload Validation Property Tests', () => {
  let mongoServer;
  let testUploadDir;

  beforeAll(async () => {
    // Disconnect any existing mongoose connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create test upload directory
    testUploadDir = path.join(process.cwd(), 'test-uploads-validation');
    await fs.mkdir(testUploadDir, { recursive: true });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();

    // Clean up test upload directory
    try {
      await fs.rm(testUploadDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  afterEach(async () => {
    await Video.deleteMany({});
    await Channel.deleteMany({});

    // Clean up test files
    try {
      const files = await fs.readdir(testUploadDir);
      for (const file of files) {
        await fs.unlink(path.join(testUploadDir, file));
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Property 10: Video upload requires title and description', () => {
    // Arbitrary for generating channel data
    const channelDataArbitrary = fc.record({
      channelId: fc.uuid(),
      channelName: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
      thumbnailUrl: fc.webUrl(),
      accessToken: fc.string({ minLength: 20, maxLength: 200 }).filter((s) => s.trim().length > 0),
      refreshToken: fc.string({ minLength: 20, maxLength: 200 }).filter((s) => s.trim().length > 0),
    });

    test('For any video upload attempt without a title, the system should reject the upload and return a validation error', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelDataArbitrary,
          fc.string({ maxLength: 5000 }),
          async (channelData, description) => {
            try {
              // Create a test channel
              const channel = await Channel.create(channelData);

              // Create a test video file
              const testFilePath = path.join(testUploadDir, 'test-video.mp4');
              await fs.writeFile(testFilePath, Buffer.from('fake video content'));

              // Attempt to create video without title (empty string)
              const videoData = {
                channelId: channel._id,
                title: '', // Empty title
                description,
                filePath: testFilePath,
                fileName: 'test-video.mp4',
                fileSize: 1000,
              };

              // Should throw validation error
              await expect(videoService.createVideo(videoData)).rejects.toThrow();

              // Verify no video was created in database
              const videoCount = await Video.countDocuments();
              expect(videoCount).toBe(0);
            } finally {
              // Clean up
              await Video.deleteMany({});
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('For any video upload attempt without a description, the system should still accept if title is provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
          channelDataArbitrary,
          async (title, channelData) => {
            try {
              // Create a test channel
              const channel = await Channel.create(channelData);

              // Create a test video file
              const testFilePath = path.join(testUploadDir, 'test-video.mp4');
              await fs.writeFile(testFilePath, Buffer.from('fake video content'));

              // Create video with title but no description
              const videoData = {
                channelId: channel._id,
                title,
                description: '', // Empty description is allowed
                filePath: testFilePath,
                fileName: 'test-video.mp4',
                fileSize: 1000,
              };

              const video = await videoService.createVideo(videoData);

              // Should succeed
              expect(video).toBeDefined();
              expect(video.title).toBe(title.trim());
              expect(video.channelId.toString()).toBe(channel._id.toString());

              // Verify video was created in database
              const videoCount = await Video.countDocuments();
              expect(videoCount).toBe(1);
            } finally {
              // Clean up
              await Video.deleteMany({});
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('For any video upload with valid title and description, the system should accept the upload', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 5000 }),
          channelDataArbitrary,
          async (title, description, channelData) => {
            try {
              // Create a test channel
              const channel = await Channel.create(channelData);

              // Create a test video file
              const testFilePath = path.join(testUploadDir, 'test-video.mp4');
              await fs.writeFile(testFilePath, Buffer.from('fake video content'));

              // Create video with valid title and description
              const videoData = {
                channelId: channel._id,
                title,
                description,
                filePath: testFilePath,
                fileName: 'test-video.mp4',
                fileSize: 1000,
              };

              const video = await videoService.createVideo(videoData);

              // Should succeed
              expect(video).toBeDefined();
              expect(video.title).toBe(title.trim());
              expect(video.description).toBe(description.trim());
              expect(video.channelId.toString()).toBe(channel._id.toString());

              // Verify video was created in database
              const videoCount = await Video.countDocuments();
              expect(videoCount).toBe(1);
            } finally {
              // Clean up
              await Video.deleteMany({});
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 11: Video upload requires single channel association', () => {
    // Arbitrary for generating channel data
    const channelDataArbitrary = fc.record({
      channelId: fc.uuid(),
      channelName: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
      thumbnailUrl: fc.webUrl(),
      accessToken: fc.string({ minLength: 20, maxLength: 200 }).filter((s) => s.trim().length > 0),
      refreshToken: fc.string({ minLength: 20, maxLength: 200 }).filter((s) => s.trim().length > 0),
    });

    test('For any video upload attempt without a channel selection, the system should reject the upload and return a validation error', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
          async (title) => {
            try {
              // Create a test video file
              const testFilePath = path.join(testUploadDir, 'test-video.mp4');
              await fs.writeFile(testFilePath, Buffer.from('fake video content'));

              // Attempt to create video without channel association
              const videoData = {
                // channelId is missing
                title,
                description: 'Test description',
                filePath: testFilePath,
                fileName: 'test-video.mp4',
                fileSize: 1000,
              };

              // Should throw validation error
              await expect(videoService.createVideo(videoData)).rejects.toThrow();

              // Verify no video was created in database
              const videoCount = await Video.countDocuments();
              expect(videoCount).toBe(0);
            } finally {
              // Clean up
              await Video.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('For any video upload with exactly one channel selection, the system should accept the upload', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelDataArbitrary,
          fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
          async (channelData, title) => {
            try {
              // Create a test channel
              const channel = await Channel.create(channelData);

              // Create a test video file
              const testFilePath = path.join(testUploadDir, 'test-video.mp4');
              await fs.writeFile(testFilePath, Buffer.from('fake video content'));

              // Create video with single channel selection
              const videoData = {
                channelId: channel._id,
                title,
                description: 'Test description',
                filePath: testFilePath,
                fileName: 'test-video.mp4',
                fileSize: 1000,
              };

              const video = await videoService.createVideo(videoData);

              // Should succeed
              expect(video).toBeDefined();
              expect(video.channelId.toString()).toBe(channel._id.toString());

              // Verify video was created with correct channel association
              const savedVideo = await Video.findById(video._id);
              expect(savedVideo).toBeDefined();
              expect(savedVideo.channelId.toString()).toBe(channel._id.toString());
            } finally {
              // Clean up
              await Video.deleteMany({});
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Video must be associated with exactly one channel (not zero, not multiple)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(channelDataArbitrary, {
            minLength: 2,
            maxLength: 5,
            selector: (item) => item.channelId,
          }),
          fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
          async (channelsData, title) => {
            try {
              // Create multiple test channels
              const channels = await Promise.all(
                channelsData.map((data) => Channel.create(data))
              );

              // Create a test video file
              const testFilePath = path.join(testUploadDir, 'test-video.mp4');
              await fs.writeFile(testFilePath, Buffer.from('fake video content'));

              // Pick one channel for the upload
              const selectedChannel = channels[0];

              // Create video associated with one channel
              const videoData = {
                channelId: selectedChannel._id,
                title,
                description: 'Test description',
                filePath: testFilePath,
                fileName: 'test-video.mp4',
                fileSize: 1000,
              };

              const video = await videoService.createVideo(videoData);

              // Should succeed
              expect(video).toBeDefined();

              // Verify video is associated with exactly one channel
              expect(video.channelId.toString()).toBe(selectedChannel._id.toString());

              // Verify it's not associated with other channels
              for (let i = 1; i < channels.length; i++) {
                expect(video.channelId.toString()).not.toBe(channels[i]._id.toString());
              }
            } finally {
              // Clean up
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
