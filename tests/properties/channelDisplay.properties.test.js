const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Channel = require('../../src/models/Channel');
const Stream = require('../../src/models/Stream');
const Video = require('../../src/models/Video');
const channelService = require('../../src/services/channelService');

// Feature: super-stream-app, Property 5: Dashboard displays all channel information
// Feature: super-stream-app, Property 6: Aggregate statistics correctness
// Validates: Requirements 2.1, 2.2, 2.3

describe('Channel Display Property Tests', () => {
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

  beforeEach(async () => {
    // Clean before each test to ensure fresh state
    await Stream.deleteMany({});
    await Video.deleteMany({});
    await Channel.deleteMany({});
  });

  afterEach(async () => {
    await Stream.deleteMany({});
    await Video.deleteMany({});
    await Channel.deleteMany({});
  });

  // Arbitrary for generating channel data
  const channelDataArbitrary = fc.record({
    channelId: fc.uuid(),
    channelName: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
    thumbnailUrl: fc.oneof(fc.webUrl(), fc.constant('')),
    accessToken: fc.string({ minLength: 20, maxLength: 200 }).filter((s) => s.trim().length > 0),
    refreshToken: fc.string({ minLength: 20, maxLength: 200 }).filter((s) => s.trim().length > 0),
    subscriberCount: fc.integer({ min: 0, max: 10000000 }),
    totalViews: fc.integer({ min: 0, max: 1000000000 }),
    totalWatchTime: fc.integer({ min: 0, max: 100000000 }),
  });

  describe('Property 5: Dashboard displays all channel information', () => {
    test('For any set of connected channels, getAllChannels should return all channels with their thumbnails, names, subscriber counts, watch times, view counts, and active livestream counts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(channelDataArbitrary, { minLength: 0, maxLength: 10 }),
          async (channelsData) => {
            try {
              // Clean up before this iteration
              await Stream.deleteMany({});
              await Video.deleteMany({});
              await Channel.deleteMany({});

              // Create channels in database
              const createdChannels = [];
              for (const channelData of channelsData) {
                const channel = await Channel.create(channelData);
                createdChannels.push(channel);
              }

              // Create some active streams for random channels
              for (const channel of createdChannels) {
                const shouldHaveStreams = Math.random() > 0.5;
                if (shouldHaveStreams) {
                  const streamCount = Math.floor(Math.random() * 3) + 1;
                  for (let i = 0; i < streamCount; i++) {
                    // Create a video first
                    const video = await Video.create({
                      channelId: channel._id,
                      title: `Test Video ${i}`,
                      filePath: `/test/path/video${i}.mp4`,
                      fileName: `video${i}.mp4`,
                    });

                    await Stream.create({
                      channelId: channel._id,
                      videoId: video._id,
                      status: Math.random() > 0.5 ? 'active' : 'starting',
                      startedAt: new Date(),
                    });
                  }
                }
              }

              // Get all channels using the service
              const retrievedChannels = await channelService.getAllChannels();

              // Verify all channels are returned
              expect(retrievedChannels.length).toBe(channelsData.length);

              // Verify each channel has all required information
              for (const retrievedChannel of retrievedChannels) {
                const originalChannel = createdChannels.find(
                  (c) => c.channelId === retrievedChannel.channelId
                );
                expect(originalChannel).toBeDefined();

                // Verify all required fields are present
                expect(retrievedChannel.channelName).toBe(originalChannel.channelName);
                expect(retrievedChannel.thumbnailUrl).toBe(originalChannel.thumbnailUrl);
                expect(retrievedChannel.subscriberCount).toBe(originalChannel.subscriberCount);
                expect(retrievedChannel.totalViews).toBe(originalChannel.totalViews);
                expect(retrievedChannel.totalWatchTime).toBe(originalChannel.totalWatchTime);
                
                // Verify active stream count is present and is a number
                expect(typeof retrievedChannel.activeStreamCount).toBe('number');
                expect(retrievedChannel.activeStreamCount).toBeGreaterThanOrEqual(0);

                // Verify active stream count is accurate
                const actualActiveCount = await Stream.getActiveStreamCount(originalChannel._id);
                expect(retrievedChannel.activeStreamCount).toBe(actualActiveCount);
              }
            } finally {
              // Clean up after this iteration
              await Stream.deleteMany({});
              await Video.deleteMany({});
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('For any channel, active stream count should match the number of streams with status "active" or "starting"', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelDataArbitrary,
          fc.integer({ min: 0, max: 5 }),
          fc.integer({ min: 0, max: 5 }),
          fc.integer({ min: 0, max: 5 }),
          async (channelData, activeCount, startingCount, completedCount) => {
            try {
              // Clean up before this iteration
              await Stream.deleteMany({});
              await Video.deleteMany({});
              await Channel.deleteMany({});

              // Create channel
              const channel = await Channel.create(channelData);

              // Create streams with different statuses
              const totalStreams = activeCount + startingCount + completedCount;
              for (let i = 0; i < totalStreams; i++) {
                const video = await Video.create({
                  channelId: channel._id,
                  title: `Test Video ${i}`,
                  filePath: `/test/path/video${i}.mp4`,
                  fileName: `video${i}.mp4`,
                });

                let status;
                if (i < activeCount) {
                  status = 'active';
                } else if (i < activeCount + startingCount) {
                  status = 'starting';
                } else {
                  status = 'completed';
                }

                await Stream.create({
                  channelId: channel._id,
                  videoId: video._id,
                  status: status,
                  startedAt: new Date(),
                });
              }

              // Get channels
              const channels = await channelService.getAllChannels();
              expect(channels.length).toBe(1);

              // Verify active stream count
              const expectedActiveCount = activeCount + startingCount;
              expect(channels[0].activeStreamCount).toBe(expectedActiveCount);
            } finally {
              // Clean up after this iteration
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

  describe('Property 6: Aggregate statistics correctness', () => {
    test('For any set of connected channels with individual statistics, the aggregate statistics should equal the sum of all individual channel statistics', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(channelDataArbitrary, { minLength: 0, maxLength: 20 }),
          async (channelsData) => {
            try {
              // Clean up before this iteration
              await Stream.deleteMany({});
              await Video.deleteMany({});
              await Channel.deleteMany({});

              // Create channels in database
              const createdChannels = [];
              for (const channelData of channelsData) {
                const channel = await Channel.create(channelData);
                createdChannels.push(channel);
                
                // Create some active streams for some channels
                if (Math.random() > 0.7) {
                  const video = await Video.create({
                    channelId: channel._id,
                    title: 'Test Video',
                    filePath: '/test/path/video.mp4',
                    fileName: 'video.mp4',
                  });

                  await Stream.create({
                    channelId: channel._id,
                    videoId: video._id,
                    status: 'active',
                    startedAt: new Date(),
                  });
                }
              }

              // Calculate expected aggregate statistics
              let expectedTotalSubscribers = 0;
              let expectedTotalViews = 0;
              let expectedTotalWatchTime = 0;
              let expectedTotalActiveStreams = 0;

              for (const channelData of channelsData) {
                expectedTotalSubscribers += channelData.subscriberCount || 0;
                expectedTotalViews += channelData.totalViews || 0;
                expectedTotalWatchTime += channelData.totalWatchTime || 0;
              }

              // Count active streams
              for (const channel of createdChannels) {
                const activeCount = await Stream.getActiveStreamCount(channel._id);
                expectedTotalActiveStreams += activeCount;
              }

              // Get aggregate statistics from service
              const stats = await channelService.getAggregateStats();

              // Verify aggregate statistics match the sum
              expect(stats.totalChannels).toBe(channelsData.length);
              expect(stats.totalSubscribers).toBe(expectedTotalSubscribers);
              expect(stats.totalViews).toBe(expectedTotalViews);
              expect(stats.totalWatchTime).toBe(expectedTotalWatchTime);
              expect(stats.totalActiveStreams).toBe(expectedTotalActiveStreams);
            } finally {
              // Clean up after this iteration
              await Stream.deleteMany({});
              await Video.deleteMany({});
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Aggregate statistics should handle zero channels correctly', async () => {
      const stats = await channelService.getAggregateStats();
      
      expect(stats.totalChannels).toBe(0);
      expect(stats.totalSubscribers).toBe(0);
      expect(stats.totalViews).toBe(0);
      expect(stats.totalWatchTime).toBe(0);
      expect(stats.totalActiveStreams).toBe(0);
    });

    test('Aggregate statistics should handle channels with zero values', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (channelCount) => {
            try {
              // Clean up before this iteration
              await Stream.deleteMany({});
              await Video.deleteMany({});
              await Channel.deleteMany({});

              // Create channels with all zero statistics
              for (let i = 0; i < channelCount; i++) {
                await Channel.create({
                  channelId: `channel-${Date.now()}-${i}-${Math.random()}`,
                  channelName: `Channel ${i}`,
                  accessToken: 'test-token-' + i + '-' + Date.now(),
                  refreshToken: 'test-refresh-' + i + '-' + Date.now(),
                  subscriberCount: 0,
                  totalViews: 0,
                  totalWatchTime: 0,
                });
              }

              const stats = await channelService.getAggregateStats();
              
              expect(stats.totalChannels).toBe(channelCount);
              expect(stats.totalSubscribers).toBe(0);
              expect(stats.totalViews).toBe(0);
              expect(stats.totalWatchTime).toBe(0);
              expect(stats.totalActiveStreams).toBe(0);
            } finally {
              // Clean up after this iteration
              await Stream.deleteMany({});
              await Video.deleteMany({});
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
