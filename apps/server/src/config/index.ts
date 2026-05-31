/**
 * Configuration Service
 * 
 * Centralized configuration management for server settings,
 * including public URL configuration for OAuth redirects and reverse proxy support.
 * 
 * Settings persist to server.conf.json in the application data directory.
 * Environment variables take priority over persisted settings.
 */

import { Request } from 'express';
import * as path from 'path';
import * as fs from 'fs';
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

/** Shape of the persisted config file (only user-changeable fields) */
interface PersistedConfig {
  publicUrl?: string;
  oauthRedirectBase?: string;
}

class ConfigService {
  private _config: ServerConfig;
  private _configFilePath: string;

  constructor() {
    // Config file lives next to the database in the application data directory
    const dbPath = process.env.DATABASE_PATH || process.env.DB_PATH || path.join(process.cwd(), 'data', 'playlist-lab.db');
    this._configFilePath = path.join(path.dirname(dbPath), 'server.conf.json');

    // 1. Load persisted settings from file (if present)
    const persisted = this._loadFromFile();

    // 2. Build config with priority: env vars > config file > defaults
    const defaultUrl = 'http://127.0.0.1:3001';
    const publicUrl = process.env.PUBLIC_URL || persisted.publicUrl || defaultUrl;
    const oauthRedirectBase = process.env.OAUTH_REDIRECT_BASE || persisted.oauthRedirectBase || process.env.PUBLIC_URL || persisted.publicUrl || defaultUrl;

    this._config = {
      publicUrl,
      oauthRedirectBase,
      port: parseInt(process.env.PORT || '3001', 10),
      host: process.env.HOST || '0.0.0.0',
      trustProxy: process.env.TRUST_PROXY === 'true',
    };

    logger.info('[Config] Configuration initialized', {
      publicUrl: this._config.publicUrl,
      oauthRedirectBase: this._config.oauthRedirectBase,
      trustProxy: this._config.trustProxy,
      configFile: this._configFilePath,
      fromFile: !!persisted.publicUrl,
    });
  }

  /** Path to the persisted config file (for diagnostics) */
  get configFilePath(): string {
    return this._configFilePath;
  }

  /**
   * Load persisted settings from server.conf.json
   */
  private _loadFromFile(): PersistedConfig {
    try {
      if (fs.existsSync(this._configFilePath)) {
        const raw = fs.readFileSync(this._configFilePath, 'utf-8');
        const data = JSON.parse(raw) as PersistedConfig;
        logger.info('[Config] Loaded persisted config', { file: this._configFilePath });
        return data;
      }
    } catch (err) {
      logger.warn('[Config] Failed to load config file, using defaults', {
        file: this._configFilePath,
        error: err instanceof Error ? err.message : err,
      });
    }
    return {};
  }

  /**
   * Save user-changeable settings to server.conf.json
   */
  private _saveToFile(): void {
    try {
      const data: PersistedConfig = {
        publicUrl: this._config.publicUrl,
        oauthRedirectBase: this._config.oauthRedirectBase,
      };
      const dir = path.dirname(this._configFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this._configFilePath, JSON.stringify(data, null, 2), 'utf-8');
      logger.info('[Config] Persisted config to file', { file: this._configFilePath });
    } catch (err) {
      logger.error('[Config] Failed to save config file', {
        file: this._configFilePath,
        error: err instanceof Error ? err.message : err,
      });
    }
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
   * Update configuration and persist to disk.
   * Environment variables still take priority on next startup.
   * @param updates Partial configuration updates
   */
  updateConfig(updates: Partial<ServerConfig>): void {
    this._config = { ...this._config, ...updates };
    this._saveToFile();
    
    logger.info('[Config] Configuration updated and persisted', {
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
