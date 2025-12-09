const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Settings = require('../../src/models/Settings');
const settingsService = require('../../src/services/settingsService');

let mongoServer;

beforeAll(async () => {
  // Disconnect from any existing connection
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear database before each test
  await Settings.deleteMany({});
});

describe('Settings Credentials Property Tests', () => {
  // Feature: super-stream-app, Property 14: API credentials round-trip with encryption
  // Validates: Requirements 6.2
  describe('Property 14: API credentials round-trip with encryption', () => {
    test('should store and retrieve Google API credentials with encryption', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid Google Client IDs
          fc.tuple(
            fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), { minLength: 10, maxLength: 30 }),
            fc.constant('.apps.googleusercontent.com')
          ).map(([prefix, suffix]) => prefix + suffix),
          // Generate valid Google Client Secrets
          fc.stringOf(
            fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split('')),
            { minLength: 20, maxLength: 40 }
          ),
          async (clientId, clientSecret) => {
            // Save credentials
            const savedSettings = await settingsService.updateSettings({
              googleClientId: clientId,
              googleClientSecret: clientSecret,
            });

            // Verify saved values match input
            expect(savedSettings.googleClientId).toBe(clientId);
            expect(savedSettings.googleClientSecret).toBe(clientSecret);

            // Retrieve settings again
            const retrievedSettings = await settingsService.getSettings();

            // Verify round-trip: retrieved values should match original input
            expect(retrievedSettings.googleClientId).toBe(clientId);
            expect(retrievedSettings.googleClientSecret).toBe(clientSecret);

            // Verify encryption: check database directly to ensure values are encrypted
            const dbSettings = await Settings.findOne();
            expect(dbSettings.googleClientId).toContain('encrypted:');
            expect(dbSettings.googleClientSecret).toContain('encrypted:');
            
            // Verify encrypted values are different from plain text
            expect(dbSettings.googleClientId).not.toBe(clientId);
            expect(dbSettings.googleClientSecret).not.toBe(clientSecret);

            // Verify decryption methods work
            expect(dbSettings.getGoogleClientId()).toBe(clientId);
            expect(dbSettings.getGoogleClientSecret()).toBe(clientSecret);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);
  });
});
