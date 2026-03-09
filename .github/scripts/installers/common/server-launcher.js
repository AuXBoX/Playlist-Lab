#!/usr/bin/env node
/**
 * Playlist Lab Server Launcher
 * Starts the Node.js server process
 */

'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const installDir = process.env.INSTALL_DIR || path.resolve(__dirname);
const serverDir = path.join(installDir, 'server');
const serverMain = path.join(serverDir, 'dist', 'index.js');

// Check if server exists
if (!fs.existsSync(serverMain)) {
  console.error(`ERROR: Server not found at ${serverMain}`);
  process.exit(1);
}

// Get Node.js path
function getNodePath() {
  if (process.platform === 'win32') {
    const local = path.join(installDir, 'nodejs', 'node.exe');
    if (fs.existsSync(local)) return local;
  }
  return process.execPath;
}

// Start the server
const nodePath = getNodePath();
const port = process.env.PORT || '3001';

console.log(`Starting Playlist Lab Server on port ${port}...`);
console.log(`Node: ${nodePath}`);
console.log(`Server: ${serverMain}`);

// Create persistent data directory in user's AppData
const dataDir = process.platform === 'win32'
  ? path.join(process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming'), 'Playlist Lab')
  : process.platform === 'darwin'
    ? path.join(require('os').homedir(), 'Library', 'Application Support', 'Playlist Lab')
    : path.join(require('os').homedir(), '.local', 'share', 'Playlist Lab');

const logsDir = path.join(dataDir, 'logs');
const dbPath = path.join(dataDir, 'data', 'playlist-lab.db');

// Ensure directories exist
require('fs').mkdirSync(path.join(dataDir, 'data'), { recursive: true });
require('fs').mkdirSync(logsDir, { recursive: true });

console.log(`Data directory: ${dataDir}`);
console.log(`Database: ${dbPath}`);

// Check if we're being called from the tray app
const fromTray = process.env.FROM_TRAY === 'true';

if (fromTray) {
  // When called from tray, run in foreground so tray can monitor it
  const server = spawn(nodePath, [serverMain], {
    cwd: serverDir,
    stdio: 'inherit', // Show output in tray's logs
    detached: false,  // Keep attached to tray
    env: {
      ...process.env,
      PORT: port,
      NODE_ENV: 'production',
      INSTALL_DIR: installDir,
      DATABASE_PATH: dbPath,
      LOG_DIR: logsDir,
    },
  });

  server.on('error', (err) => {
    console.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  });

  server.on('exit', (code) => {
    console.log(`Server exited with code ${code}`);
    process.exit(code);
  });

  // Keep running - don't exit
  console.log('Server started successfully (monitored by tray)');
} else {
  // When called standalone, run detached
  const server = spawn(nodePath, [serverMain], {
    cwd: serverDir,
    stdio: 'ignore', // Don't show console output
    detached: true,  // Run independently
    env: {
      ...process.env,
      PORT: port,
      NODE_ENV: 'production',
      INSTALL_DIR: installDir,
      DATABASE_PATH: dbPath,
      LOG_DIR: logsDir,
    },
    windowsHide: true, // Hide console window on Windows
  });

  // Unref so this launcher can exit
  server.unref();

  server.on('error', (err) => {
    console.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  });

  // Exit immediately - server is now running independently
  console.log('Server started successfully');
  process.exit(0);
}
