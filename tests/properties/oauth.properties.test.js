const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Channel = require('../../src/models/Channel');
const Settings = require('../../src/models/Settings');
const channelService = require('../../src/services/channelService');
const youtubeApiService = require('../../src/services/youtubeApiService');

// Feature: super-stream-app, Property 7: OAuth success stores complete channel data
// Validates: Requirements 3.2, 3.3

// Feature: super-stream-app, Property 15: Saved credentials used for API requests
// Validates: Requirements 6.3

describe('OAuth Property Tests', () => {
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
    await Settings.deleteMany({});
  });

  describe('Property 7: OAuth success stores complete channel data', () => {
    // Arbitrary for generating OAuth token data
    const oauthTokensArbitrary = fc.record({
      access_token: fc.hexaString({ minLength: 20, maxLength: 200 }),
      refresh_token: fc.hexaString({ minLength: 20, maxLength: 200 }),
      expiry_date: fc.integer({ min: Date.now(), max: Date.now() + 365 * 24 * 60 * 60 * 1000 }),
    });

    // Arbitrary for generating channel information
    const channelInfoArbitrary = fc.record({
      channelId: fc.uuid(),
      channelName: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
      thumbnailUrl: fc.webUrl(),
      subscriberCount: fc.integer({ min: 0, max: 10000000 }),
      totalViews: fc.integer({ min: 0, max: 1000000000 }),
    });

    test('For any successful YouTube OAuth authentication, the system should store access token, refresh token, channel ID, channel name, and thumbnail', async () => {
      await fc.assert(
        fc.asyncProperty(
          oauthTokensArbitrary,
          channelInfoArbitrary,
          async (tokens, channelInfo) => {
            try {
              // Create channel directly to test data storage
              const channel = await Channel.create({
                channelId: channelInfo.channelId,
                channelName: channelInfo.channelName,
                thumbnailUrl: channelInfo.thumbnailUrl,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
                subscriberCount: channelInfo.subscriberCount,
                totalViews: channelInfo.totalViews,
              });

              // Verify all required data is stored
              expect(channel).toBeDefined();
              expect(channel.channelId).toBe(channelInfo.channelId.trim());
              expect(channel.channelName).toBe(channelInfo.channelName.trim());
              expect(channel.thumbnailUrl).toBe(channelInfo.thumbnailUrl.trim());
              
              // Verify tokens are stored (encrypted)
              expect(channel.accessToken).toBeDefined();
              expect(channel.refreshToken).toBeDefined();
              expect(channel.accessToken.startsWith('encrypted:')).toBe(true);
              expect(channel.refreshToken.startsWith('encrypted:')).toBe(true);

              // Verify tokens can be decrypted back to original values
              expect(channel.getAccessToken()).toBe(tokens.access_token);
              expect(channel.getRefreshToken()).toBe(tokens.refresh_token);

              // Verify token expiry is stored
              if (tokens.expiry_date) {
                expect(channel.tokenExpiry).toBeDefined();
                expect(channel.tokenExpiry.getTime()).toBe(tokens.expiry_date);
              }

              // Verify statistics are stored
              expect(channel.subscriberCount).toBe(channelInfo.subscriberCount);
              expect(channel.totalViews).toBe(channelInfo.totalViews);

              // Verify the channel can be retrieved from database
              const savedChannel = await Channel.findOne({ channelId: channelInfo.channelId.trim() });
              expect(savedChannel).toBeDefined();
              expect(savedChannel.channelId).toBe(channelInfo.channelId.trim());
              expect(savedChannel.channelName).toBe(channelInfo.channelName.trim());
              expect(savedChannel.thumbnailUrl).toBe(channelInfo.thumbnailUrl.trim());
            } finally {
              // Clean up after each iteration
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('OAuth data round-trip preserves all channel information', async () => {
      await fc.assert(
        fc.asyncProperty(
          oauthTokensArbitrary,
          channelInfoArbitrary,
          async (tokens, channelInfo) => {
            try {
              // Create channel directly with all data
              const originalChannel = await Channel.create({
                channelId: channelInfo.channelId,
                channelName: channelInfo.channelName,
                thumbnailUrl: channelInfo.thumbnailUrl,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
                subscriberCount: channelInfo.subscriberCount,
                totalViews: channelInfo.totalViews,
              });

              // Retrieve channel from database
              const retrievedChannel = await Channel.findOne({ channelId: channelInfo.channelId });

              // Verify all fields are preserved
              expect(retrievedChannel.channelId).toBe(originalChannel.channelId);
              expect(retrievedChannel.channelName).toBe(originalChannel.channelName);
              expect(retrievedChannel.thumbnailUrl).toBe(originalChannel.thumbnailUrl);
              expect(retrievedChannel.subscriberCount).toBe(originalChannel.subscriberCount);
              expect(retrievedChannel.totalViews).toBe(originalChannel.totalViews);

              // Verify tokens are encrypted and can be decrypted
              expect(retrievedChannel.getAccessToken()).toBe(tokens.access_token);
              expect(retrievedChannel.getRefreshToken()).toBe(tokens.refresh_token);

              // Verify token expiry
              if (tokens.expiry_date) {
                expect(retrievedChannel.tokenExpiry.getTime()).toBe(originalChannel.tokenExpiry.getTime());
              }
            } finally {
              // Clean up after each iteration
              await Channel.deleteMany({});
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('OAuth requires both access token and refresh token', async () => {
      await fc.assert(
        fc.asyncProperty(channelInfoArbitrary, async (channelInfo) => {
          // Attempt to create channel without access token
          await expect(
            Channel.create({
              channelId: channelInfo.channelId,
              channelName: channelInfo.channelName,
              refreshToken: 'some-refresh-token',
              // accessToken is missing
            })
          ).rejects.toThrow();

          // Attempt to create channel without refresh token
          await expect(
            Channel.create({
              channelId: channelInfo.channelId,
              channelName: channelInfo.channelName,
              accessToken: 'some-access-token',
              // refreshToken is missing
            })
          ).rejects.toThrow();
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 15: Saved credentials used for API requests', () => {
    // Arbitrary for generating Google API credentials
    const googleCredentialsArbitrary = fc.record({
      clientId: fc.hexaString({ minLength: 20, maxLength: 100 }),
      clientSecret: fc.hexaString({ minLength: 20, maxLength: 100 }),
    });

    test('For any YouTube API request after credentials are saved, the request should use the saved credentials', async () => {
      await fc.assert(
        fc.asyncProperty(googleCredentialsArbitrary, async (credentials) => {
          try {
            // Save credentials to settings
            const settings = await Settings.create({
              googleClientId: credentials.clientId,
              googleClientSecret: credentials.clientSecret,
            });

            // Verify credentials are encrypted in database
            expect(settings.googleClientId.startsWith('encrypted:')).toBe(true);
            expect(settings.googleClientSecret.startsWith('encrypted:')).toBe(true);

            // Verify credentials can be decrypted
            expect(settings.getGoogleClientId()).toBe(credentials.clientId);
            expect(settings.getGoogleClientSecret()).toBe(credentials.clientSecret);

            // Get OAuth2 client (this should use the saved credentials)
            const oauth2Client = await youtubeApiService.getOAuth2Client();

            // Verify the OAuth2 client is configured with the saved credentials
            expect(oauth2Client).toBeDefined();
            expect(oauth2Client._clientId).toBe(credentials.clientId);
            expect(oauth2Client._clientSecret).toBe(credentials.clientSecret);
          } finally {
            // Clean up after each iteration
            await Settings.deleteMany({});
          }
        }),
        { numRuns: 100 }
      );
    });

    test('API credentials round-trip with encryption', async () => {
      await fc.assert(
        fc.asyncProperty(googleCredentialsArbitrary, async (credentials) => {
          try {
            // Save credentials
            const originalSettings = await Settings.create({
              googleClientId: credentials.clientId,
              googleClientSecret: credentials.clientSecret,
            });

            // Retrieve settings
            const retrievedSettings = await Settings.findById(originalSettings._id);

            // Verify encrypted values are stored
            expect(retrievedSettings.googleClientId).toBe(originalSettings.googleClientId);
            expect(retrievedSettings.googleClientSecret).toBe(originalSettings.googleClientSecret);

            // Verify decrypted values match original
            expect(retrievedSettings.getGoogleClientId()).toBe(credentials.clientId);
            expect(retrievedSettings.getGoogleClientSecret()).toBe(credentials.clientSecret);
          } finally {
            // Clean up after each iteration
            await Settings.deleteMany({});
          }
        }),
        { numRuns: 100 }
      );
    });

    test('OAuth client creation fails without configured credentials', async () => {
      // Ensure no settings exist
      await Settings.deleteMany({});

      // Attempt to get OAuth2 client without credentials
      await expect(youtubeApiService.getOAuth2Client()).rejects.toThrow(
        'Google API credentials not configured'
      );
    });

    test('OAuth client creation fails with empty credentials', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('', null, undefined),
          fc.constantFrom('', null, undefined),
          async (emptyClientId, emptyClientSecret) => {
            try {
              // Create settings with empty credentials
              await Settings.create({
                googleClientId: emptyClientId || undefined,
                googleClientSecret: emptyClientSecret || undefined,
              });

              // Attempt to get OAuth2 client
              await expect(youtubeApiService.getOAuth2Client()).rejects.toThrow();
            } finally {
              await Settings.deleteMany({});
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
