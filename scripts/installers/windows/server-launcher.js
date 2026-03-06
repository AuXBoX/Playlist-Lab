#!/usr/bin/env node
/**
 * Playlist Lab Server Launcher
 * 
 * Handles launching the server in different modes:
 * - Standalone: Run as a regular application
 * - Startup: Run on Windows startup (user login)
 * - Service: Run as a Windows service
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get installation directory (parent of nodejs folder)
const installDir = __dirname;
const nodePath = path.join(installDir, 'nodejs', 'node.exe');
const serverPath = path.join(installDir, 'server', 'dist', 'index.js');
const dataDir = path.join(process.env.APPDATA || process.env.HOME, 'PlaylistLabServer');
const trayConfigPath = path.join(installDir, 'tray-config.json');
const envFilePath = path.join(installDir, 'server', '.env');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load port from tray config if available
let configuredPort = '3001';
if (fs.existsSync(trayConfigPath)) {
  try {
    const trayConfig = JSON.parse(fs.readFileSync(trayConfigPath, 'utf8'));
    if (trayConfig.port) {
      configuredPort = trayConfig.port.toString();
      console.log(`Using port from tray config: ${configuredPort}`);
    }
  } catch (error) {
    console.log('Failed to read tray config, using default port');
  }
}

// Load .env file if it exists
if (fs.existsSync(envFilePath)) {
  try {
    const envContent = fs.readFileSync(envFilePath, 'utf8');
    const envLines = envContent.split('\n');
    for (const line of envLines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          if (key.trim() === 'PORT' && value) {
            configuredPort = value;
            console.log(`Using port from .env file: ${configuredPort}`);
          }
        }
      }
    }
  } catch (error) {
    console.log('Failed to read .env file');
  }
}

// Set environment variables
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || configuredPort;
process.env.HOST = process.env.HOST || '0.0.0.0';
process.env.DATA_DIR = dataDir;
process.env.DB_PATH = path.join(dataDir, 'playlist-lab.db');
process.env.LOG_DIR = path.join(dataDir, 'logs'); // Set log directory to AppData
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex');
process.env.WEB_APP_PATH = path.join(installDir, 'web', 'dist');

// Log file for debugging
const logFile = path.join(dataDir, 'server.log');
const errorLogFile = path.join(dataDir, 'server-error.log');

console.log('Starting Playlist Lab Server...');
console.log('Installation Directory:', installDir);
console.log('Data Directory:', dataDir);
console.log('Server Path:', serverPath);
console.log('Log File:', logFile);

// Start the server
const server = spawn(nodePath, [serverPath], {
  cwd: path.join(installDir, 'server'),
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: false
});

// Redirect output to log files
const logStream = fs.createWriteStream(logFile, { flags: 'a' });
const errorLogStream = fs.createWriteStream(errorLogFile, { flags: 'a' });

server.stdout.pipe(logStream);
server.stderr.pipe(errorLogStream);

// Also log to console
server.stdout.on('data', (data) => {
  console.log(data.toString());
});

server.stderr.on('data', (data) => {
  console.error(data.toString());
});

server.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

server.on('exit', (code, signal) => {
  console.log(`Server exited with code ${code} and signal ${signal}`);
  process.exit(code || 0);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.kill('SIGTERM');
});

process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  server.kill('SIGTERM');
});
