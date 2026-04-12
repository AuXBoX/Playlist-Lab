/**
 * Unit Tests: YouTube OAuth Service
 * 
 * Tests the YouTubeOAuthService class including:
 * - Authorization URL generation
 * - Code exchange for tokens
 * - Token storage and retrieval (with encryption)
 * - Token expiry checking
 * - Automatic token refresh
 * - Error handling for various failure scenarios
 */

import { YouTubeOAuthService } from '../../src/services/youtube-oauth';
import { encrypt, decrypt } from '../../src/utils/encryption';
import { OAuth2Client } from 'google-auth-library';

// Mock dependencies
jest.mock('../../src/utils/encryption');
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock googleapis
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: jest.fn(),
        getToken: jest.fn(),
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn(),
        revokeToken: jest.fn(),
      })),
    },
    youtube: jest.fn(),
  },
}));

describe('YouTubeOAuthService', () => {
  let service: YouTubeOAuthService;
  let mockOAuth2Client: any;
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    process.env = {
      ...originalEnv,
      YOUTUBE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
      YOUTUBE_CLIENT_SECRET: 'test-client-secret',
      YOUTUBE_REDIRECT_URI: 'http://localhost:3001/api/cross-import/oauth/youtube/callback',
      SESSION_SECRET: 'test-encryption-secret',
    };

    // Reset mocks
    jest.clearAllMocks();

    // Create service instance
    service = new YouTubeOAuthService();
    mockOAuth2Client = (service as any).oauth2Client;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Constructor', () => {
    it('should initialize with valid credentials', () => {
      expect(service).toBeDefined();
      expect(service.isReady()).toBe(true);
    });

    it('should handle missing CLIENT_ID', () => {
      delete process.env.YOUTUBE_CLIENT_ID;
      const newService = new YouTubeOAuthService();
      expect(newService.isReady()).toBe(false);
    });

    it('should handle missing CLIENT_SECRET', () => {
      delete process.env.YOUTUBE_CLIENT_SECRET;
      const newService = new YouTubeOAuthService();
      expect(newService.isReady()).toBe(false);
    });

    it('should handle missing REDIRECT_URI', () => {
      delete process.env.YOUTUBE_REDIRECT_URI;
      const newService = new YouTubeOAuthService();
      expect(newService.isReady()).toBe(false);
    });
  });

  describe('getAuthUrl', () => {
    it('should generate valid authorization URL', () => {
      const state = 'user-123';
      const expectedUrl = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test-client-id';
      
      mockOAuth2Client.generateAuthUrl.mockReturnValue(expectedUrl);

      const url = service.getAuthUrl(state);

      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/youtube.force-ssl'],
        state,
        prompt: 'consent',
      });
      expect(url).toBe(expectedUrl);
    });

    it('should throw error when not configured', () => {
      const unconfiguredService = new YouTubeOAuthService();
      delete process.env.YOUTUBE_CLIENT_ID;
      
      // Create a new instance without credentials
      const serviceWithoutCreds = Object.create(YouTubeOAuthService.prototype);
      (serviceWithoutCreds as any).isConfigured = false;

      expect(() => serviceWithoutCreds.getAuthUrl('test-state')).toThrow(
        'YouTube OAuth not configured'
      );
    });
  });

  describe('exchangeCode', () => {
    it('should exchange authorization code for tokens', async () => {
      const code = 'auth-code-123';
      const mockTokens = {
        access_token: 'access-token-abc',
        refresh_token: 'refresh-token-xyz',
        expiry_date: Date.now() + 3600000,
      };

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens } as any);

      const result = await service.exchangeCode(code);

      expect(mockOAuth2Client.getToken).toHaveBeenCalledWith(code);
      expect(result).toEqual({
        access_token: mockTokens.access_token,
        refresh_token: mockTokens.refresh_token,
        expires_at: mockTokens.expiry_date,
      });
    });

    it('should handle tokens without refresh_token', async () => {
      const code = 'auth-code-123';
      const mockTokens = {
        access_token: 'access-token-abc',
        expiry_date: Date.now() + 3600000,
      };

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens } as any);

      const result = await service.exchangeCode(code);

      expect(result.refresh_token).toBeUndefined();
    });

    it('should throw error when no access_token received', async () => {
      const code = 'auth-code-123';
      mockOAuth2Client.getToken.mockResolvedValue({ tokens: {} } as any);

      await expect(service.exchangeCode(code)).rejects.toThrow(
        'No access token received from Google'
      );
    });

    it('should throw error when not configured', async () => {
      const serviceWithoutCreds = Object.create(YouTubeOAuthService.prototype);
      (serviceWithoutCreds as any).isConfigured = false;

      await expect(serviceWithoutCreds.exchangeCode('code')).rejects.toThrow(
        'YouTube OAuth not configured'
      );
    });

    it('should handle API errors', async () => {
      const code = 'auth-code-123';
      mockOAuth2Client.getToken.mockRejectedValue(new Error('Invalid code'));

      await expect(service.exchangeCode(code)).rejects.toThrow(
        'Failed to exchange authorization code: Invalid code'
      );
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token successfully', async () => {
      const refreshToken = 'refresh-token-xyz';
      const mockCredentials = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expiry_date: Date.now() + 3600000,
      };

      mockOAuth2Client.refreshAccessToken.mockResolvedValue({ 
        credentials: mockCredentials 
      } as any);

      const result = await service.refreshAccessToken(refreshToken);

      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({ 
        refresh_token: refreshToken 
      });
      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
      expect(result).toEqual({
        access_token: mockCredentials.access_token,
        refresh_token: mockCredentials.refresh_token,
        expires_at: mockCredentials.expiry_date,
      });
    });

    it('should keep old refresh_token if not provided', async () => {
      const refreshToken = 'refresh-token-xyz';
      const mockCredentials = {
        access_token: 'new-access-token',
        expiry_date: Date.now() + 3600000,
      };

      mockOAuth2Client.refreshAccessToken.mockResolvedValue({ 
        credentials: mockCredentials 
      } as any);

      const result = await service.refreshAccessToken(refreshToken);

      expect(result.refresh_token).toBe(refreshToken);
    });

    it('should throw error when no access_token returned', async () => {
      const refreshToken = 'refresh-token-xyz';
      mockOAuth2Client.refreshAccessToken.mockResolvedValue({ 
        credentials: {} 
      } as any);

      await expect(service.refreshAccessToken(refreshToken)).rejects.toThrow(
        'Failed to refresh access token - no token returned'
      );
    });

    it('should throw error when not configured', async () => {
      const serviceWithoutCreds = Object.create(YouTubeOAuthService.prototype);
      (serviceWithoutCreds as any).isConfigured = false;

      await expect(serviceWithoutCreds.refreshAccessToken('token')).rejects.toThrow(
        'YouTube OAuth not configured'
      );
    });

    it('should handle refresh errors', async () => {
      const refreshToken = 'refresh-token-xyz';
      mockOAuth2Client.refreshAccessToken.mockRejectedValue(
        new Error('Invalid refresh token')
      );

      await expect(service.refreshAccessToken(refreshToken)).rejects.toThrow(
        'Failed to refresh access token: Invalid refresh token'
      );
    });
  });

  describe('storeTokens', () => {
    it('should store tokens encrypted in database', async () => {
      const userId = 1;
      const tokens = {
        access_token: 'access-token-abc',
        refresh_token: 'refresh-token-xyz',
        expires_at: Date.now() + 3600000,
      };

      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          run: jest.fn(),
        }),
      };

      (encrypt as jest.Mock).mockImplementation((value: string) => `encrypted-${value}`);

      await service.storeTokens(userId, tokens, mockDb);

      expect(encrypt).toHaveBeenCalledWith(tokens.access_token, expect.any(String));
      expect(encrypt).toHaveBeenCalledWith(tokens.refresh_token, expect.any(String));
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO oauth_connections'));
      expect(mockDb.prepare().run).toHaveBeenCalledWith(
        userId,
        `encrypted-${tokens.access_token}`,
        `encrypted-${tokens.refresh_token}`,
        tokens.expires_at,
        tokens.expires_at, // stored in both token_expires_at and expires_at
        expect.any(Number), // created_at
        expect.any(Number)  // updated_at
      );
    });

    it('should handle tokens without refresh_token', async () => {
      const userId = 1;
      const tokens = {
        access_token: 'access-token-abc',
        expires_at: Date.now() + 3600000,
      };

      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          run: jest.fn(),
        }),
      };

      (encrypt as jest.Mock).mockImplementation((value: string) => `encrypted-${value}`);

      await service.storeTokens(userId, tokens, mockDb);

      expect(mockDb.prepare().run).toHaveBeenCalledWith(
        userId,
        `encrypted-${tokens.access_token}`,
        null,
        tokens.expires_at,
        tokens.expires_at, // stored in both token_expires_at and expires_at
        expect.any(Number), // created_at
        expect.any(Number)  // updated_at
      );
    });

    it('should handle database errors', async () => {
      const userId = 1;
      const tokens = {
        access_token: 'access-token-abc',
        refresh_token: 'refresh-token-xyz',
        expires_at: Date.now() + 3600000,
      };

      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          run: jest.fn().mockImplementation(() => {
            throw new Error('Database error');
          }),
        }),
      };

      (encrypt as jest.Mock).mockImplementation((value: string) => `encrypted-${value}`);

      await expect(service.storeTokens(userId, tokens, mockDb)).rejects.toThrow(
        'Failed to store tokens: Database error'
      );
    });
  });

  describe('getTokens', () => {
    it('should retrieve and decrypt tokens from database', async () => {
      const userId = 1;
      const mockRow = {
        access_token: 'encrypted-access-token',
        refresh_token: 'encrypted-refresh-token',
        expires_at: Date.now() + 3600000,
        token_expires_at: null,
      };

      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue(mockRow),
        }),
      };

      (decrypt as jest.Mock).mockImplementation((value: string) => 
        value.replace('encrypted-', '')
      );

      const result = await service.getTokens(userId, mockDb);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT access_token, refresh_token')
      );
      expect(mockDb.prepare().get).toHaveBeenCalledWith(userId, 'youtube');
      expect(decrypt).toHaveBeenCalledWith(mockRow.access_token, expect.any(String));
      expect(decrypt).toHaveBeenCalledWith(mockRow.refresh_token, expect.any(String));
      expect(result).toEqual({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_at: mockRow.expires_at,
      });
    });

    it('should use token_expires_at as fallback for expires_at', async () => {
      const userId = 1;
      const mockRow = {
        access_token: 'encrypted-access-token',
        refresh_token: 'encrypted-refresh-token',
        expires_at: null,
        token_expires_at: Date.now() + 3600000,
      };

      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue(mockRow),
        }),
      };

      (decrypt as jest.Mock).mockImplementation((value: string) => 
        value.replace('encrypted-', '')
      );

      const result = await service.getTokens(userId, mockDb);

      expect(result?.expires_at).toBe(mockRow.token_expires_at);
    });

    it('should return null when no tokens found', async () => {
      const userId = 1;
      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue(null),
        }),
      };

      const result = await service.getTokens(userId, mockDb);

      expect(result).toBeNull();
    });

    it('should return null on decryption error', async () => {
      const userId = 1;
      const mockRow = {
        access_token: 'encrypted-access-token',
        refresh_token: 'encrypted-refresh-token',
        expires_at: Date.now() + 3600000,
      };

      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue(mockRow),
        }),
      };

      (decrypt as jest.Mock).mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const result = await service.getTokens(userId, mockDb);

      expect(result).toBeNull();
    });
  });

  describe('getValidAccessToken', () => {
    it('should return valid token without refresh', async () => {
      const userId = 1;
      const futureExpiry = Date.now() + 3600000; // 1 hour from now
      const tokens = {
        access_token: 'valid-access-token',
        refresh_token: 'refresh-token',
        expires_at: futureExpiry,
      };

      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue({
            access_token: 'encrypted-access-token',
            refresh_token: 'encrypted-refresh-token',
            expires_at: futureExpiry,
          }),
        }),
      };

      (decrypt as jest.Mock).mockImplementation((value: string) => 
        value.replace('encrypted-', '')
      );

      const result = await service.getValidAccessToken(userId, mockDb);

      expect(result).toBe('access-token');
      expect(mockOAuth2Client.refreshAccessToken).not.toHaveBeenCalled();
    });

    it('should refresh expired token automatically', async () => {
      const userId = 1;
      const pastExpiry = Date.now() - 1000; // Expired
      const tokens = {
        access_token: 'old-access-token',
        refresh_token: 'refresh-token',
        expires_at: pastExpiry,
      };

      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue({
            access_token: 'encrypted-old-access-token',
            refresh_token: 'encrypted-refresh-token',
            expires_at: pastExpiry,
          }),
          run: jest.fn(),
        }),
      };

      (decrypt as jest.Mock).mockImplementation((value: string) => 
        value.replace('encrypted-', '')
      );
      (encrypt as jest.Mock).mockImplementation((value: string) => `encrypted-${value}`);

      const newTokens = {
        access_token: 'new-access-token',
        refresh_token: 'refresh-token',
        expiry_date: Date.now() + 3600000,
      };

      mockOAuth2Client.refreshAccessToken.mockResolvedValue({ 
        credentials: newTokens 
      } as any);

      const result = await service.getValidAccessToken(userId, mockDb);

      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({ 
        refresh_token: 'refresh-token' 
      });
      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
      expect(result).toBe('new-access-token');
    });

    it('should refresh token expiring within 5 minutes', async () => {
      const userId = 1;
      const soonExpiry = Date.now() + 4 * 60 * 1000; // 4 minutes from now

      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue({
            access_token: 'encrypted-access-token',
            refresh_token: 'encrypted-refresh-token',
            expires_at: soonExpiry,
          }),
          run: jest.fn(),
        }),
      };

      (decrypt as jest.Mock).mockImplementation((value: string) => 
        value.replace('encrypted-', '')
      );
      (encrypt as jest.Mock).mockImplementation((value: string) => `encrypted-${value}`);

      const newTokens = {
        access_token: 'new-access-token',
        refresh_token: 'refresh-token',
        expiry_date: Date.now() + 3600000,
      };

      mockOAuth2Client.refreshAccessToken.mockResolvedValue({ 
        credentials: newTokens 
      } as any);

      await service.getValidAccessToken(userId, mockDb);

      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
    });

    it('should throw error when no tokens found', async () => {
      const userId = 1;
      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue(null),
        }),
      };

      await expect(service.getValidAccessToken(userId, mockDb)).rejects.toThrow(
        'Not connected to YouTube. Please authenticate first.'
      );
    });

    it('should delete tokens and throw error on refresh failure', async () => {
      const userId = 1;
      const pastExpiry = Date.now() - 1000;

      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue({
            access_token: 'encrypted-access-token',
            refresh_token: 'encrypted-refresh-token',
            expires_at: pastExpiry,
          }),
          run: jest.fn(),
        }),
      };

      (decrypt as jest.Mock).mockImplementation((value: string) => 
        value.replace('encrypted-', '')
      );

      mockOAuth2Client.refreshAccessToken.mockRejectedValue(
        new Error('Invalid refresh token')
      );

      await expect(service.getValidAccessToken(userId, mockDb)).rejects.toThrow(
        'YouTube session expired. Please reconnect your YouTube account.'
      );

      // Verify tokens were deleted
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM oauth_connections')
      );
      expect(mockDb.prepare().run).toHaveBeenCalledWith(userId, 'youtube');
    });
  });

  describe('getYouTubeClient', () => {
    it('should create authenticated YouTube client', async () => {
      const userId = 1;
      const futureExpiry = Date.now() + 3600000;

      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue({
            access_token: 'encrypted-access-token',
            refresh_token: 'encrypted-refresh-token',
            expires_at: futureExpiry,
          }),
        }),
      };

      (decrypt as jest.Mock).mockImplementation((value: string) => 
        value.replace('encrypted-', '')
      );

      const mockYouTubeClient = { videos: {}, playlists: {} };
      const { google } = require('googleapis');
      google.youtube.mockReturnValue(mockYouTubeClient);

      const client = await service.getYouTubeClient(userId, mockDb);

      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({ 
        access_token: 'access-token' 
      });
      expect(google.youtube).toHaveBeenCalledWith({ 
        version: 'v3', 
        auth: mockOAuth2Client 
      });
      expect(client).toBe(mockYouTubeClient);
    });

    it('should throw error when not configured', async () => {
      const serviceWithoutCreds = Object.create(YouTubeOAuthService.prototype);
      (serviceWithoutCreds as any).isConfigured = false;

      await expect(serviceWithoutCreds.getYouTubeClient(1, {})).rejects.toThrow(
        'YouTube OAuth not configured'
      );
    });
  });

  describe('revokeConnection', () => {
    it('should revoke token and delete from database', async () => {
      const userId = 1;
      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue({
            access_token: 'encrypted-access-token',
            refresh_token: 'encrypted-refresh-token',
            expires_at: Date.now() + 3600000,
          }),
          run: jest.fn(),
        }),
      };

      (decrypt as jest.Mock).mockImplementation((value: string) => 
        value.replace('encrypted-', '')
      );

      mockOAuth2Client.revokeToken.mockResolvedValue({} as any);

      await service.revokeConnection(userId, mockDb);

      expect(mockOAuth2Client.revokeToken).toHaveBeenCalledWith('access-token');
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM oauth_connections')
      );
      expect(mockDb.prepare().run).toHaveBeenCalledWith(userId, 'youtube');
    });

    it('should delete from database even if revocation fails', async () => {
      const userId = 1;
      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue({
            access_token: 'encrypted-access-token',
            refresh_token: 'encrypted-refresh-token',
            expires_at: Date.now() + 3600000,
          }),
          run: jest.fn(),
        }),
      };

      (decrypt as jest.Mock).mockImplementation((value: string) => 
        value.replace('encrypted-', '')
      );

      mockOAuth2Client.revokeToken.mockRejectedValue(new Error('Revocation failed'));

      await service.revokeConnection(userId, mockDb);

      // Should still delete from database
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM oauth_connections')
      );
      expect(mockDb.prepare().run).toHaveBeenCalledWith(userId, 'youtube');
    });

    it('should handle case when no tokens exist', async () => {
      const userId = 1;
      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue(null),
          run: jest.fn(),
        }),
      };

      await service.revokeConnection(userId, mockDb);

      expect(mockOAuth2Client.revokeToken).not.toHaveBeenCalled();
      expect(mockDb.prepare().run).toHaveBeenCalledWith(userId, 'youtube');
    });
  });
});
