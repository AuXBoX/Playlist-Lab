import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Load environment variables FIRST before any other imports
// In production (installed), always use AppData location
// In development, use current working directory
const isProduction = process.cwd().includes('Program Files') || process.cwd().includes('Program Files (x86)');
const appDataEnvPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Playlist Lab', '.env');

let envPath: string | null = null;

if (isProduction) {
  // Production: Only use AppData location
  envPath = appDataEnvPath;
  console.log('[Startup] Production mode detected');
  console.log('[Startup] .env file path:', envPath);
  console.log('[Startup] .env file exists:', fs.existsSync(envPath));
} else {
  // Development: Try multiple locations
  const possibleEnvPaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '..', '.env'),
    appDataEnvPath,
  ];
  
  for (const testPath of possibleEnvPaths) {
    if (fs.existsSync(testPath)) {
      envPath = testPath;
      break;
    }
  }
  console.log('[Startup] Development mode detected');
  console.log('[Startup] .env file path:', envPath || 'not found');
}

if (envPath && fs.existsSync(envPath)) {
  console.log('[Startup] Loading .env from:', envPath);
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.error('[Startup] Error loading .env:', result.error);
  } else {
    console.log('[Startup] .env loaded successfully');
    console.log('[Startup] YOUTUBE_CLIENT_ID:', process.env.YOUTUBE_CLIENT_ID?.substring(0, 20) + '...');
  }
} else {
  console.log('[Startup] No .env file found at:', envPath || 'unknown');
  console.log('[Startup] This is normal if you haven\'t configured any API keys yet');
}

// NOW import adapters after env vars are loaded
import './adapters'; // Register all source/target adapters

import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
// Force reload
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import https from 'https';
import { logger } from './utils/logger';
import { sessionStore } from './middleware/session-store';
import { errorHandler } from './middleware/error-handler';
import { attachDatabase } from './middleware/auth';
import { DatabaseService, getDatabase } from './database';
import { JobScheduler } from './services/jobs';
import { importQueue } from './services/import-queue';
import { importPlaylist, ImportOptions } from './services/import';
import { EventEmitter } from 'events';
import { runDailyScraperJob } from './services/scraper-job';
import { runScheduleCheckerJob } from './services/schedule-checker-job';
import { runCacheCleanupJob } from './services/cache-cleanup-job';
import authRoutes from './routes/auth';
import serversRoutes from './routes/servers';
import settingsRoutes from './routes/settings';
import playlistsRoutes from './routes/playlists';
import missingRoutes from './routes/missing';
import adminRoutes from './routes/admin';
import migrateRoutes from './routes/migrate';
import importRoutes from './routes/import';
import mixesRoutes from './routes/mixes';
import schedulesRoutes from './routes/schedules';
import proxyRoutes from './routes/proxy';
import searchRoutes from './routes/search';
import aiRoutes from './routes/ai';
import spotifyAuthRoutes from './routes/spotify-auth';
import chartsRoutes from './routes/charts';
import plexSharingRoutes from './routes/plex-sharing';
import crossImportRoutes from './routes/cross-import';
import mixTemplatesRoutes from './routes/mix-templates';
import youtubeConfigRoutes from './routes/youtube-config';
import savedSpotifyUsersRoutes from './routes/saved-spotify-users';
import favoritePlaylistsRoutes from './routes/favorite-playlists';
import plexHomeRoutes from './routes/plex-home';
import exportRoutes from './routes/export';
import configRoutes from './routes/config';
// DON'T import adapters here - they need env vars loaded first

// Read version from package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const APP_VERSION = packageJson.version;

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize database
const db = getDatabase();
const dbService = new DatabaseService(db);

// Security middleware
// Disable CSP in production when HTTPS is not enabled to avoid upgrade-insecure-requests issues
app.use(helmet({
  contentSecurityPolicy: (NODE_ENV === 'production' && process.env.ENABLE_HTTPS === 'true') ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  } : false,
}));

// CORS configuration
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: corsOrigin === '*' ? true : corsOrigin.split(',').map(o => o.trim()),
  credentials: true,
}));

