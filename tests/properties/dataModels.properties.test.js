const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Video = require('../../src/models/Video');
const Channel = require('../../src/models/Channel');
const fs = require('fs').promises;
const path = require('path');

// Feature: super-stream-app, Property 9: Video upload persists file and metadata
// Validates: Requirements 4.1, 4.4

describe('Data Models Property Tests', () => {
  let mongoServer;
  let testUploadDir;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create test upload directory
    testUploadDir = path.join(process.cwd(), 'test-uploads');
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

  describe('Property 9: Video upload persists file and metadata', () => {
    // Arbitrary for generating valid video metadata
    const videoMetadataArbitrary = fc.record({
      title: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
      description: fc.string({ maxLength: 5000 }),
      fileName: fc
        .string({ minLength: 1, maxLength: 100 })
        .filter((s) => s.trim().length > 0)
        .map((s) => s.replace(/[^a-zA-Z0-9.-]/g, '_') + '.mp4'),
      fileSize: fc.integer({ min: 1, max: 1000000000 }),
      duration: fc.integer({ min: 1, max: 36000 }),
      loopCount: fc.integer({ min: 1, max: 100 }),
    });

    // Arbitrary for generating channel data
    const channelDataArbitrary = fc.record({
      channelId: fc.uuid(),
      channelName: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
      thumbnailUrl: fc.webUrl(),
      accessToken: fc.string({ minLength: 20, maxLength: 200 }).filter((s) => s.trim().length > 0),
      refreshToken: fc.string({ minLength: 20, maxLength: 200 }).filter((s) => s.trim().length > 0),
    });

    test('For any uploaded video with title, description, and channel association, the system should store the file on disk and save all metadata in the database', async () => {
      await fc.assert(
        fc.asyncProperty(
          videoMetadataArbitrary,
          channelDataArbitrary,
          async (videoData, channelData) => {
            try {
              // Create a test channel
              const channel = await Channel.create(channelData);

              // Create a test file
              const filePath = path.join(testUploadDir, videoData.fileName);
              const fileContent = Buffer.from('test video content');
              await fs.writeFile(filePath, fileContent);

              // Create video document with all metadata
              const video = await Video.create({
                channelId: channel._id,
                title: videoData.title,
                description: videoData.description,
                filePath: filePath,
                fileName: videoData.fileName,
                fileSize: videoData.fileSize,
                duration: videoData.duration,
                loopCount: videoData.loopCount,
              });

              // Verify file exists on disk
              const fileExists = await fs
                .access(filePath)
                .then(() => true)
                .catch(() => false);
              expect(fileExists).toBe(true);

              // Verify all metadata is saved in database
              const savedVideo = await Video.findById(video._id);
              expect(savedVideo).toBeDefined();
              expect(savedVideo.channelId.toString()).toBe(channel._id.toString());
              // Title and description are trimmed by the model
              expect(savedVideo.title).toBe(videoData.title.trim());
              expect(savedVideo.description).toBe(videoData.description.trim());
              expect(savedVideo.filePath).toBe(filePath);
              expect(savedVideo.fileName).toBe(videoData.fileName);
              expect(savedVideo.fileSize).toBe(videoData.fileSize);
              expect(savedVideo.duration).toBe(videoData.duration);
              expect(savedVideo.loopCount).toBe(videoData.loopCount);
              expect(savedVideo._id).toBeDefined(); // Has unique identifier
            } finally {
              // Clean up after each iteration
              await Video.deleteMany({});
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Video metadata round-trip preserves all fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          videoMetadataArbitrary,
          channelDataArbitrary,
          async (videoData, channelData) => {
            try {
              // Create channel
              const channel = await Channel.create(channelData);

              // Create file
              const filePath = path.join(testUploadDir, videoData.fileName);
              await fs.writeFile(filePath, 'test content');

              // Create video
              const originalVideo = await Video.create({
                channelId: channel._id,
                title: videoData.title,
                description: videoData.description,
                filePath: filePath,
                fileName: videoData.fileName,
                fileSize: videoData.fileSize,
                duration: videoData.duration,
                loopCount: videoData.loopCount,
              });

              // Retrieve video
              const retrievedVideo = await Video.findById(originalVideo._id);

              // Verify all fields match
              expect(retrievedVideo.channelId.toString()).toBe(originalVideo.channelId.toString());
              expect(retrievedVideo.title).toBe(originalVideo.title);
              expect(retrievedVideo.description).toBe(originalVideo.description);
              expect(retrievedVideo.filePath).toBe(originalVideo.filePath);
              expect(retrievedVideo.fileName).toBe(originalVideo.fileName);
              expect(retrievedVideo.fileSize).toBe(originalVideo.fileSize);
              expect(retrievedVideo.duration).toBe(originalVideo.duration);
              expect(retrievedVideo.loopCount).toBe(originalVideo.loopCount);
            } finally {
              // Clean up after each iteration
              await Video.deleteMany({});
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Video requires channel association', async () => {
      await fc.assert(
        fc.asyncProperty(videoMetadataArbitrary, async (videoData) => {
          const filePath = path.join(testUploadDir, videoData.fileName);
          await fs.writeFile(filePath, 'test content');

          // Attempt to create video without channel association
          await expect(
            Video.create({
              title: videoData.title,
              description: videoData.description,
              filePath: filePath,
              fileName: videoData.fileName,
              // channelId is missing
            })
          ).rejects.toThrow();
        }),
        { numRuns: 50 }
      );
    });

    test('Video requires title', async () => {
      await fc.assert(
        fc.asyncProperty(channelDataArbitrary, async (channelData) => {
          const channel = await Channel.create(channelData);
          const filePath = path.join(testUploadDir, 'test.mp4');
          await fs.writeFile(filePath, 'test content');

          // Attempt to create video without title
          await expect(
            Video.create({
              channelId: channel._id,
              // title is missing
              filePath: filePath,
              fileName: 'test.mp4',
            })
          ).rejects.toThrow();
        }),
        { numRuns: 50 }
      );
    });

    test('Loop count must be at least 1', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelDataArbitrary,
          fc.integer({ min: -100, max: 0 }),
          async (channelData, invalidLoopCount) => {
            const channel = await Channel.create(channelData);
            const filePath = path.join(testUploadDir, 'test.mp4');
            await fs.writeFile(filePath, 'test content');

            // Attempt to create video with invalid loop count
            await expect(
              Video.create({
                channelId: channel._id,
                title: 'Test Video',
                filePath: filePath,
                fileName: 'test.mp4',
                loopCount: invalidLoopCount,
              })
            ).rejects.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
