const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Channel = require('../../src/models/Channel');
const channelService = require('../../src/services/channelService');

// Feature: super-stream-app, Property 8: Channel settings round-trip
// Validates: Requirements 3.5

describe('Channel Settings Property Tests', () => {
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
    await Channel.deleteMany({});
  });

  afterEach(async () => {
    await Channel.deleteMany({});
  });

  // Arbitrary for generating channel data
  const channelDataArbitrary = fc.record({
    channelId: fc.uuid(),
    channelName: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
    thumbnailUrl: fc.oneof(fc.webUrl(), fc.constant('')),
    accessToken: fc.string({ minLength: 20, maxLength: 200 }).filter((s) => s.trim().length > 0),
    refreshToken: fc.string({ minLength: 20, maxLength: 200 }).filter((s) => s.trim().length > 0),
  });

  describe('Property 8: Channel settings round-trip', () => {
    test('For any channel and maximum simultaneous stream limit value, saving the setting then retrieving the channel should return the same stream limit value', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelDataArbitrary,
          fc.integer({ min: 1, max: 10 }),
          async (channelData, maxStreams) => {
            try {
              // Clean up before this iteration
              await Channel.deleteMany({});

              // Create a channel
              const channel = await Channel.create(channelData);

              // Update the channel settings with the max stream limit
              const updatedChannel = await channelService.updateChannelSettings(
                channel.channelId,
                { maxSimultaneousStreams: maxStreams }
              );

              // Verify the update was successful
              expect(updatedChannel.maxSimultaneousStreams).toBe(maxStreams);

              // Retrieve the channel again to verify persistence
              const retrievedChannel = await channelService.getChannelById(channel.channelId);

              // Verify the setting persisted correctly
              expect(retrievedChannel).toBeDefined();
              expect(retrievedChannel.maxSimultaneousStreams).toBe(maxStreams);

              // Also verify through getAllChannels
              const allChannels = await channelService.getAllChannels();
              const foundChannel = allChannels.find(c => c.channelId === channel.channelId);
              expect(foundChannel).toBeDefined();
              expect(foundChannel.maxSimultaneousStreams).toBe(maxStreams);
            } finally {
              // Clean up after this iteration
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Channel settings update should preserve other channel properties', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelDataArbitrary,
          fc.integer({ min: 1, max: 10 }),
          async (channelData, maxStreams) => {
            try {
              // Clean up before this iteration
              await Channel.deleteMany({});

              // Create a channel with specific properties
              const channel = await Channel.create(channelData);

              // Store original values
              const originalChannelId = channel.channelId;
              const originalChannelName = channel.channelName;
              const originalThumbnailUrl = channel.thumbnailUrl;

              // Update only the max streams setting
              await channelService.updateChannelSettings(
                channel.channelId,
                { maxSimultaneousStreams: maxStreams }
              );

              // Retrieve the channel
              const retrievedChannel = await channelService.getChannelById(channel.channelId);

              // Verify other properties were not changed
              expect(retrievedChannel.channelId).toBe(originalChannelId);
              expect(retrievedChannel.channelName).toBe(originalChannelName);
              expect(retrievedChannel.thumbnailUrl).toBe(originalThumbnailUrl);
              
              // Verify the setting was updated
              expect(retrievedChannel.maxSimultaneousStreams).toBe(maxStreams);
            } finally {
              // Clean up after this iteration
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Multiple sequential updates should preserve the latest value', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelDataArbitrary,
          fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 1, maxLength: 5 }),
          async (channelData, streamLimits) => {
            try {
              // Clean up before this iteration
              await Channel.deleteMany({});

              // Create a channel
              const channel = await Channel.create(channelData);

              // Apply multiple updates
              for (const limit of streamLimits) {
                await channelService.updateChannelSettings(
                  channel.channelId,
                  { maxSimultaneousStreams: limit }
                );
              }

              // Retrieve the channel
              const retrievedChannel = await channelService.getChannelById(channel.channelId);

              // Verify the last value is persisted
              const expectedLimit = streamLimits[streamLimits.length - 1];
              expect(retrievedChannel.maxSimultaneousStreams).toBe(expectedLimit);
            } finally {
              // Clean up after this iteration
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Default max simultaneous streams should be 1', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelDataArbitrary,
          async (channelData) => {
            try {
              // Clean up before this iteration
              await Channel.deleteMany({});

              // Create a channel without specifying maxSimultaneousStreams
              const channel = await Channel.create(channelData);

              // Retrieve the channel
              const retrievedChannel = await channelService.getChannelById(channel.channelId);

              // Verify default value is 1
              expect(retrievedChannel.maxSimultaneousStreams).toBe(1);
            } finally {
              // Clean up after this iteration
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Updating non-existent channel should throw error', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 1, max: 10 }),
          async (nonExistentChannelId, maxStreams) => {
            // Attempt to update a channel that doesn't exist
            await expect(
              channelService.updateChannelSettings(
                nonExistentChannelId,
                { maxSimultaneousStreams: maxStreams }
              )
            ).rejects.toThrow('Channel not found');
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
