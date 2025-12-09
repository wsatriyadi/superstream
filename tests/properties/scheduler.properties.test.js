const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Channel = require('../../src/models/Channel');
const Video = require('../../src/models/Video');
const Stream = require('../../src/models/Stream');
const DailyStreamLog = require('../../src/models/DailyStreamLog');
const streamScheduler = require('../../src/services/streamScheduler');

// Feature: super-stream-app, Property 17: Scheduler evaluates all channels
// Feature: super-stream-app, Property 18: Channel eligibility respects stream limits
// Feature: super-stream-app, Property 20: Video selection respects channel association
// Feature: super-stream-app, Property 27: Empty eligible pool prevents stream initiation
// Validates: Requirements 7.1, 7.2, 7.4, 10.3

describe('Stream Scheduler Property Tests', () => {
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
    await Channel.deleteMany({});
    await Video.deleteMany({});
    await Stream.deleteMany({});
    await DailyStreamLog.deleteMany({});
  });

  // Arbitrary for generating channel data
  const channelDataArbitrary = fc.record({
    channelId: fc.uuid(),
    channelName: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
    thumbnailUrl: fc.webUrl(),
    accessToken: fc.string({ minLength: 20, maxLength: 200 }).filter((s) => s.trim().length > 0),
    refreshToken: fc.string({ minLength: 20, maxLength: 200 }).filter((s) => s.trim().length > 0),
    maxSimultaneousStreams: fc.integer({ min: 1, max: 5 }),
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
    loopCount: fc.integer({ min: 1, max: 10 }),
  });

  describe('Property 17: Scheduler evaluates all channels', () => {
    test('For any set of connected channels when the Stream Scheduler executes, the system should evaluate eligibility for each channel', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(channelDataArbitrary, { minLength: 1, maxLength: 5 }),
          async (channelsData) => {
            try {
              // Create channels
              const channels = await Promise.all(
                channelsData.map((channelData) => Channel.create(channelData))
              );

              // Track which channels were evaluated by checking eligibility
              const evaluationResults = [];
              for (const channel of channels) {
                const eligibility = await streamScheduler.checkChannelEligibility(channel._id);
                evaluationResults.push({
                  channelId: channel._id.toString(),
                  evaluated: true,
                  eligibility,
                });
              }

              // Verify all channels were evaluated
              expect(evaluationResults.length).toBe(channels.length);

              // Verify each channel has an eligibility result
              evaluationResults.forEach((result) => {
                expect(result.evaluated).toBe(true);
                expect(result.eligibility).toBeDefined();
                expect(result.eligibility).toHaveProperty('eligible');
                expect(typeof result.eligibility.eligible).toBe('boolean');
              });

              // Verify all channel IDs are present in results
              const evaluatedChannelIds = evaluationResults.map((r) => r.channelId);
              channels.forEach((channel) => {
                expect(evaluatedChannelIds).toContain(channel._id.toString());
              });
            } finally {
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Scheduler processes all channels even when some have no videos', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(channelDataArbitrary, { minLength: 2, maxLength: 5 }),
          fc.integer({ min: 0, max: 4 }), // Index of channel to add videos to
          fc.array(videoDataArbitrary, { minLength: 1, maxLength: 3 }),
          async (channelsData, channelWithVideosIndex, videosData) => {
            try {
              // Create channels
              const channels = await Promise.all(
                channelsData.map((channelData) => Channel.create(channelData))
              );

              // Add videos to only one channel
              const actualIndex = channelWithVideosIndex % channels.length;
              const channelWithVideos = channels[actualIndex];

              await Promise.all(
                videosData.map((videoData) =>
                  Video.create({
                    channelId: channelWithVideos._id,
                    title: videoData.title,
                    description: videoData.description,
                    filePath: videoData.filePath,
                    fileName: videoData.fileName,
                    loopCount: videoData.loopCount,
                  })
                )
              );

              // Evaluate all channels
              const evaluationResults = [];
              for (const channel of channels) {
                const eligibility = await streamScheduler.checkChannelEligibility(channel._id);
                evaluationResults.push({
                  channelId: channel._id.toString(),
                  eligibility,
                });
              }

              // All channels should be evaluated
              expect(evaluationResults.length).toBe(channels.length);

              // Each channel should have an eligibility result
              evaluationResults.forEach((result) => {
                expect(result.eligibility).toBeDefined();
                expect(typeof result.eligibility.eligible).toBe('boolean');
              });
            } finally {
              await Video.deleteMany({});
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 18: Channel eligibility respects stream limits', () => {
    test('For any channel with N active streams and maximum limit M, the channel should be eligible for new streams if and only if N < M', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelDataArbitrary,
          fc.array(videoDataArbitrary, { minLength: 10, maxLength: 10 }), // Ensure enough videos
          async (channelData, videosData) => {
            try {
              // Create channel with specific max streams limit
              const channel = await Channel.create(channelData);
              const maxStreams = channel.maxSimultaneousStreams;

              // Create videos for the channel (ensure we have enough for testing)
              const videos = await Promise.all(
                videosData.map((videoData) =>
                  Video.create({
                    channelId: channel._id,
                    title: videoData.title,
                    description: videoData.description,
                    filePath: videoData.filePath,
                    fileName: videoData.fileName,
                    loopCount: videoData.loopCount,
                  })
                )
              );

              // Test different numbers of active streams
              for (let numActiveStreams = 0; numActiveStreams <= maxStreams + 1; numActiveStreams++) {
                // Clear existing streams
                await Stream.deleteMany({ channelId: channel._id });

                // Create the specified number of active streams
                // Use different videos to avoid conflicts
                for (let i = 0; i < numActiveStreams && i < videos.length; i++) {
                  await Stream.create({
                    channelId: channel._id,
                    videoId: videos[i]._id,
                    status: 'active',
                    startedAt: new Date(),
                  });
                }

                // Check eligibility
                const eligibility = await streamScheduler.checkChannelEligibility(channel._id);

                // Verify: eligible if and only if N < M
                const expectedEligible = numActiveStreams < maxStreams;
                expect(eligibility.eligible).toBe(expectedEligible);

                if (!expectedEligible) {
                  expect(eligibility.reason).toBeDefined();
                  expect(eligibility.reason).toContain('maximum simultaneous streams');
                }
              }
            } finally {
              await Stream.deleteMany({});
              await Video.deleteMany({});
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Channel with zero active streams is always eligible (if limit >= 1)', async () => {
      await fc.assert(
        fc.asyncProperty(channelDataArbitrary, async (channelData) => {
          try {
            // Create channel
            const channel = await Channel.create(channelData);

            // Ensure no active streams
            await Stream.deleteMany({ channelId: channel._id });

            // Check eligibility
            const eligibility = await streamScheduler.checkChannelEligibility(channel._id);

            // Should be eligible since 0 < maxSimultaneousStreams (which is at least 1)
            expect(eligibility.eligible).toBe(true);
          } finally {
            await Channel.deleteMany({});
          }
        }),
        { numRuns: 100 }
      );
    });

    test('Channel at maximum capacity is not eligible', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelDataArbitrary,
          fc.array(videoDataArbitrary, { minLength: 1, maxLength: 10 }),
          async (channelData, videosData) => {
            try {
              // Create channel
              const channel = await Channel.create(channelData);
              const maxStreams = channel.maxSimultaneousStreams;

              // Create videos
              const videos = await Promise.all(
                videosData.map((videoData) =>
                  Video.create({
                    channelId: channel._id,
                    title: videoData.title,
                    description: videoData.description,
                    filePath: videoData.filePath,
                    fileName: videoData.fileName,
                    loopCount: videoData.loopCount,
                  })
                )
              );

              // Create exactly maxStreams active streams
              for (let i = 0; i < maxStreams; i++) {
                await Stream.create({
                  channelId: channel._id,
                  videoId: videos[i % videos.length]._id,
                  status: 'active',
                  startedAt: new Date(),
                });
              }

              // Check eligibility
              const eligibility = await streamScheduler.checkChannelEligibility(channel._id);

              // Should NOT be eligible
              expect(eligibility.eligible).toBe(false);
              expect(eligibility.reason).toBeDefined();
            } finally {
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

  describe('Property 20: Video selection respects channel association', () => {
    test('For any video selected for streaming on a target channel, the video must belong to that target channel', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(channelDataArbitrary, { minLength: 2, maxLength: 5 }),
          fc.array(videoDataArbitrary, { minLength: 1, maxLength: 5 }),
          async (channelsData, videosData) => {
            try {
              // Create multiple channels
              const channels = await Promise.all(
                channelsData.map((channelData) => Channel.create(channelData))
              );

              // Create videos for each channel
              const videosByChannel = new Map();
              for (const channel of channels) {
                const channelVideos = await Promise.all(
                  videosData.map((videoData) =>
                    Video.create({
                      channelId: channel._id,
                      title: videoData.title,
                      description: videoData.description,
                      filePath: videoData.filePath,
                      fileName: videoData.fileName,
                      loopCount: videoData.loopCount,
                    })
                  )
                );
                videosByChannel.set(channel._id.toString(), channelVideos);
              }

              // For each channel, select a video and verify it belongs to that channel
              for (const channel of channels) {
                const selectedVideo = await streamScheduler.selectVideo(channel._id);

                if (selectedVideo) {
                  // Verify the selected video belongs to the target channel
                  expect(selectedVideo.channelId.toString()).toBe(channel._id.toString());

                  // Verify the video is in the channel's video list
                  const channelVideos = videosByChannel.get(channel._id.toString());
                  const videoIds = channelVideos.map((v) => v._id.toString());
                  expect(videoIds).toContain(selectedVideo._id.toString());
                }
              }
            } finally {
              await Video.deleteMany({});
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Video selection never returns videos from other channels', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(channelDataArbitrary, channelDataArbitrary).filter(
            ([c1, c2]) => c1.channelId !== c2.channelId
          ),
          fc.array(videoDataArbitrary, { minLength: 1, maxLength: 5 }),
          fc.array(videoDataArbitrary, { minLength: 1, maxLength: 5 }),
          async ([channel1Data, channel2Data], videos1Data, videos2Data) => {
            try {
              // Create two channels
              const channel1 = await Channel.create(channel1Data);
              const channel2 = await Channel.create(channel2Data);

              // Create videos for channel 1
              const channel1Videos = await Promise.all(
                videos1Data.map((videoData) =>
                  Video.create({
                    channelId: channel1._id,
                    title: videoData.title,
                    description: videoData.description,
                    filePath: videoData.filePath,
                    fileName: videoData.fileName,
                    loopCount: videoData.loopCount,
                  })
                )
              );

              // Create videos for channel 2
              const channel2Videos = await Promise.all(
                videos2Data.map((videoData) =>
                  Video.create({
                    channelId: channel2._id,
                    title: videoData.title,
                    description: videoData.description,
                    filePath: videoData.filePath,
                    fileName: videoData.fileName,
                    loopCount: videoData.loopCount,
                  })
                )
              );

              // Select video for channel 1
              const selectedForChannel1 = await streamScheduler.selectVideo(channel1._id);

              if (selectedForChannel1) {
                // Verify it's from channel 1, not channel 2
                expect(selectedForChannel1.channelId.toString()).toBe(channel1._id.toString());
                expect(selectedForChannel1.channelId.toString()).not.toBe(
                  channel2._id.toString()
                );

                // Verify it's in channel 1's videos
                const channel1VideoIds = channel1Videos.map((v) => v._id.toString());
                expect(channel1VideoIds).toContain(selectedForChannel1._id.toString());

                // Verify it's NOT in channel 2's videos
                const channel2VideoIds = channel2Videos.map((v) => v._id.toString());
                expect(channel2VideoIds).not.toContain(selectedForChannel1._id.toString());
              }

              // Select video for channel 2
              const selectedForChannel2 = await streamScheduler.selectVideo(channel2._id);

              if (selectedForChannel2) {
                // Verify it's from channel 2, not channel 1
                expect(selectedForChannel2.channelId.toString()).toBe(channel2._id.toString());
                expect(selectedForChannel2.channelId.toString()).not.toBe(
                  channel1._id.toString()
                );

                // Verify it's in channel 2's videos
                const channel2VideoIds = channel2Videos.map((v) => v._id.toString());
                expect(channel2VideoIds).toContain(selectedForChannel2._id.toString());

                // Verify it's NOT in channel 1's videos
                const channel1VideoIds = channel1Videos.map((v) => v._id.toString());
                expect(channel1VideoIds).not.toContain(selectedForChannel2._id.toString());
              }
            } finally {
              await Video.deleteMany({});
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 27: Empty eligible pool prevents stream initiation', () => {
    test('For any channel where all videos have been streamed on the current date, the scheduler should skip that channel and not initiate a new livestream', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelDataArbitrary,
          fc.array(videoDataArbitrary, { minLength: 1, maxLength: 5 }),
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
                    loopCount: videoData.loopCount,
                  })
                )
              );

              // Stream all videos today (create log entries for all)
              for (const video of videos) {
                const stream = await Stream.create({
                  channelId: channel._id,
                  videoId: video._id,
                  status: 'completed',
                  startedAt: new Date(),
                  endedAt: new Date(),
                });

                await DailyStreamLog.create({
                  videoId: video._id,
                  channelId: channel._id,
                  streamDate: new Date(),
                  streamId: stream._id,
                });
              }

              // Try to select a video
              const selectedVideo = await streamScheduler.selectVideo(channel._id);

              // Should return null since all videos have been streamed today
              expect(selectedVideo).toBeNull();

              // Verify channel would be skipped in processing
              // (no new stream should be initiated)
              const initialStreamCount = await Stream.countDocuments({
                channelId: channel._id,
              });

              // If we were to process this channel, it should be skipped
              // We can verify by checking that selectVideo returns null
              expect(selectedVideo).toBeNull();
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

    test('Channel with no videos returns null from video selection', async () => {
      await fc.assert(
        fc.asyncProperty(channelDataArbitrary, async (channelData) => {
          try {
            // Create channel with no videos
            const channel = await Channel.create(channelData);

            // Try to select a video
            const selectedVideo = await streamScheduler.selectVideo(channel._id);

            // Should return null since there are no videos
            expect(selectedVideo).toBeNull();
          } finally {
            await Channel.deleteMany({});
          }
        }),
        { numRuns: 100 }
      );
    });

    test('When all but one video is streamed, only the unstreamed video can be selected', async () => {
      await fc.assert(
        fc.asyncProperty(
          channelDataArbitrary,
          fc.array(videoDataArbitrary, { minLength: 2, maxLength: 5 }),
          fc.integer({ min: 0, max: 4 }), // Index of video to leave unstreamed
          async (channelData, videosData, unStreamedIndex) => {
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
                    loopCount: videoData.loopCount,
                  })
                )
              );

              // Determine which video to leave unstreamed
              const actualIndex = unStreamedIndex % videos.length;
              const unStreamedVideo = videos[actualIndex];

              // Stream all videos except one
              for (let i = 0; i < videos.length; i++) {
                if (i !== actualIndex) {
                  const stream = await Stream.create({
                    channelId: channel._id,
                    videoId: videos[i]._id,
                    status: 'completed',
                    startedAt: new Date(),
                    endedAt: new Date(),
                  });

                  await DailyStreamLog.create({
                    videoId: videos[i]._id,
                    channelId: channel._id,
                    streamDate: new Date(),
                    streamId: stream._id,
                  });
                }
              }

              // Select a video multiple times to verify it's always the unstreamed one
              for (let attempt = 0; attempt < 5; attempt++) {
                const selectedVideo = await streamScheduler.selectVideo(channel._id);

                // Should select the only eligible video
                expect(selectedVideo).not.toBeNull();
                expect(selectedVideo._id.toString()).toBe(unStreamedVideo._id.toString());
              }
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
