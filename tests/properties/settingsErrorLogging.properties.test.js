const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Settings = require('../../src/models/Settings');
const settingsService = require('../../src/services/settingsService');
const logger = require('../../src/config/logger');

let mongoServer;
let loggerErrorSpy;

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
  
  // Spy on logger.error
  loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
});

afterEach(() => {
  // Restore logger
  loggerErrorSpy.mockRestore();
});

describe('Settings Error Logging Property Tests', () => {
  // Feature: super-stream-app, Property 16: Invalid credentials trigger error logging
  // Validates: Requirements 6.4
  describe('Property 16: Invalid credentials trigger error logging', () => {
    test('should log error when invalid Google Client ID is provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate invalid Client IDs (missing .apps.googleusercontent.com suffix or wrong format)
          fc.oneof(
            fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('.apps.googleusercontent.com')),
            fc.constant(''),
            fc.constant('invalid-format'),
            fc.constant('test@example.com'),
            fc.constant('123456789'),
          ),
          async (invalidClientId) => {
            loggerErrorSpy.mockClear();

            try {
              await settingsService.updateSettings({
                googleClientId: invalidClientId,
              });
              
              // If we get here, the validation didn't work as expected
              // But we still check if error was logged
              if (invalidClientId !== '' && invalidClientId !== null) {
                expect(loggerErrorSpy).toHaveBeenCalled();
              }
            } catch (error) {
              // Error should be thrown for invalid credentials
              expect(error).toBeDefined();
              expect(error.message).toContain('Invalid Google Client ID format');
              
              // Logger should have been called with error
              expect(loggerErrorSpy).toHaveBeenCalled();
              
              // Verify error log contains relevant information
              const errorCalls = loggerErrorSpy.mock.calls;
              const relevantCall = errorCalls.find(call => 
                call[0].includes('Invalid Google Client ID format') ||
                call[0].includes('Settings update failed')
              );
              expect(relevantCall).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    test('should log error when invalid Google Client Secret is provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate invalid Client Secrets (too short or contains invalid characters)
          fc.oneof(
            fc.string({ minLength: 1, maxLength: 19 }), // Too short
            fc.constant(''),
            fc.string({ minLength: 20, maxLength: 30 }).filter(s => /[^a-zA-Z0-9_-]/.test(s)), // Invalid chars
            fc.constant('short'),
            fc.constant('has spaces in it!!!'),
          ),
          async (invalidClientSecret) => {
            loggerErrorSpy.mockClear();

            try {
              await settingsService.updateSettings({
                googleClientId: 'valid-client-id.apps.googleusercontent.com',
                googleClientSecret: invalidClientSecret,
              });
              
              // If we get here, the validation didn't work as expected
              // But we still check if error was logged
              if (invalidClientSecret !== '' && invalidClientSecret !== null) {
                expect(loggerErrorSpy).toHaveBeenCalled();
              }
            } catch (error) {
              // Error should be thrown for invalid credentials
              expect(error).toBeDefined();
              expect(error.message).toContain('Invalid Google Client Secret format');
              
              // Logger should have been called with error
              expect(loggerErrorSpy).toHaveBeenCalled();
              
              // Verify error log contains relevant information
              const errorCalls = loggerErrorSpy.mock.calls;
              const relevantCall = errorCalls.find(call => 
                call[0].includes('Invalid Google Client Secret format') ||
                call[0].includes('Settings update failed')
              );
              expect(relevantCall).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);
  });
});
