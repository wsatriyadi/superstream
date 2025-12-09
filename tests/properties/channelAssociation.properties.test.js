const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const videoService = require('../../src/services/videoService');
const Video = require('../../src/models/Video');
const Channel = require('../../src/models/Channel');
const fs = require('fs').promises;
const path = require('path');

// Feature: super-stream-app, Property 12: Video retrieval enforces channel association
// Validates: Requirements 4.5

describe('Channel Association Property Tests', () => {
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
    testUploadDir = path.join(process.cwd(), 'test-uploads-association');
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

  describe('Property 12: Video retrieval enforces channel association', () => {
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
      fileName: fc
        .string({ minLength: 1, maxLength: 100 })
        .filter((s) => s.trim().length > 0)
        .map((s) => s.replace(/[^a-zA-Z0-9.-]/g, '_') + '.mp4'),
      fileSize: fc.integer({ min: 1, max: 1000000000 }),
    });

    test('For any video retrieval operation with a channel context, all returned videos should belong exclusively to that channel', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(channelDataArbitrary, {
            minLength: 2,
            maxLength: 5,
            selector: (item) => item.channelId,
          }),
          fc.array(videoDataArbitrary, { minLength: 1, maxLength: 10 }),
          async (channelsData, videosData) => {
            try {
              // Create multiple channels
              const channels = await Promise.all(
                channelsData.map((data) => Channel.create(data))
              );

              // Create videos associated with different channels
              const videos = [];
              for (let i = 0; i < videosData.length; i++) {
                const videoData = videosData[i];
                const channel = channels[i % channels.length]; // Distribute videos across channels

                const testFilePath = path.join(testUploadDir, videoData.fileName);
                await fs.writeFile(testFilePath, Buffer.from('test video content'));

                const video = await videoService.createVideo({
                  channelId: channel._id,
                  title: videoData.title,
                  description: videoData.description,
                  filePath: testFilePath,
                  fileName: videoData.fileName,
                  fileSize: videoData.fileSize,
                });

                videos.push({ video, channelId: channel._id });
              }

              // For each channel, retrieve videos and verify they all belong to that channel
              for (const channel of channels) {
                const retrievedVideos = await videoService.getVideosByChannel(
                  channel._id.toString()
                );

                // All retrieved videos should belong to this channel
                for (const video of retrievedVideos) {
                  const videoChannelId = video.channelId._id
                    ? video.channelId._id.toString()
                    : video.channelId.toString();
                  expect(videoChannelId).toBe(channel._id.toString());
                }

                // Count how many videos should belong to this channel
                const expectedCount = videos.filter(
                  (v) => v.channelId.toString() === channel._id.toString()
                ).length;

                // The number of retrieved videos should match the expected count
                expect(retrievedVideos.length).toBe(expectedCount);
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

    test('For any channel, retrieving videos should never return videos from other channels', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(channelDataArbitrary, {
            minLength: 2,
            maxLength: 5,
            selector: (item) => item.channelId,
          }),
          fc.array(videoDataArbitrary, { minLength: 2, maxLength: 10 }),
          async (channelsData, videosData) => {
            try {
              // Create multiple channels
              const channels = await Promise.all(
                channelsData.map((data) => Channel.create(data))
              );

              // Create videos for each channel
              for (let i = 0; i < videosData.length; i++) {
                const videoData = videosData[i];
                const channel = channels[i % channels.length];

                const testFilePath = path.join(testUploadDir, `${i}-${videoData.fileName}`);
                await fs.writeFile(testFilePath, Buffer.from('test video content'));

                await videoService.createVideo({
                  channelId: channel._id,
                  title: videoData.title,
                  description: videoData.description,
                  filePath: testFilePath,
                  fileName: videoData.fileName,
                  fileSize: videoData.fileSize,
                });
              }

              // For each channel, verify no videos from other channels are returned
              for (let i = 0; i < channels.length; i++) {
                const currentChannel = channels[i];
                const otherChannels = channels.filter((_, idx) => idx !== i);

                const retrievedVideos = await videoService.getVideosByChannel(
                  currentChannel._id.toString()
                );

                // Verify none of the retrieved videos belong to other channels
                for (const video of retrievedVideos) {
                  for (const otherChannel of otherChannels) {
                    expect(video.channelId.toString()).not.toBe(
                      otherChannel._id.toString()
                    );
                  }
                }
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

    test('Retrieving all videos without channel filter should return videos from all channels', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(channelDataArbitrary, {
            minLength: 2,
            maxLength: 5,
            selector: (item) => item.channelId,
          }),
          fc.array(videoDataArbitrary, { minLength: 2, maxLength: 10 }),
          async (channelsData, videosData) => {
            try {
              // Create multiple channels
              const channels = await Promise.all(
                channelsData.map((data) => Channel.create(data))
              );

              // Create videos for each channel
              const createdVideos = [];
              for (let i = 0; i < videosData.length; i++) {
                const videoData = videosData[i];
                const channel = channels[i % channels.length];

                const testFilePath = path.join(testUploadDir, `${i}-${videoData.fileName}`);
                await fs.writeFile(testFilePath, Buffer.from('test video content'));

                const video = await videoService.createVideo({
                  channelId: channel._id,
                  title: videoData.title,
                  description: videoData.description,
                  filePath: testFilePath,
                  fileName: videoData.fileName,
                  fileSize: videoData.fileSize,
                });

                createdVideos.push(video);
              }

              // Retrieve all videos without channel filter
              const allVideos = await videoService.getVideos();

              // Should return all created videos
              expect(allVideos.length).toBe(createdVideos.length);

              // Each video should still have a valid channel association
              for (const video of allVideos) {
                expect(video.channelId).toBeDefined();
                const channelExists = channels.some(
                  (ch) => ch._id.toString() === video.channelId._id.toString()
                );
                expect(channelExists).toBe(true);
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

    test('Channel association is immutable after video creation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(channelDataArbitrary, {
            minLength: 2,
            maxLength: 3,
            selector: (item) => item.channelId,
          }),
          videoDataArbitrary,
          async (channelsData, videoData) => {
            try {
              // Create channels
              const channels = await Promise.all(
                channelsData.map((data) => Channel.create(data))
              );

              const originalChannel = channels[0];
              const testFilePath = path.join(testUploadDir, videoData.fileName);
              await fs.writeFile(testFilePath, Buffer.from('test video content'));

              // Create video with first channel
              const video = await videoService.createVideo({
                channelId: originalChannel._id,
                title: videoData.title,
                description: videoData.description,
                filePath: testFilePath,
                fileName: videoData.fileName,
                fileSize: videoData.fileSize,
              });

              // Attempt to update video (channelId should not be updatable)
              const updatedVideo = await videoService.updateVideo(video._id.toString(), {
                title: 'Updated Title',
                channelId: channels[1]._id, // Try to change channel
              });

              // Channel association should remain unchanged
              expect(updatedVideo.channelId.toString()).toBe(
                originalChannel._id.toString()
              );

              // Verify in database
              const dbVideo = await Video.findById(video._id);
              expect(dbVideo.channelId.toString()).toBe(originalChannel._id.toString());
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
