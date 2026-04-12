/**
 * YouTube OAuth Service
 * 
 * Manages OAuth 2.0 authentication and token lifecycle for YouTube Data API v3.
 * Handles token storage, refresh, and provides authenticated YouTube API clients.
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { encrypt, decrypt } from '../utils/encryption';
import { logger } from '../utils/logger';

const ENCRYPTION_SECRET = process.env.SESSION_SECRET || 'default-secret-change-in-production';

export interface YouTubeTokens {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

export class YouTubeOAuthService {
  private oauth2Client: OAuth2Client | null = null;
  private isConfigured: boolean = false;
  private initialized: boolean = false;

  constructor() {
    // Don't initialize here - do it lazily when first needed
  }

  private ensureInitialized() {
    if (this.initialized) return;
    
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI;

    // Debug logging
    logger.info('[YouTubeOAuth] Initializing service', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasRedirectUri: !!redirectUri,
      clientIdPreview: clientId?.substring(0, 20),
      allEnvKeys: Object.keys(process.env).filter(k => k.startsWith('YOUTUBE'))
    });

    if (!clientId || !clientSecret || !redirectUri) {
      logger.warn('[YouTubeOAuth] YouTube OAuth credentials not configured. YouTube export feature will not be available.');
      this.isConfigured = false;
      this.oauth2Client = new google.auth.OAuth2('', '', '');
    } else {
      this.isConfigured = true;
      this.oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
      );
      logger.info('[YouTubeOAuth] YouTube OAuth service initialized successfully');
    }
    
    this.initialized = true;
  }

  /**
   * Check if YouTube OAuth is properly configured
   */
  isReady(): boolean {
    this.ensureInitialized();
    return this.isConfigured;
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthUrl(state: string): string {
    this.ensureInitialized();
    if (!this.isConfigured || !this.oauth2Client) {
      throw new Error('YouTube OAuth not configured. Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REDIRECT_URI in .env');
    }

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Request refresh token
      scope: ['https://www.googleapis.com/auth/youtube.force-ssl'],
      state,
      prompt: 'consent', // Force consent screen to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string): Promise<YouTubeTokens> {
    this.ensureInitialized();
    if (!this.isConfigured || !this.oauth2Client) {
      throw new Error('YouTube OAuth not configured');
    }

    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      if (!tokens.access_token) {
        throw new Error('No access token received from Google');
      }

      logger.info('[YouTubeOAuth] Successfully exchanged authorization code for tokens', {
        hasRefreshToken: !!tokens.refresh_token,
        expiresAt: tokens.expiry_date
      });

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || undefined,
        expires_at: tokens.expiry_date || undefined,
      };
    } catch (err: any) {
      logger.error('[YouTubeOAuth] Failed to exchange authorization code', { error: err.message });
      throw new Error(`Failed to exchange authorization code: ${err.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<YouTubeTokens> {
    this.ensureInitialized();
    if (!this.isConfigured || !this.oauth2Client) {
      throw new Error('YouTube OAuth not configured');
    }

    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error('Failed to refresh access token - no token returned');
      }

      logger.info('[YouTubeOAuth] Successfully refreshed access token', {
        expiresAt: credentials.expiry_date
      });

      return {
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || refreshToken, // Keep old if not provided
        expires_at: credentials.expiry_date || undefined,
      };
    } catch (err: any) {
      logger.error('[YouTubeOAuth] Failed to refresh access token', { error: err.message });
      throw new Error(`Failed to refresh access token: ${err.message}`);
    }
  }

  /**
   * Store tokens in database (encrypted)
   */
  async storeTokens(userId: number, tokens: YouTubeTokens, db: any): Promise<void> {
    const now = Date.now();
    const encryptedAccess = encrypt(tokens.access_token, ENCRYPTION_SECRET);
    const encryptedRefresh = tokens.refresh_token 
      ? encrypt(tokens.refresh_token, ENCRYPTION_SECRET) 
      : null;

    try {
      db.prepare(`
        INSERT INTO oauth_connections (user_id, service, access_token, refresh_token, token_expires_at, expires_at, created_at, updated_at)
        VALUES (?, 'youtube', ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, service) DO UPDATE SET 
          access_token = excluded.access_token,
          refresh_token = excluded.refresh_token,
          token_expires_at = excluded.token_expires_at,
          expires_at = excluded.expires_at,
          updated_at = excluded.updated_at
      `).run(userId, encryptedAccess, encryptedRefresh, tokens.expires_at, tokens.expires_at, now, now);

      logger.info('[YouTubeOAuth] Tokens stored successfully', { 
        userId, 
        hasRefreshToken: !!tokens.refresh_token,
        expiresAt: tokens.expires_at
      });
    } catch (err: any) {
      logger.error('[YouTubeOAuth] Failed to store tokens', { userId, error: err.message });
      throw new Error(`Failed to store tokens: ${err.message}`);
    }
  }

  /**
   * Get tokens from database (decrypted)
   */
  async getTokens(userId: number, db: any): Promise<YouTubeTokens | null> {
    try {
      const row = db.prepare(
        'SELECT access_token, refresh_token, token_expires_at, expires_at FROM oauth_connections WHERE user_id = ? AND service = ?'
      ).get(userId, 'youtube') as any;

      if (!row) {
        return null;
      }

      const expiresAt = row.expires_at || row.token_expires_at;

      return {
        access_token: decrypt(row.access_token, ENCRYPTION_SECRET),
        refresh_token: row.refresh_token ? decrypt(row.refresh_token, ENCRYPTION_SECRET) : undefined,
        expires_at: expiresAt || undefined,
      };
    } catch (err: any) {
      logger.error('[YouTubeOAuth] Failed to get/decrypt tokens', { userId, error: err.message });
      return null;
    }
  }

  /**
   * Get valid access token (auto-refresh if expired)
   */
  async getValidAccessToken(userId: number, db: any): Promise<string> {
    const tokens = await this.getTokens(userId, db);
    if (!tokens) {
      throw new Error('Not connected to YouTube. Please authenticate first.');
    }

    // Check if token is expired or about to expire (5 min buffer)
    const now = Date.now();
    const expiryBuffer = 5 * 60 * 1000; // 5 minutes
    const isExpired = tokens.expires_at && tokens.expires_at < (now + expiryBuffer);

    if (isExpired && tokens.refresh_token) {
      logger.info('[YouTubeOAuth] Token expired or expiring soon, refreshing', { 
        userId,
        expiresAt: tokens.expires_at,
        now
      });
      
      try {
        const newTokens = await this.refreshAccessToken(tokens.refresh_token);
        await this.storeTokens(userId, newTokens, db);
        return newTokens.access_token;
      } catch (err: any) {
        logger.error('[YouTubeOAuth] Token refresh failed, deleting stored tokens', { userId, error: err.message });
        // Delete invalid tokens
        db.prepare('DELETE FROM oauth_connections WHERE user_id = ? AND service = ?').run(userId, 'youtube');
        throw new Error('YouTube session expired. Please reconnect your YouTube account.');
      }
    }

    return tokens.access_token;
  }

  /**
   * Create authenticated YouTube API client
   */
  async getYouTubeClient(userId: number, db: any) {
    this.ensureInitialized();
    if (!this.isConfigured || !this.oauth2Client) {
      throw new Error('YouTube OAuth not configured');
    }

    const accessToken = await this.getValidAccessToken(userId, db);
    this.oauth2Client.setCredentials({ access_token: accessToken });
    return google.youtube({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Revoke tokens and delete from database
   */
  async revokeConnection(userId: number, db: any): Promise<void> {
    const tokens = await this.getTokens(userId, db);
    
    if (tokens?.access_token && this.isConfigured && this.oauth2Client) {
      try {
        await this.oauth2Client.revokeToken(tokens.access_token);
        logger.info('[YouTubeOAuth] Token revoked successfully', { userId });
      } catch (err: any) {
        logger.warn('[YouTubeOAuth] Token revocation failed (may already be invalid)', { userId, error: err.message });
      }
    }
    
    db.prepare('DELETE FROM oauth_connections WHERE user_id = ? AND service = ?').run(userId, 'youtube');
    logger.info('[YouTubeOAuth] Connection removed from database', { userId });
  }
}

// Singleton instance
export const youtubeOAuthService = new YouTubeOAuthService();
