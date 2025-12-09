const fc = require('fast-check');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/index');
const User = require('../../src/models/User');

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
  await User.deleteMany({});
});

describe('Authentication Property Tests', () => {
  // Feature: super-stream-app, Property 1: Unauthenticated access redirects to login
  // Validates: Requirements 1.1
  describe('Property 1: Unauthenticated access redirects to login', () => {
    test('should redirect unauthenticated requests to login page', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            '/dashboard',
            '/channels',
            '/videos',
            '/streams',
            '/settings',
            '/api/channels',
            '/api/videos',
            '/api/streams'
          ),
          async (protectedRoute) => {
            const response = await request(app)
              .get(protectedRoute)
              .redirects(0); // Don't follow redirects

            // Should redirect (302 or 301) to login
            expect([301, 302]).toContain(response.status);
            
            // Check if redirect location contains 'login'
            if (response.headers.location) {
              expect(response.headers.location).toMatch(/login/);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: super-stream-app, Property 2: Valid credentials create authenticated session
  // Validates: Requirements 1.2
  describe('Property 2: Valid credentials create authenticated session', () => {
    test('should create authenticated session with valid credentials', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
          fc.string({ minLength: 6, maxLength: 20 }),
          async (username, password) => {
            // Delete any existing user with this username first
            await User.deleteOne({ username });
            
            // Create a test user
            const user = new User({
              username,
              passwordHash: password,
            });
            await user.save();

            // Create an agent to maintain session
            const agent = request.agent(app);
            
            // First, get the login page to obtain CSRF token
            const loginPageResponse = await agent.get('/login');
            expect(loginPageResponse.status).toBe(200);
            
            // Extract CSRF token from the response
            const csrfTokenMatch = loginPageResponse.text.match(/name="_csrf" value="([^"]+)"/);
            const csrfToken = csrfTokenMatch ? csrfTokenMatch[1] : null;

            // Attempt login with CSRF token
            const loginResponse = await agent
              .post('/login')
              .send({ username, password, _csrf: csrfToken })
              .redirects(0);

            // Should redirect to dashboard (302)
            expect([301, 302]).toContain(loginResponse.status);
            expect(loginResponse.headers.location).toMatch(/dashboard/);

            // Should have session cookie
            expect(loginResponse.headers['set-cookie']).toBeDefined();
            const cookies = loginResponse.headers['set-cookie'];
            expect(cookies.some(cookie => cookie.includes('connect.sid'))).toBe(true);

            // Clean up
            await User.deleteOne({ username });
          }
        ),
        { numRuns: 20 }
      );
    }, 30000);
  });

  // Feature: super-stream-app, Property 3: Session termination requires re-authentication
  // Validates: Requirements 1.3
  describe('Property 3: Session termination requires re-authentication', () => {
    test('should require re-authentication after logout', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
          fc.string({ minLength: 6, maxLength: 20 }),
          async (username, password) => {
            // Delete any existing user with this username first
            await User.deleteOne({ username });
            
            // Create a test user
            const user = new User({
              username,
              passwordHash: password,
            });
            await user.save();

            // Login
            const agent = request.agent(app);
            
            // Get login page for CSRF token
            const loginPageResponse = await agent.get('/login');
            const csrfTokenMatch = loginPageResponse.text.match(/name="_csrf" value="([^"]+)"/);
            const csrfToken = csrfTokenMatch ? csrfTokenMatch[1] : null;
            
            await agent
              .post('/login')
              .send({ username, password, _csrf: csrfToken });

            // Access protected route (should work)
            const beforeLogout = await agent.get('/dashboard').redirects(0);
            expect(beforeLogout.status).toBe(200);

            // Logout
            await agent.get('/logout');

            // Try to access protected route again (should redirect to login)
            const afterLogout = await agent.get('/dashboard').redirects(0);
            expect([301, 302]).toContain(afterLogout.status);
            expect(afterLogout.headers.location).toMatch(/login/);

            // Clean up
            await User.deleteOne({ username });
          }
        ),
        { numRuns: 20 }
      );
    }, 30000);
  });

  // Feature: super-stream-app, Property 4: Session persistence across navigation
  // Validates: Requirements 1.4
  describe('Property 4: Session persistence across navigation', () => {
    test('should maintain session across multiple page navigations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
          fc.string({ minLength: 6, maxLength: 20 }),
          fc.array(
            fc.constantFrom('/dashboard', '/channels', '/videos', '/streams', '/settings'),
            { minLength: 2, maxLength: 5 }
          ),
          async (username, password, routes) => {
            // Delete any existing user with this username first
            await User.deleteOne({ username });
            
            // Create a test user
            const user = new User({
              username,
              passwordHash: password,
            });
            await user.save();

            // Login with agent to maintain session
            const agent = request.agent(app);
            
            // Get login page for CSRF token
            const loginPageResponse = await agent.get('/login');
            const csrfTokenMatch = loginPageResponse.text.match(/name="_csrf" value="([^"]+)"/);
            const csrfToken = csrfTokenMatch ? csrfTokenMatch[1] : null;
            
            await agent
              .post('/login')
              .send({ username, password, _csrf: csrfToken });

            // Navigate to multiple routes
            for (const route of routes) {
              const response = await agent.get(route).redirects(0);
              
              // Should not redirect to login (status 200 or other success)
              expect(response.status).not.toBe(302);
              if (response.status === 302 || response.status === 301) {
                expect(response.headers.location).not.toMatch(/login/);
              }
            }

            // Clean up
            await User.deleteOne({ username });
          }
        ),
        { numRuns: 20 }
      );
    }, 30000);
  });
});
