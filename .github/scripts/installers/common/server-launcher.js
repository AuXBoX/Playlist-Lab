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

const server = spawn(nodePath, [serverMain], {
  cwd: serverDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: port,
    NODE_ENV: 'production',
    INSTALL_DIR: installDir,
  },
});

server.on('error', (err) => {
  console.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code || 0);
});

// Forward signals
process.on('SIGINT', () => server.kill('SIGINT'));
process.on('SIGTERM', () => server.kill('SIGTERM'));
