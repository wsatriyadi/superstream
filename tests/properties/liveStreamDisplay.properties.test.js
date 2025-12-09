const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Channel = require('../../src/models/Channel');
const Stream = require('../../src/models/Stream');
const Video = require('../../src/models/Video');
const streamService = require('../../src/services/streamService');

// Feature: super-stream-app, Property 13: Live menu displays all active streams
// Validates: Requirements 5.1, 5.2

describe('Live Stream Display Property Tests', () => {
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
  });

  // Arbitrary for generating video data
  const videoDataArbitrary = fc.record({
    title: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
    description: fc.oneof(
      fc.string({ minLength: 0, maxLength: 500 }),
      fc.constant('')
    ),
    filePath: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
    fileName: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
    thumbnailPath: fc.oneof(
      fc.string({ minLength: 1, maxLength: 200 }),
      fc.constant('')
    ),
  });

  describe('Property 13: Live menu displays all active streams', () => {
    test('For any set of currently active livestreams, getActiveStreams should display all streams with their thumbnails, durations, and channel names', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              channel: channelDataArbitrary,
              video: videoDataArbitrary,
              status: fc.constantFrom('active', 'starting'),
              startedMinutesAgo: fc.integer({ min: 0, max: 120 }),
            }),
            { minLength: 0, maxLength: 10 }
          ),
          async (activeStreamsData) => {
            try {
              // Clean up before this iteration
              await Stream.deleteMany({});
              await Video.deleteMany({});
              await Channel.deleteMany({});

              // Create channels, videos, and active streams
              const createdStreams = [];
              for (const streamData of activeStreamsData) {
                // Create channel
                const channel = await Channel.create(streamData.channel);

                // Create video
                const video = await Video.create({
                  ...streamData.video,
                  channelId: channel._id,
                });

                // Create stream with calculated start time
                const startedAt = new Date();
                startedAt.setMinutes(startedAt.getMinutes() - streamData.startedMinutesAgo);

                const stream = await Stream.create({
                  channelId: channel._id,
                  videoId: video._id,
                  status: streamData.status,
                  startedAt: startedAt,
                });

                createdStreams.push({
                  stream,
                  channel,
                  video,
                  expectedDuration: streamData.startedMinutesAgo * 60, // Convert to seconds
                });
              }

              // Also create some completed/failed streams that should NOT appear
              if (activeStreamsData.length > 0) {
                const firstChannel = createdStreams[0]?.channel;
                if (firstChannel) {
                  const inactiveVideo = await Video.create({
                    title: 'Inactive Video',
                    filePath: '/test/inactive.mp4',
                    fileName: 'inactive.mp4',
                    channelId: firstChannel._id,
                  });

                  await Stream.create({
                    channelId: firstChannel._id,
                    videoId: inactiveVideo._id,
                    status: 'completed',
                    startedAt: new Date(Date.now() - 3600000),
                    endedAt: new Date(),
                  });

                  await Stream.create({
                    channelId: firstChannel._id,
                    videoId: inactiveVideo._id,
                    status: 'failed',
                    startedAt: new Date(Date.now() - 7200000),
                    endedAt: new Date(Date.now() - 3600000),
                  });
                }
              }

              // Get active streams using the service
              const retrievedStreams = await streamService.getActiveStreams();

              // Verify the correct number of active streams are returned
              expect(retrievedStreams.length).toBe(activeStreamsData.length);

              // Verify each active stream has all required information
              for (const retrievedStream of retrievedStreams) {
                const matchingStream = createdStreams.find(
                  (s) => s.stream._id.toString() === retrievedStream.streamId
                );

                expect(matchingStream).toBeDefined();

                // Verify all required fields are present
                expect(retrievedStream.streamId).toBeDefined();
                expect(typeof retrievedStream.streamId).toBe('string');

                // Verify video information is present
                expect(retrievedStream.video).toBeDefined();
                expect(retrievedStream.video.title).toBe(matchingStream.video.title);
                expect(retrievedStream.video.thumbnailPath).toBe(
                  matchingStream.video.thumbnailPath
                );

                // Verify channel information is present
                expect(retrievedStream.channel).toBeDefined();
                expect(retrievedStream.channel.name).toBe(matchingStream.channel.channelName);

                // Verify duration is present and is a number
                expect(typeof retrievedStream.duration).toBe('number');
                expect(retrievedStream.duration).toBeGreaterThanOrEqual(0);

                // Duration should be approximately correct (within 5 seconds tolerance)
                const durationDiff = Math.abs(
                  retrievedStream.duration - matchingStream.expectedDuration
                );
                expect(durationDiff).toBeLessThanOrEqual(5);

                // Verify startedAt is present
                expect(retrievedStream.startedAt).toBeDefined();
                expect(retrievedStream.startedAt).toBeInstanceOf(Date);

                // Verify status is active or starting
                expect(['active', 'starting']).toContain(retrievedStream.status);
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

    test(
      'For any stream, duration should increase over time',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            channelDataArbitrary,
            videoDataArbitrary,
            fc.constantFrom('active', 'starting'),
            async (channelData, videoData, status) => {
              try {
                // Clean up before this iteration
                await Stream.deleteMany({});
                await Video.deleteMany({});
                await Channel.deleteMany({});

                // Create channel and video
                const channel = await Channel.create(channelData);
                const video = await Video.create({
                  ...videoData,
                  channelId: channel._id,
                });

                // Create stream
                const startedAt = new Date(Date.now() - 5000); // Started 5 seconds ago
                await Stream.create({
                  channelId: channel._id,
                  videoId: video._id,
                  status: status,
                  startedAt: startedAt,
                });

                // Get active streams immediately
                const streams1 = await streamService.getActiveStreams();
                expect(streams1.length).toBe(1);
                const duration1 = streams1[0].duration;

                // Wait 2 seconds
                await new Promise((resolve) => setTimeout(resolve, 2000));

                // Get active streams again
                const streams2 = await streamService.getActiveStreams();
                expect(streams2.length).toBe(1);
                const duration2 = streams2[0].duration;

                // Duration should have increased by approximately 2 seconds
                const durationIncrease = duration2 - duration1;
                expect(durationIncrease).toBeGreaterThanOrEqual(1);
                expect(durationIncrease).toBeLessThanOrEqual(3);
              } finally {
                // Clean up after this iteration
                await Stream.deleteMany({});
                await Video.deleteMany({});
                await Channel.deleteMany({});
              }
            }
          ),
          { numRuns: 20 } // Fewer runs since this test involves waiting
        );
      },
      60000
    ); // 60 second timeout

    test('getActiveStreams should return empty array when no streams are active', async () => {
      // Clean up
      await Stream.deleteMany({});
      await Video.deleteMany({});
      await Channel.deleteMany({});

      const streams = await streamService.getActiveStreams();
      expect(streams).toEqual([]);
    });

    test(
      'getActiveStreams should exclude completed and failed streams',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            channelDataArbitrary,
            fc.array(videoDataArbitrary, { minLength: 1, maxLength: 5 }),
            async (channelData, videosData) => {
              try {
                // Clean up before this iteration
                await Stream.deleteMany({});
                await Video.deleteMany({});
                await Channel.deleteMany({});

                // Create channel
                const channel = await Channel.create(channelData);

                // Create videos and streams with different statuses
                let activeCount = 0;
                for (let i = 0; i < videosData.length; i++) {
                  const video = await Video.create({
                    ...videosData[i],
                    channelId: channel._id,
                  });

                  // Alternate between active and inactive statuses
                  const statuses = ['active', 'starting', 'completed', 'failed', 'stopping'];
                  const status = statuses[i % statuses.length];

                  if (status === 'active' || status === 'starting') {
                    activeCount++;
                  }

                  const streamData = {
                    channelId: channel._id,
                    videoId: video._id,
                    status: status,
                    startedAt: new Date(Date.now() - 60000),
                  };

                  if (status === 'completed' || status === 'failed') {
                    streamData.endedAt = new Date();
                  }

                  await Stream.create(streamData);
                }

                // Get active streams
                const retrievedStreams = await streamService.getActiveStreams();

                // Should only return active and starting streams
                expect(retrievedStreams.length).toBe(activeCount);

                // Verify all returned streams are active or starting
                for (const stream of retrievedStreams) {
                  expect(['active', 'starting']).toContain(stream.status);
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
      },
      30000
    ); // 30 second timeout

    test('For any active stream, all required display fields should be present', async () => {
      // Clean up before test
      await Stream.deleteMany({});
      await Video.deleteMany({});
      await Channel.deleteMany({});

      await fc.assert(
        fc.asyncProperty(
          channelDataArbitrary,
          videoDataArbitrary,
          fc.constantFrom('active', 'starting'),
          fc.integer({ min: 0, max: 1000 }),
          async (channelData, videoData, status, viewerCount) => {
            // Clean up before this iteration
            await Stream.deleteMany({});
            await Video.deleteMany({});
            await Channel.deleteMany({});

            // Create channel and video
            const channel = await Channel.create(channelData);
            const video = await Video.create({
              ...videoData,
              channelId: channel._id,
            });

            // Create stream with viewer count
            await Stream.create({
              channelId: channel._id,
              videoId: video._id,
              status: status,
              startedAt: new Date(Date.now() - 30000),
              viewerCount: viewerCount,
            });

            // Get active streams
            const streams = await streamService.getActiveStreams();
            expect(streams.length).toBe(1);

            const stream = streams[0];

            // Verify all required fields for display are present
            expect(stream).toHaveProperty('streamId');
            expect(stream).toHaveProperty('status');
            expect(stream).toHaveProperty('startedAt');
            expect(stream).toHaveProperty('duration');
            expect(stream).toHaveProperty('video');
            expect(stream).toHaveProperty('channel');
            expect(stream).toHaveProperty('viewerCount');

            // Verify nested video fields
            expect(stream.video).toHaveProperty('title');
            expect(stream.video).toHaveProperty('thumbnailPath');

            // Verify nested channel fields
            expect(stream.channel).toHaveProperty('name');

            // Verify types
            expect(typeof stream.streamId).toBe('string');
            expect(typeof stream.status).toBe('string');
            expect(stream.startedAt).toBeInstanceOf(Date);
            expect(typeof stream.duration).toBe('number');
            expect(typeof stream.viewerCount).toBe('number');

            // Clean up after this iteration
            await Stream.deleteMany({});
            await Video.deleteMany({});
            await Channel.deleteMany({});
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
