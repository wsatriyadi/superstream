// Jest setup file
// This file runs before all tests

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/superstream-test';
process.env.SESSION_SECRET = 'test-secret';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars!!';

// Increase timeout for integration tests
jest.setTimeout(10000);
