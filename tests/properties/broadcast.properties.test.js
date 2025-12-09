const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Channel = require('../../src/models/Channel');
const Video = require('../../src/models/Video');
const Settings = require('../../src/models/Settings');
const broadcastService = require('../../src/services/broadcastService');
const youtubeApiService = require('../../src/services/youtubeApiService');

// Feature: super-stream-app, Property 25: Broadcast metadata matches video metadata
// Validates: Requirements 9.1, 9.2

// Feature: super-stream-app, Property 26: Metadata injection failure aborts stream
// Validates: Requirements 9.4

describe('Broadcast Property Tests', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Set up test environment variables
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars!!';
    process.env.BASE_URL = 'http://localhost:3000';
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Channel.deleteMany({});
    await Video.deleteMany({});
    await Settings.deleteMany({});
  });

  describe('Property 25: Broadcast metadata matches video metadata', () => {
    // Arbitrary for generating video metadata
    // Note: Video model trims title and description, so we generate pre-trimmed values
    const videoMetadataArbitrary = fc.record({
      title: fc
        .string({ minLength: 1, maxLength: 100 })
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length <= 100),
      description: fc
        .string({ minLength: 0, maxLength: 500 })
        .map((s) => s.trim()),
    });

    // Mock YouTube API responses
    const mockYouTubeAPI = (title, description) => {
      const mockStreamId = fc.sample(fc.uuid(), 1)[0];
      const mockBroadcastId = fc.sample(fc.uuid(), 1)[0];
      const mockRtmpUrl = 'rtmp://a.rtmp.youtube.com/live2';
      const mockStreamKey = fc.sample(fc.hexaString({ minLength: 20, maxLength: 40 }), 1)[0];

      // Normalize description to handle empty strings
      const normalizedDescription = description || '';

      // Mock the getAuthenticatedClient to return a mock YouTube client
      jest.spyOn(youtubeApiService, 'getAuthenticatedClient').mockResolvedValue({
        liveStreams: {
          insert: jest.fn().mockResolvedValue({
            data: {
              id: mockStreamId,
              cdn: {
                ingestionInfo: {
                  ingestionAddress: mockRtmpUrl,
                  streamName: mockStreamKey,
                },
              },
            },
          }),
        },
        liveBroadcasts: {
          insert: jest.fn().mockResolvedValue({
            data: {
              id: mockBroadcastId,
              snippet: {
                title: title,
                description: normalizedDescription,
              },
            },
          }),
          bind: jest.fn().mockResolvedValue({
            data: {
              id: mockBroadcastId,
            },
          }),
          list: jest.fn().mockResolvedValue({
            data: {
              items: [
                {
                  id: mockBroadcastId,
                  snippet: {
                    title: title,
                    description: normalizedDescription,
                  },
                },
              ],
            },
          }),
        },
      });

      return { mockBroadcastId, mockStreamId, mockRtmpUrl, mockStreamKey };
    };

    test('For any video being streamed, the YouTube broadcast title and description should match the video stored title and description', async () => {
      await fc.assert(
        fc.asyncProperty(videoMetadataArbitrary, async (videoMetadata) => {
          try {
            // Create a test channel
            const channel = await Channel.create({
              channelId: fc.sample(fc.uuid(), 1)[0],
              channelName: 'Test Channel',
              thumbnailUrl: 'https://example.com/thumb.jpg',
              accessToken: 'test-access-token',
              refreshToken: 'test-refresh-token',
              tokenExpiry: new Date(Date.now() + 3600000),
            });

            // Create a test video with metadata
            const video = await Video.create({
              channelId: channel._id,
              title: videoMetadata.title,
              description: videoMetadata.description,
              filePath: '/test/video.mp4',
              fileName: 'video.mp4',
              fileSize: 1000000,
              loopCount: 1,
            });

            // Mock YouTube API - ensure we use the exact same values
            const { mockBroadcastId } = mockYouTubeAPI(
              video.title,
              video.description
            );

            // Create broadcast with video metadata
            const broadcast = await broadcastService.createBroadcast({
              channelId: channel._id.toString(),
              title: video.title,
              description: video.description,
            });

            // Verify broadcast was created
            expect(broadcast).toBeDefined();
            expect(broadcast.broadcastId).toBe(mockBroadcastId);

            // Verify metadata matches
            expect(broadcast.title).toBe(video.title);
            expect(broadcast.description).toBe(video.description);

            // Verify the YouTube API was called with correct metadata
            const mockClient = await youtubeApiService.getAuthenticatedClient(channel.channelId);
            expect(mockClient.liveBroadcasts.insert).toHaveBeenCalledWith(
              expect.objectContaining({
                requestBody: expect.objectContaining({
                  snippet: expect.objectContaining({
                    title: video.title,
                    description: video.description,
                  }),
                }),
              })
            );

            // Verify metadata was verified by the service
            expect(mockClient.liveBroadcasts.list).toHaveBeenCalledWith(
              expect.objectContaining({
                id: [mockBroadcastId],
              })
            );
          } finally {
            // Clean up
            await Channel.deleteMany({});
            await Video.deleteMany({});
            jest.restoreAllMocks();
          }
        }),
        { numRuns: 100 }
      );
    });

    test('Broadcast metadata verification ensures exact match', async () => {
      await fc.assert(
        fc.asyncProperty(videoMetadataArbitrary, async (videoMetadata) => {
          try {
            // Create a test channel
            const channel = await Channel.create({
              channelId: fc.sample(fc.uuid(), 1)[0],
              channelName: 'Test Channel',
              thumbnailUrl: 'https://example.com/thumb.jpg',
              accessToken: 'test-access-token',
              refreshToken: 'test-refresh-token',
              tokenExpiry: new Date(Date.now() + 3600000),
            });

            // Mock YouTube API with correct metadata
            mockYouTubeAPI(videoMetadata.title, videoMetadata.description);

            // Create broadcast
            const broadcast = await broadcastService.createBroadcast({
              channelId: channel._id.toString(),
              title: videoMetadata.title,
              description: videoMetadata.description,
            });

            // Verify broadcast metadata matches input
            expect(broadcast.title).toBe(videoMetadata.title);
            expect(broadcast.description).toBe(videoMetadata.description);
          } finally {
            // Clean up
            await Channel.deleteMany({});
            jest.restoreAllMocks();
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 26: Metadata injection failure aborts stream', () => {
    // Arbitrary for generating video metadata
    const videoMetadataArbitrary = fc.record({
      title: fc
        .string({ minLength: 1, maxLength: 100 })
        .filter((s) => s.trim().length > 0 && s.trim().length <= 100),
      description: fc
        .string({ minLength: 0, maxLength: 500 })
        .map((s) => s.trim()),
    });

    // Mock YouTube API with metadata mismatch
    const mockYouTubeAPIWithMismatch = (expectedTitle, expectedDescription) => {
      const mockStreamId = fc.sample(fc.uuid(), 1)[0];
      const mockBroadcastId = fc.sample(fc.uuid(), 1)[0];
      const mockRtmpUrl = 'rtmp://a.rtmp.youtube.com/live2';
      const mockStreamKey = fc.sample(fc.hexaString({ minLength: 20, maxLength: 40 }), 1)[0];

      // Return different metadata than expected
      const wrongTitle = expectedTitle + ' WRONG';
      const wrongDescription = expectedDescription + ' WRONG';

      jest.spyOn(youtubeApiService, 'getAuthenticatedClient').mockResolvedValue({
        liveStreams: {
          insert: jest.fn().mockResolvedValue({
            data: {
              id: mockStreamId,
              cdn: {
                ingestionInfo: {
                  ingestionAddress: mockRtmpUrl,
                  streamName: mockStreamKey,
                },
              },
            },
          }),
        },
        liveBroadcasts: {
          insert: jest.fn().mockResolvedValue({
            data: {
              id: mockBroadcastId,
              snippet: {
                title: expectedTitle,
                description: expectedDescription,
              },
            },
          }),
          bind: jest.fn().mockResolvedValue({
            data: {
              id: mockBroadcastId,
            },
          }),
          list: jest.fn().mockResolvedValue({
            data: {
              items: [
                {
                  id: mockBroadcastId,
                  snippet: {
                    title: wrongTitle,
                    description: wrongDescription,
                  },
                },
              ],
            },
          }),
        },
      });
    };

    // Mock YouTube API with no broadcast returned
    const mockYouTubeAPIWithNoBroadcast = () => {
      const mockStreamId = fc.sample(fc.uuid(), 1)[0];
      const mockBroadcastId = fc.sample(fc.uuid(), 1)[0];
      const mockRtmpUrl = 'rtmp://a.rtmp.youtube.com/live2';
      const mockStreamKey = fc.sample(fc.hexaString({ minLength: 20, maxLength: 40 }), 1)[0];

      jest.spyOn(youtubeApiService, 'getAuthenticatedClient').mockResolvedValue({
        liveStreams: {
          insert: jest.fn().mockResolvedValue({
            data: {
              id: mockStreamId,
              cdn: {
                ingestionInfo: {
                  ingestionAddress: mockRtmpUrl,
                  streamName: mockStreamKey,
                },
              },
            },
          }),
        },
        liveBroadcasts: {
          insert: jest.fn().mockResolvedValue({
            data: {
              id: mockBroadcastId,
            },
          }),
          bind: jest.fn().mockResolvedValue({
            data: {
              id: mockBroadcastId,
            },
          }),
          list: jest.fn().mockResolvedValue({
            data: {
              items: [], // No broadcast returned
            },
          }),
        },
      });
    };

    test('For any broadcast creation where metadata injection fails, the system should log the error and not proceed with starting the FFmpeg stream', async () => {
      await fc.assert(
        fc.asyncProperty(videoMetadataArbitrary, async (videoMetadata) => {
          try {
            // Create a test channel
            const channel = await Channel.create({
              channelId: fc.sample(fc.uuid(), 1)[0],
              channelName: 'Test Channel',
              thumbnailUrl: 'https://example.com/thumb.jpg',
              accessToken: 'test-access-token',
              refreshToken: 'test-refresh-token',
              tokenExpiry: new Date(Date.now() + 3600000),
            });

            // Mock YouTube API with metadata mismatch
            mockYouTubeAPIWithMismatch(videoMetadata.title, videoMetadata.description);

            // Attempt to create broadcast - should fail
            await expect(
              broadcastService.createBroadcast({
                channelId: channel._id.toString(),
                title: videoMetadata.title,
                description: videoMetadata.description,
              })
            ).rejects.toThrow(/metadata/i);
          } finally {
            // Clean up
            await Channel.deleteMany({});
            jest.restoreAllMocks();
          }
        }),
        { numRuns: 100 }
      );
    });

    test('Metadata verification failure prevents stream initiation', async () => {
      await fc.assert(
        fc.asyncProperty(videoMetadataArbitrary, async (videoMetadata) => {
          try {
            // Create a test channel
            const channel = await Channel.create({
              channelId: fc.sample(fc.uuid(), 1)[0],
              channelName: 'Test Channel',
              thumbnailUrl: 'https://example.com/thumb.jpg',
              accessToken: 'test-access-token',
              refreshToken: 'test-refresh-token',
              tokenExpiry: new Date(Date.now() + 3600000),
            });

            // Mock YouTube API with no broadcast returned
            mockYouTubeAPIWithNoBroadcast();

            // Attempt to create broadcast - should fail
            await expect(
              broadcastService.createBroadcast({
                channelId: channel._id.toString(),
                title: videoMetadata.title,
                description: videoMetadata.description,
              })
            ).rejects.toThrow(/metadata/i);
          } finally {
            // Clean up
            await Channel.deleteMany({});
            jest.restoreAllMocks();
          }
        }),
        { numRuns: 100 }
      );
    });

    test('API errors during broadcast creation are properly thrown', async () => {
      await fc.assert(
        fc.asyncProperty(videoMetadataArbitrary, async (videoMetadata) => {
          try {
            // Create a test channel
            const channel = await Channel.create({
              channelId: fc.sample(fc.uuid(), 1)[0],
              channelName: 'Test Channel',
              thumbnailUrl: 'https://example.com/thumb.jpg',
              accessToken: 'test-access-token',
              refreshToken: 'test-refresh-token',
              tokenExpiry: new Date(Date.now() + 3600000),
            });

            // Mock YouTube API to throw an error
            jest.spyOn(youtubeApiService, 'getAuthenticatedClient').mockRejectedValue(
              new Error('YouTube API error')
            );

            // Attempt to create broadcast - should fail
            await expect(
              broadcastService.createBroadcast({
                channelId: channel._id.toString(),
                title: videoMetadata.title,
                description: videoMetadata.description,
              })
            ).rejects.toThrow('YouTube API error');
          } finally {
            // Clean up
            await Channel.deleteMany({});
            jest.restoreAllMocks();
          }
        }),
        { numRuns: 50 }
      );
    });
  });
});