// Compression middleware - skip SSE endpoints (compression buffers responses)
app.use(compression({
  filter: (req, res) => {
    if (req.url?.includes('/import/progress/')) return false;
    return compression.filter(req, res);
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '15000', 10), // 15000 requests per window
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later', statusCode: 429 } },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in development mode
    if (process.env.NODE_ENV === 'development') return true;
    // Skip health checks, schedule polling, and queue polling (internal noise)
    if (req.path === '/health' || req.path === '/api/schedules/executions/running') return true;
    if (req.path === '/api/import/queue' || req.path.startsWith('/api/import/status/') || req.path.startsWith('/api/import/progress/')) return true;
    return false;
  }
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session middleware
const trustProxy = process.env.TRUST_PROXY === 'true';
if (trustProxy) {
  app.set('trust proxy', 1);
}

// Determine if we should use secure cookies
// Only use secure cookies if explicitly enabled or HTTPS is actually enabled
// Don't default to secure in production if using HTTP
const useSecureCookies = process.env.COOKIE_SECURE === 'true' || 
  (process.env.ENABLE_HTTPS === 'true' && NODE_ENV === 'production');

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: 'playlist-lab.sid',
  cookie: {
    httpOnly: true,
    secure: useSecureCookies,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: 'lax',
    path: '/',
    domain: undefined, // Let browser handle domain (works for localhost)
  },
}));

// Attach database service to all requests
app.use(attachDatabase(dbService));

// Debug middleware to log session info
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api/auth')) {
    console.log(`[Session Debug] ${req.method} ${req.path}`);
    console.log(`[Session Debug] Cookie header: ${req.headers.cookie || 'none'}`);
    console.log(`[Session Debug] Session ID: ${req.sessionID || 'none'}`);
    console.log(`[Session Debug] Session data:`, req.session);
  }
  next();
});

// Request logging middleware (skip noisy polling endpoints)
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (!req.path.includes('/import/status/') && 
      !req.path.includes('/import/progress/') && 
      !req.path.includes('/import/queue')) {
    logger.info(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  }
  next();
});

