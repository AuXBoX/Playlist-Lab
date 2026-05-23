/**
 * Configuration Service
 * 
 * Centralized configuration management for server settings,
 * including public URL configuration for OAuth redirects and reverse proxy support.
 */

import { Request } from 'express';
import { logger } from '../utils/logger';

export interface ServerConfig {
  /** Public-facing URL for OAuth redirects and absolute URLs */
  publicUrl: string;
  /** OAuth-specific redirect base URL (defaults to publicUrl) */
  oauthRedirectBase: string;
  /** Server port */
  port: number;
  /** Server host */
  host: string;
  /** Whether server is behind a reverse proxy */
  trustProxy: boolean;
}

class ConfigService {
  private _config: ServerConfig;

  constructor() {
    this._config = {
      publicUrl: process.env.PUBLIC_URL || 'http://127.0.0.1:3001',
      oauthRedirectBase: process.env.OAUTH_REDIRECT_BASE || process.env.PUBLIC_URL || 'http://127.0.0.1:3001',
      port: parseInt(process.env.PORT || '3001', 10),
      host: process.env.HOST || '0.0.0.0',
      trustProxy: process.env.TRUST_PROXY === 'true',
    };

    logger.info('[Config] Configuration initialized', {
      publicUrl: this._config.publicUrl,
      oauthRedirectBase: this._config.oauthRedirectBase,
      trustProxy: this._config.trustProxy,
    });
  }

  /**
   * Get current configuration
   */
  get config(): Readonly<ServerConfig> {
    return this._config;
  }

  /**
   * Get OAuth redirect URL for a specific service
   * @param service Service identifier (e.g., 'spotify', 'youtube')
   * @param path Optional path override (defaults to /api/{service}/callback)
   */
  getOAuthRedirectUrl(service: string, path?: string): string {
    const basePath = path || `/api/${service}/callback`;
    const url = `${this._config.oauthRedirectBase}${basePath}`;
    
    logger.debug('[Config] Generated OAuth redirect URL', { service, url });
    return url;
  }

  /**
   * Get public URL from request headers (for reverse proxy auto-detection)
   * User-configured PUBLIC_URL takes precedence over auto-detection
   * @param req Express request object
   */
  getPublicUrlFromRequest(req: Request): string {
    // User config takes precedence
    if (this._config.publicUrl !== 'http://127.0.0.1:3001') {
      return this._config.publicUrl;
    }

    // Auto-detect from reverse proxy headers
    if (this._config.trustProxy) {
      const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
      const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
      
      if (req.headers['x-forwarded-host']) {
        const detectedUrl = `${proto}://${host}`;
        logger.debug('[Config] Auto-detected public URL from headers', { detectedUrl });
        return detectedUrl;
      }
    }

    // Fallback to configured URL
    return this._config.publicUrl;
  }

  /**
   * Update configuration (runtime update)
   * Note: This does not persist to .env file
   * @param updates Partial configuration updates
   */
  updateConfig(updates: Partial<ServerConfig>): void {
    this._config = { ...this._config, ...updates };
    
    logger.info('[Config] Configuration updated', {
      publicUrl: this._config.publicUrl,
      oauthRedirectBase: this._config.oauthRedirectBase,
    });
  }

  /**
   * Get all OAuth redirect URLs for display in settings
   */
  getAllOAuthRedirectUrls(): Record<string, string> {
    return {
      spotify: this.getOAuthRedirectUrl('spotify'),
      youtube: this.getOAuthRedirectUrl('cross-import/oauth/youtube', '/api/cross-import/oauth/youtube/callback'),
    };
  }
}

// Singleton instance
export const configService = new ConfigService();

// Export config for convenience
export const config = configService.config;
