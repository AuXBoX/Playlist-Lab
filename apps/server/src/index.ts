import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
// Force reload
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import path from 'path';
import https from 'https';
import fs from 'fs';
import { logger } from './utils/logger';
import { sessionStore } from './middleware/session-store';
import { errorHandler } from './middleware/error-handler';
import { attachDatabase } from './middleware/auth';
import { DatabaseService, getDatabase } from './database';
import { JobScheduler } from './services/jobs';
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
import './adapters'; // Register all source/target adapters

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize database
const db = getDatabase();
const dbService = new DatabaseService(db);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production' ? {
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
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000', 10), // 1000 requests per window (increased for dev)
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later', statusCode: 429 } },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req) => {
    // Skip rate limiting in development mode
    return process.env.NODE_ENV === 'development';
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
  if (!req.path.includes('/import/status/')) {
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
    version: process.env.npm_package_version || '2.0.0',
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
    version: process.env.npm_package_version || '2.0.0',
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
app.use('/api/playlists', playlistsRoutes);
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
    
    app.use(express.static(webAppPath));
    
    // Serve index.html for all non-API routes (SPA fallback)
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      // Skip API routes
      if (req.path.startsWith('/api/')) {
        return next();
      }
      const indexPath = path.join(webAppPath, 'index.html');
      logger.info(`Serving index.html for path: ${req.path}`);
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
  schedule: '0 * * * *', // Every hour
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
const ENABLE_HTTPS = process.env.ENABLE_HTTPS === 'true'; // Disabled by default, enable explicitly

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
if (ENABLE_HTTPS) {
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