// Root endpoint for development
app.get('/', (_req: Request, res: Response, next: NextFunction): void => {
  if (NODE_ENV === 'development') {
    // Send HTML page with instructions
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Playlist Lab API Server</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      max-width: 800px;
      margin: 50px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      margin-top: 0;
    }
    .status {
      display: inline-block;
      padding: 4px 12px;
      background: #4caf50;
      color: white;
      border-radius: 4px;
      font-size: 14px;
      margin-left: 10px;
    }
    .info-box {
      background: #e3f2fd;
      border-left: 4px solid #2196f3;
      padding: 15px;
      margin: 20px 0;
    }
    .warning-box {
      background: #fff3e0;
      border-left: 4px solid #ff9800;
      padding: 15px;
      margin: 20px 0;
    }
    code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
    }
    .command {
      background: #263238;
      color: #aed581;
      padding: 12px;
      border-radius: 4px;
      margin: 10px 0;
      font-family: 'Courier New', monospace;
    }
    a {
      color: #2196f3;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    ul {
      line-height: 1.8;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>
      Playlist Lab API Server
      <span class="status">Running</span>
    </h1>
    
    <div class="warning-box">
      <strong>⚠️ Development Mode</strong>
      <p>The API server is running in development mode. To use the web interface, you need to start the web app separately.</p>
    </div>
    
    <div class="info-box">
      <strong>🚀 Quick Start</strong>
      <p>Open a new terminal and run:</p>
      <div class="command">cd apps/web && npm run dev</div>
      <p>Then open: <a href="http://localhost:5173" target="_blank"><strong>http://localhost:5173</strong></a></p>
    </div>
    
    <h2>Server Information</h2>
    <ul>
      <li><strong>Environment:</strong> ${NODE_ENV}</li>
      <li><strong>Port:</strong> ${PORT}</li>
      <li><strong>API Base:</strong> <a href="/api/health">/api/*</a></li>
      <li><strong>Health Check:</strong> <a href="/api/health">/api/health</a></li>
    </ul>
    
    <h2>Available Endpoints</h2>
    <ul>
      <li><code>GET /api/health</code> - Server health status</li>
      <li><code>POST /api/auth/login</code> - User authentication</li>
      <li><code>GET /api/playlists</code> - List playlists</li>
      <li><code>GET /api/servers</code> - Plex servers</li>
      <li><code>POST /api/import</code> - Import playlists</li>
      <li><code>POST /api/mixes</code> - Generate mixes</li>
      <li><code>GET /api/schedules</code> - Scheduled tasks</li>
    </ul>
    
    <h2>Production Mode</h2>
    <p>To run in production mode (serves the built web app):</p>
    <ol>
      <li>Build the web app: <code>cd apps/web && npm run build</code></li>
      <li>Set <code>NODE_ENV=production</code> in your environment</li>
      <li>Restart the server</li>
    </ol>
  </div>
</body>
</html>
    `);
  } else {
    // In production, pass to the SPA handler below
    next();
  }
});

// Health check endpoint (both /health and /api/health for compatibility)
app.get('/health', (_req: Request, res: Response) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    environment: NODE_ENV,
    version: APP_VERSION,
    uptime: Math.floor(uptime),
    uptimeFormatted: formatUptime(uptime),
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
    },
    port: PORT,
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    environment: NODE_ENV,
    version: APP_VERSION,
    uptime: Math.floor(uptime),
    uptimeFormatted: formatUptime(uptime),
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
    },
    port: PORT,
  });
});

// Simple version endpoint
app.get('/api/version', (_req: Request, res: Response) => {
  res.json({ version: APP_VERSION });
});

// Debug endpoint to check job status
app.get('/api/debug/jobs', (_req: Request, res: Response) => {
  const jobsEnabled = NODE_ENV === 'production' || process.env.ENABLE_JOBS === 'true';
  res.json({
    nodeEnv: NODE_ENV,
    enableJobsEnv: process.env.ENABLE_JOBS,
    jobsEnabled,
    jobsRunning: jobsEnabled,
    scheduleCheckerEnabled: process.env.ENABLE_SCHEDULE_CHECKER !== 'false',
  });
});

// Check for updates endpoint
app.get('/api/update/check', async (_req: Request, res: Response): Promise<void> => {
  try {
    const https = require('https');
    const GITHUB_REPO = 'AuXBoX/Playlist-Lab';
    
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO}/releases/latest`,
      method: 'GET',
      headers: {
        'User-Agent': 'Playlist-Lab-Server',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const request = https.request(options, (response: any): void => {
      let data = '';
      
      response.on('data', (chunk: any): void => {
        data += chunk;
      });
      
      response.on('end', (): void => {
        if (res.headersSent) return; // Guard against multiple responses
        
        if (response.statusCode === 200) {
          try {
            const release = JSON.parse(data);
            const latestVersion = release.tag_name.replace(/^v/, '');
            const currentVersion = APP_VERSION;
            
            // Compare versions
            const isNewer = isNewerVersion(latestVersion, currentVersion);
            
            // Find Windows installer
            const windowsInstaller = release.assets?.find((asset: any) => 
              asset.name.includes('Setup') && asset.name.endsWith('.exe')
            );
            
            res.json({
              updateAvailable: isNewer,
              currentVersion,
              latestVersion,
              releaseNotes: release.body,
              downloadUrl: windowsInstaller?.browser_download_url || null,
              releaseUrl: release.html_url,
              publishedAt: release.published_at
            });
          } catch (err) {
            res.status(500).json({ error: 'Failed to parse release data' });
          }
        } else {
          res.status(response.statusCode).json({ error: 'Failed to fetch release info' });
        }
      });
    });

    request.on('error', (err: Error): void => {
      if (res.headersSent) return; // Guard against multiple responses
      console.error('[Update Check] Request error:', err.message);
      res.status(500).json({ error: 'Network error: ' + err.message });
    });

    request.setTimeout(30000, (): void => {
      console.error('[Update Check] Request timeout after 30 seconds');
      request.destroy();
      if (res.headersSent) return; // Guard against multiple responses
      res.status(504).json({ error: 'Update check timed out. Please check your internet connection.' });
    });

    request.end();
  } catch (error) {
    if (res.headersSent) return; // Guard against multiple responses
    res.status(500).json({ error: 'Failed to check for updates' });
  }
});

// Trigger update endpoint
app.post('/api/update/install', async (_req: Request, res: Response): Promise<void> => {
  logger.info('[Update] Install request received');
  try {
    const https = require('https');
    const fs = require('fs');
    const path = require('path');
    const { spawn } = require('child_process');
    const os = require('os');
    
    const GITHUB_REPO = 'AuXBoX/Playlist-Lab';
    
    // Get latest release
    logger.info('[Update] Fetching latest release from GitHub');
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO}/releases/latest`,
      method: 'GET',
      headers: {
        'User-Agent': 'Playlist-Lab-Server',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const request = https.request(options, (response: any): void => {
      let data = '';
      
      response.on('data', (chunk: any): void => {
        data += chunk;
      });
      
      response.on('end', (): void => {
        if (response.statusCode === 200) {
          try {
            const release = JSON.parse(data);
            const windowsInstaller = release.assets?.find((asset: any) => 
              asset.name.includes('Setup') && asset.name.endsWith('.exe')
            );
            
            if (!windowsInstaller) {
              logger.error('[Update] No installer found in release assets');
              res.status(404).json({ error: 'No installer found for this platform' });
              return;
            }
            
            logger.info(`[Update] Found installer: ${windowsInstaller.name}`);
            
            // Download installer
            const dataDir = os.platform() === 'win32' 
              ? path.join(process.env.APPDATA || os.homedir(), 'Playlist Lab')
              : path.join(os.homedir(), '.local', 'share', 'playlist-lab');
            
            fs.mkdirSync(dataDir, { recursive: true });
            
            const installerPath = path.join(dataDir, `PlaylistLabServer-Setup-${release.tag_name}.exe`);
            logger.info(`[Update] Downloading installer to: ${installerPath}`);
            const file = fs.createWriteStream(installerPath);
            
            https.get(windowsInstaller.browser_download_url, (downloadResponse: any): void => {
              // Handle redirects
              if (downloadResponse.statusCode === 302 || downloadResponse.statusCode === 301) {
                https.get(downloadResponse.headers.location, (redirectResponse: any): void => {
                  redirectResponse.pipe(file);
                  
                  file.on('finish', (): void => {
                    file.close();
                    logger.info('[Update] Download complete (redirect), launching installer...');
                    
                    // Send response FIRST before launching installer
                    res.json({ 
                      success: true, 
                      message: 'Update installer launched. The application will restart automatically.' 
                    });
                    
                    // Wait for response to be sent, then shut down and launch installer
                    res.on('finish', (): void => {
                      const logPath = path.join(dataDir, 'update-install.log');
                      logger.info('[Update] Response sent, shutting down server before launching installer...');
                      
                      // Close HTTP server first to stop accepting new connections
                      server.close(() => {
                        logger.info('[Update] HTTP server closed');
                      });
                      
                      // Stop job scheduler
                      jobScheduler.stop().then(() => {
                        logger.info('[Update] Job scheduler stopped');
                      }).catch(() => {});
                      
                      // Close HTTPS server if running
                      if (httpsServer) {
                        httpsServer.close(() => {
                          logger.info('[Update] HTTPS server closed');
                        });
                      }
                      
                      // Wait for connections to drain, then spawn installer
                      setTimeout((): void => {
                        logger.info(`[Update] Spawning installer (redirect path): ${installerPath}`);
                        
                        const installer = spawn(installerPath, ['/SILENT', '/SUPPRESSMSGBOXES', '/NORESTART', `/LOG=${logPath}`], {
                          detached: true,
                          stdio: 'ignore'
                        });
                        
                        installer.on('error', (err: Error): void => {
                          logger.error(`[Update] Installer spawn error: ${err.message}`);
                        });
                        
                        installer.unref();
                        logger.info('[Update] Installer spawned, exiting in 1 second...');
                        
                        setTimeout((): void => {
                          logger.info('[Update] Exiting server process');
                          process.exit(0);
                        }, 1000);
                      }, 1500);
                    });
                  });
                });
                return;
              }
              
              downloadResponse.pipe(file);
              
              file.on('finish', (): void => {
                file.close();
                logger.info('[Update] Download complete, launching installer...');
                
                // Send response FIRST before launching installer
                res.json({ 
                  success: true, 
                  message: 'Update installer launched. The application will restart automatically.' 
                });
                
                // Wait for response to be sent, then shut down and launch installer
                res.on('finish', (): void => {
                  const logPath = path.join(dataDir, 'update-install.log');
                  logger.info('[Update] Response sent, shutting down server before launching installer...');
                  
                  // Close HTTP server first to stop accepting new connections
                  server.close(() => {
                    logger.info('[Update] HTTP server closed');
                  });
                  
                  // Stop job scheduler
                  jobScheduler.stop().then(() => {
                    logger.info('[Update] Job scheduler stopped');
                  }).catch(() => {});
                  
                  // Close HTTPS server if running
                  if (httpsServer) {
                    httpsServer.close(() => {
                      logger.info('[Update] HTTPS server closed');
                    });
                  }
                  
                  // Wait for connections to drain, then spawn installer
                  setTimeout((): void => {
                    logger.info(`[Update] Spawning installer: ${installerPath}`);
                    
                    const installer = spawn(installerPath, ['/SILENT', '/SUPPRESSMSGBOXES', '/NORESTART', `/LOG=${logPath}`], {
                      detached: true,
                      stdio: 'ignore'
                    });
                    
                    installer.on('error', (err: Error): void => {
                      logger.error(`[Update] Installer spawn error: ${err.message}`);
                    });
                    
                    installer.unref();
                    logger.info('[Update] Installer spawned, exiting in 1 second...');
                    
                    setTimeout((): void => {
                      logger.info('[Update] Exiting server process');
                      process.exit(0);
                    }, 1000);
                  }, 1500);
                });
              });
              
              file.on('error', (err: Error): void => {
                logger.error(`[Update] File write error: ${err.message}`);
                if (!res.headersSent) {
                  res.status(500).json({ error: `Failed to save installer: ${err.message}` });
                }
              });
            });
            return; // Explicit return after async operation
          } catch (err) {
            logger.error(`[Update] Parse error: ${err instanceof Error ? err.message : 'Unknown'}`);
            res.status(500).json({ error: 'Failed to process update' });
            return;
          }
        } else {
          logger.error(`[Update] GitHub API returned status: ${response.statusCode}`);
          res.status(response.statusCode).json({ error: 'Failed to fetch release info' });
          return;
        }
      });
    });

    request.on('error', (err: Error): void => {
      logger.error(`[Update] Request error: ${err.message}`);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    });

    request.end();
  } catch (error) {
    res.status(500).json({ error: 'Failed to install update' });
  }
});

// Helper function to compare versions
function isNewerVersion(latest: string, current: string): boolean {
  const latestParts = latest.split('.').map(Number);
  const currentParts = current.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const l = latestParts[i] || 0;
    const c = currentParts[i] || 0;
    
    if (l > c) return true;
    if (l < c) return false;
  }

  return false; // Versions are equal
}

// Helper function to format uptime
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/servers', serversRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/playlists', playlistsRoutes);
app.use('/api/playlists', exportRoutes); // Export routes under /api/playlists/export
app.use('/api/missing', missingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/migrate', migrateRoutes);
app.use('/api/import', importRoutes);
app.use('/api/import', aiRoutes); // AI generation under /api/import/ai
app.use('/api/mixes', mixesRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/spotify', spotifyAuthRoutes);
app.use('/api/charts', chartsRoutes);
app.use('/api/plex', plexSharingRoutes);
app.use('/api/cross-import', crossImportRoutes);
app.use('/api/mix-templates', mixTemplatesRoutes);
app.use('/api/youtube-config', youtubeConfigRoutes);
app.use('/api/saved-spotify-users', savedSpotifyUsersRoutes);
app.use('/api/favorite-playlists', favoritePlaylistsRoutes);
app.use('/api/plex-home', plexHomeRoutes);

// Serve static files from the web app (in production)
if (NODE_ENV === 'production') {
  // Use WEB_APP_PATH environment variable if set, otherwise use relative path
  const webAppPath = process.env.WEB_APP_PATH || path.join(__dirname, '..', '..', 'web', 'dist');
  logger.info(`Serving static files from: ${webAppPath}`);
  
  // Check if the path exists
  const fs = require('fs');
  if (!fs.existsSync(webAppPath)) {
    logger.error(`Web app path does not exist: ${webAppPath}`);
    logger.error(`Current directory: ${__dirname}`);
    logger.error(`Tried paths: ${webAppPath}`);
  } else {
    logger.info(`Web app path exists, serving static files`);
    
    // Serve static assets (JS, CSS, images) - these have content-hashed filenames from Vite
    // so they can be cached long-term. index.html is handled separately below.
    app.use(express.static(webAppPath, {
      // Don't serve index.html from static middleware - we handle it with no-cache below
      index: false,
    }));
    
    // Serve index.html with no-cache headers for all non-API routes (SPA fallback)
    // This ensures the browser always gets the latest HTML which references the new hashed assets
    app.get('*', (req: Request, res: Response, next: NextFunction): void => {
      // Skip API routes
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      const indexPath = path.join(webAppPath, 'index.html');
      logger.info(`Serving index.html for path: ${req.path}`);
      // Prevent caching so browser always loads the latest app version after updates
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.sendFile(indexPath);
    });
  }
}

// 404 handler for API routes
app.use('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
      statusCode: 404,
    },
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize import queue handler
// Store active import sessions for progress tracking
const importSessions = new Map<string, EventEmitter>();
const cancelledSessions = new Set<string>();
const progressState = new Map<string, any>();

// Initialize import queue with database
importQueue.initialize(db);

importQueue.setHandler(async (job) => {
  logger.info('Import queue processing job', {
    jobId: job.id,
    userId: job.userId,
    source: job.source,
  });

  // Get user's database and server info
  const userRow = (dbService as any).db.prepare('SELECT plex_token FROM users WHERE id = ?').get(job.userId);
  if (!userRow) {
    throw new Error('User not found');
  }

  const { plex_token: plexToken } = userRow;
  const serverRow = (dbService as any).db.prepare('SELECT server_url, library_id FROM user_servers WHERE user_id = ? LIMIT 1').get(job.userId);
  if (!serverRow) {
    throw new Error('No Plex server configured');
  }

  const { server_url: serverUrl, library_id: libraryId } = serverRow;

  const options: ImportOptions = {
    userId: job.userId,
    serverUrl,
    plexToken,
    libraryId,
    customName: job.playlistName,
  };

  // Get or create progress emitter
  let progressEmitter = importSessions.get(job.sessionId);
  if (!progressEmitter) {
    progressEmitter = new EventEmitter();
    importSessions.set(job.sessionId, progressEmitter);
    
    // Listen for playlist name and progress from progress updates
    progressEmitter.on('progress', (data: any) => {
      progressState.set(job.sessionId, data);
      // Update job with playlist name if we get it
      if (data.playlistName && !job.playlistName) {
        job.playlistName = data.playlistName;
        // Update database with playlist name
        (dbService as any).db.prepare(`
          UPDATE import_queue 
          SET playlist_name = ?
          WHERE session_id = ?
        `).run(data.playlistName, job.sessionId);
      }
      // Update progress in database
      if (data.current !== undefined && data.total !== undefined) {
        (dbService as any).db.prepare(`
          UPDATE import_queue 
          SET progress = ?, total = ?
          WHERE session_id = ?
        `).run(data.current, data.total, job.sessionId);
      }
    });
    progressEmitter.on('complete', (data: any) => {
      progressState.set(job.sessionId, { type: 'complete', ...data });
    });
    progressEmitter.on('error', (data: any) => {
      progressState.set(job.sessionId, { type: 'error', ...data });
    });
  }

  // Run the import
  try {
    const result = await importPlaylist(
      job.source as any,
      job.url,
      options,
      dbService,
      progressEmitter,
      job.sessionId,
      cancelledSessions
    );

    // Update job with final playlist name
    if (result.playlistName && !job.playlistName) {
      job.playlistName = result.playlistName;
    }

    progressEmitter.emit('complete', result);
    
    // Cleanup after a delay
    setTimeout(() => {
      importSessions.delete(job.sessionId);
      progressState.delete(job.sessionId);
      cancelledSessions.delete(job.sessionId);
    }, 60000); // Keep for 1 minute after completion
    
    // Return result so it can be stored in completed jobs
    return result;
  } catch (error: any) {
    progressEmitter.emit('error', { message: error.message || 'Import failed' });
    throw error;
  }
});

// Initialize job scheduler
const jobScheduler = new JobScheduler(dbService);

// Register background jobs
jobScheduler.registerJob({
  name: 'daily-scraper',
  schedule: process.env.SCRAPER_SCHEDULE || '0 2 * * *', // 2:00 AM daily
  handler: async () => {
    await runDailyScraperJob(dbService);
  },
  enabled: process.env.ENABLE_SCRAPER_JOB !== 'false',
});

jobScheduler.registerJob({
  name: 'schedule-checker',
  schedule: '0,10,20,30,40,50 * * * *', // At :00, :10, :20, :30, :40, :50 of every hour
  handler: async () => {
    await runScheduleCheckerJob(dbService);
  },
  enabled: process.env.ENABLE_SCHEDULE_CHECKER !== 'false',
});

jobScheduler.registerJob({
  name: 'cache-cleanup',
  schedule: '0 3 * * 0', // 3:00 AM every Sunday
  handler: async () => {
    await runCacheCleanupJob(dbService);
  },
  enabled: process.env.ENABLE_CACHE_CLEANUP !== 'false',
});

// Start background jobs
if (NODE_ENV === 'production' || process.env.ENABLE_JOBS === 'true') {
  jobScheduler.start();
  logger.info('Background jobs started');
} else {
  logger.info('Background jobs disabled in development mode');
}

const HOST = process.env.HOST || '0.0.0.0';
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || '3443', 10);

// Function to generate self-signed certificate for localhost
function generateSelfSignedCert(): { key: string; cert: string } | null {
  try {
    const { execSync } = require('child_process');
    const os = require('os');
    const certDir = path.join(os.tmpdir(), 'playlist-lab-certs');
    
    // Create cert directory if it doesn't exist
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
    }
    
    const keyPath = path.join(certDir, 'key.pem');
    const certPath = path.join(certDir, 'cert.pem');
    
    // Check if cert already exists and is valid
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      logger.info('Using existing self-signed certificate');
      return {
        key: fs.readFileSync(keyPath, 'utf8'),
        cert: fs.readFileSync(certPath, 'utf8'),
      };
    }
    
    // Generate new self-signed certificate using OpenSSL
    logger.info('Generating self-signed certificate for HTTPS...');
    
    // Check if openssl is available
    try {
      execSync('openssl version', { stdio: 'ignore' });
    } catch (e) {
      logger.warn('OpenSSL not found, HTTPS will be disabled');
      return null;
    }
    
    // Generate certificate valid for 365 days
    execSync(
      `openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj "/CN=localhost" ` +
      `-keyout "${keyPath}" -out "${certPath}" -days 365`,
      { stdio: 'ignore' }
    );
    
    logger.info('Self-signed certificate generated successfully');
    
    return {
      key: fs.readFileSync(keyPath, 'utf8'),
      cert: fs.readFileSync(certPath, 'utf8'),
    };
  } catch (error) {
    logger.error('Failed to generate self-signed certificate:', error);
    return null;
  }
}

// Start HTTP server
const server = app.listen(PORT as number, HOST, () => {
  logger.info(`HTTP server running on http://${HOST}:${PORT} in ${NODE_ENV} mode`);
});

// Start HTTPS server if explicitly enabled
let httpsServer: https.Server | null = null;
if (process.env.ENABLE_HTTPS === 'true') {
  const credentials = generateSelfSignedCert();
  if (credentials) {
    try {
      httpsServer = https.createServer(credentials, app);
      httpsServer.listen(HTTPS_PORT, HOST, () => {
        logger.info(`HTTPS server running on https://${HOST}:${HTTPS_PORT}`);
        logger.info(`Access the app at: https://localhost:${HTTPS_PORT}`);
        logger.info('Note: You may see a security warning - this is normal for self-signed certificates');
      });
    } catch (error) {
      logger.error('Failed to start HTTPS server:', error);
    }
  } else {
    logger.warn('HTTPS disabled - could not generate certificate');
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing servers');
  await jobScheduler.stop();
  server.close(() => {
    logger.info('HTTP server closed');
    if (httpsServer) {
      httpsServer.close(() => {
        logger.info('HTTPS server closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing servers');
  await jobScheduler.stop();
  server.close(() => {
    logger.info('HTTP server closed');
    if (httpsServer) {
      httpsServer.close(() => {
        logger.info('HTTPS server closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  console.error('Uncaught Exception:', error);
  // Don't exit - let the server keep running
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - let the server keep running
});

export default app;
