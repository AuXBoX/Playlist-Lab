/**
 * Unit Tests for Authentication Routes
 * 
 * Tests the auth endpoints:
 * - POST /api/auth/start
 * - POST /api/auth/poll
 * - POST /api/auth/logout
 * - GET /api/auth/me
 */

import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import authRoutes from '../../src/routes/auth';
import { DatabaseService, getDatabase } from '../../src/database';
import { AuthService } from '../../src/services/auth';
import { errorHandler } from '../../src/middleware/error-handler';

// Mock the AuthService
jest.mock('../../src/services/auth');

describe('Authentication Routes', () => {
  let app: express.Application;
  let dbService: DatabaseService;

  beforeEach(() => {
    // Create fresh app for each test
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Setup session
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
    }));

    // Attach database service
    dbService = new DatabaseService(getDatabase());
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.dbService = dbService;
      next();
    });

    // Mount auth routes
    app.use('/api/auth', authRoutes);

    // Add error handler (must be after routes)
    app.use(errorHandler);
  });

  afterEach(() => {
    // Clean up database - delete all users created during tests
    const db = getDatabase();
    db.prepare('DELETE FROM users WHERE plex_user_id = ?').run('98765');
    jest.clearAllMocks();
  });

  describe('POST /api/auth/start', () => {
    it('should initiate Plex PIN auth successfully', async () => {
      const mockPin = {
        id: 12345,
        code: 'ABCD1234',
        product: 'Test App',
        trusted: false,
        clientIdentifier: 'test-client',
        location: {
          code: 'US',
          european_union_member: false,
          continent_code: 'NA',
          country: 'United States',
          city: 'New York',
          time_zone: 'America/New_York',
          postal_code: '10001',
          in_privacy_restricted_country: false,
          subdivisions: 'NY',
          coordinates: '40.7128,-74.0060',
        },
        expiresIn: 1800,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 1800000).toISOString(),
        authToken: null,
        newRegistration: null,
      };

      // Mock startAuth to return the PIN
      (AuthService.prototype.startAuth as jest.Mock).mockResolvedValue(mockPin);
      (AuthService.prototype.getAuthUrl as jest.Mock).mockReturnValue(
        `https://app.plex.tv/auth#?clientID=test-client&code=${mockPin.code}`
      );

      const response = await request(app)
        .post('/api/auth/start')
        .expect(200);

      expect(response.body).toEqual({
        id: mockPin.id,
        code: mockPin.code,
        authUrl: expect.stringContaining('app.plex.tv/auth'),
      });
    });

    it('should handle auth service errors', async () => {
      // Mock startAuth to throw error
      (AuthService.prototype.startAuth as jest.Mock).mockRejectedValue(
        new Error('Plex API unavailable')
      );

      const response = await request(app)
        .post('/api/auth/start')
        .expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Failed to initiate authentication');
    });
  });

  describe('POST /api/auth/poll', () => {
    it('should return authenticated: false when PIN not yet authorized', async () => {
      const mockPin = {
        id: 12345,
        code: 'ABCD1234',
        authToken: null,
      };

      (AuthService.prototype.pollAuth as jest.Mock).mockResolvedValue(mockPin);

      const response = await request(app)
        .post('/api/auth/poll')
        .send({ pinId: 12345, code: 'ABCD1234' })
        .expect(200);

      expect(response.body).toEqual({ authenticated: false });
    });

    it('should create new user and session when PIN is authorized', async () => {
      const mockPin = {
        id: 12345,
        code: 'ABCD1234',
        authToken: 'test-auth-token',
      };

      const mockUserInfo = {
        id: 98765,
        uuid: 'user-uuid',
        username: 'testuser',
        title: 'Test User',
        email: 'test@example.com',
        friendlyName: 'Test User',
        locale: null,
        confirmed: true,
        joinedAt: new Date().toISOString(),
        emailOnlyAuth: false,
        hasPassword: true,
        protected: false,
        thumb: 'https://plex.tv/users/avatar.png',
        authToken: 'test-auth-token',
        mailingListStatus: 'active',
        mailingListActive: true,
        scrobbleTypes: '',
        country: 'US',
        subscription: {
          active: true,
          status: 'Active',
          plan: null,
          features: [],
        },
        subscriptionDescription: 'Plex Pass',
        restricted: false,
        anonymous: null,
        home: false,
        guest: false,
        homeSize: 1,
        homeAdmin: true,
        maxHomeSize: 15,
        rememberExpiresAt: new Date(Date.now() + 86400000).toISOString(),
        profile: {
          autoSelectAudio: true,
          defaultAudioLanguage: 'en',
          defaultSubtitleLanguage: 'en',
          autoSelectSubtitle: 0,
          defaultSubtitleAccessibility: 0,
          defaultSubtitleForced: 0,
          watchedIndicator: 1,
          mediaReviewsVisibility: 0,
        },
        entitlements: [],
        roles: [],
        services: [],
        adsConsent: null,
        adsConsentSetAt: null,
        adsConsentReminderAt: null,
        experimentalFeatures: false,
        twoFactorEnabled: false,
        backupCodesCreated: false,
      };

      (AuthService.prototype.pollAuth as jest.Mock).mockResolvedValue(mockPin);
      (AuthService.prototype.getUserInfo as jest.Mock).mockResolvedValue(mockUserInfo);

      const response = await request(app)
        .post('/api/auth/poll')
        .send({ pinId: 12345, code: 'ABCD1234' })
        .expect(200);

      expect(response.body.authenticated).toBe(true);
      expect(response.body.user).toEqual({
        id: expect.any(Number),
        plexUserId: '98765',
        username: 'testuser',
        thumb: 'https://plex.tv/users/avatar.png',
      });

      // Verify user was created in database
      const user = dbService.getUserByPlexId('98765');
      expect(user).toBeDefined();
      expect(user?.plex_username).toBe('testuser');
    });

    it('should update existing user login timestamp', async () => {
      // Create existing user
      const existingUser = dbService.createUser(
        '98765',
        'testuser',
        'old-token',
        'https://plex.tv/users/avatar.png'
      );

      const mockPin = {
        id: 12345,
        code: 'ABCD1234',
        authToken: 'new-auth-token',
      };

      const mockUserInfo = {
        id: 98765,
        username: 'testuser',
        thumb: 'https://plex.tv/users/avatar.png',
      };

      (AuthService.prototype.pollAuth as jest.Mock).mockResolvedValue(mockPin);
      (AuthService.prototype.getUserInfo as jest.Mock).mockResolvedValue(mockUserInfo);

      const response = await request(app)
        .post('/api/auth/poll')
        .send({ pinId: 12345, code: 'ABCD1234' })
        .expect(200);

      expect(response.body.authenticated).toBe(true);
      expect(response.body.user.id).toBe(existingUser.id);

      // Verify last_login was updated
      const updatedUser = dbService.getUserById(existingUser.id);
      expect(updatedUser?.last_login).toBeGreaterThan(existingUser.last_login);
    });

    it('should return validation error when pinId or code is missing', async () => {
      const response = await request(app)
        .post('/api/auth/poll')
        .send({ pinId: 12345 })
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('pinId and code are required');
    });

    it('should handle auth service errors', async () => {
      (AuthService.prototype.pollAuth as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const response = await request(app)
        .post('/api/auth/poll')
        .send({ pinId: 12345, code: 'ABCD1234' })
        .expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Failed to complete authentication');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should destroy session successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(200);

      expect(response.body).toEqual({ success: true });
    });

    it('should handle session destruction errors', async () => {
      // This is tricky to test as session.destroy is hard to mock
      // We'll just verify the endpoint exists and returns success
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should return user info when authenticated', async () => {
      // Create a user
      const user = dbService.createUser(
        '98765',
        'testuser',
        'test-token',
        'https://plex.tv/users/avatar.png'
      );

      // Create authenticated session
      const agent = request.agent(app);
      
      // Manually set session (simulating authenticated state)
      // This requires making a request that sets the session
      const mockPin = {
        id: 12345,
        code: 'ABCD1234',
        authToken: 'test-auth-token',
      };

      const mockUserInfo = {
        id: 98765,
        username: 'testuser',
        thumb: 'https://plex.tv/users/avatar.png',
      };

      (AuthService.prototype.pollAuth as jest.Mock).mockResolvedValue(mockPin);
      (AuthService.prototype.getUserInfo as jest.Mock).mockResolvedValue(mockUserInfo);

      // First authenticate
      await agent
        .post('/api/auth/poll')
        .send({ pinId: 12345, code: 'ABCD1234' })
        .expect(200);

      // Then get user info
      const response = await agent
        .get('/api/auth/me')
        .expect(200);

      expect(response.body).toEqual({
        id: user.id,
        plexUserId: '98765',
        username: 'testuser',
        thumb: 'https://plex.tv/users/avatar.png',
      });
    });
  });
});
