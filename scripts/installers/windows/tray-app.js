#!/usr/bin/env node
/**
 * Playlist Lab Server - System Tray Application
 * 
 * Shows server status in system tray with:
 * - Green icon when server is running
 * - Red icon when server is stopped
 * - Double-click to open web interface
 * - Right-click menu for actions
 * - Auto-detect server port or manual configuration
 */

const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Get installation directory
const installDir = process.env.INSTALL_DIR || __dirname;
const nodePath = path.join(installDir, 'nodejs', 'node.exe');
const serverLauncherPath = path.join(installDir, 'server-launcher.js');
const configPath = path.join(installDir, 'tray-config.json');

// Load or create config
let config = loadConfig();

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }
  
  // Default config
  return {
    port: 3001,
    autoDetectPort: true
  };
}

function saveConfig() {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('Config saved:', config);
  } catch (error) {
    console.error('Failed to save config:', error);
  }
}

// Server URL and port
let SERVER_PORT = config.port;
let SERVER_URL = `http://localhost:${SERVER_PORT}`;

// Ports to try when auto-detecting
const COMMON_PORTS = [3001, 3000, 3002, 3003, 8080, 8000];

// Check if we have the tray module
let tray;
try {
  // Try to use node-systray (needs to be installed)
  const SysTray = require('systray').default;
  
  // Create initial menu
  tray = new SysTray({
    menu: createMenu(),
    debug: false,
    copyDir: true
  });

  // Handle menu clicks
  tray.onClick(action => {
    if (action.seq_id === 0) { // Main icon clicked
      openWebInterface();
    } else {
      handleMenuClick(action.item.title);
    }
  });

  console.log('Playlist Lab Server tray app started');
  console.log(`Monitoring server at: ${SERVER_URL}`);
  console.log('Status will update every 5 seconds');
  console.log('');
  
  // Auto-detect port on startup if enabled
  if (config.autoDetectPort) {
    detectServerPort();
  }
  
  // Check server status periodically
  setInterval(() => {
    if (config.autoDetectPort) {
      detectServerPort();
    } else {
      checkServerStatus(false);
    }
  }, 5000); // Every 5 seconds
  
  // Initial status check (with message)
  setTimeout(() => checkServerStatus(true), 1000);

} catch (error) {
  console.error('Failed to create system tray:', error);
  console.log('Falling back to simple status checker...');
  
  // Fallback: Simple console-based status checker
  console.log('Playlist Lab Server Monitor');
  console.log('===========================');
  console.log('Double-click the Start Menu shortcut to open the web interface');
  console.log('');
  
  if (config.autoDetectPort) {
    detectServerPort();
  }
  
  setInterval(() => {
    if (config.autoDetectPort) {
      detectServerPort();
    } else {
      checkServerStatus(true);
    }
  }, 10000); // Every 10 seconds
  
  checkServerStatus(true);
}

/**
 * Create menu structure
 */
function createMenu() {
  return {
    icon: getIconPath(false),
    title: '🔴 Playlist Lab - Checking...',
    tooltip: 'Playlist Lab Server - Checking status...',
    items: [
      {
        title: 'Open Playlist Lab',
        tooltip: 'Open web interface',
        checked: false,
        enabled: true
      },
      {
        title: 'Server Status',
        tooltip: 'Check server status',
        checked: false,
        enabled: true
      },
      {
        title: '---'
      },
      {
        title: 'Start Server',
        tooltip: 'Start the server',
        checked: false,
        enabled: true
      },
      {
        title: 'Stop Server',
        tooltip: 'Stop the server',
        checked: false,
        enabled: true
      },
      {
        title: 'Restart Server',
        tooltip: 'Restart the server',
        checked: false,
        enabled: true
      },
      {
        title: '---'
      },
      {
        title: `Server Port: ${SERVER_PORT}`,
        tooltip: 'Change server port',
        checked: false,
        enabled: true
      },
      {
        title: config.autoDetectPort ? '✓ Auto-detect Port' : 'Auto-detect Port',
        tooltip: 'Automatically detect server port',
        checked: config.autoDetectPort,
        enabled: true
      },
      {
        title: '---'
      },
      {
        title: 'View Logs',
        tooltip: 'Open log folder',
        checked: false,
        enabled: true
      },
      {
        title: 'Settings',
        tooltip: 'Open settings folder',
        checked: false,
        enabled: true
      },
      {
        title: '---'
      },
      {
        title: 'Exit',
        tooltip: 'Exit tray application',
        checked: false,
        enabled: true
      }
    ]
  };
}

/**
 * Handle menu item clicks
 */
function handleMenuClick(title) {
  if (title === 'Open Playlist Lab') {
    openWebInterface();
  } else if (title === 'Server Status') {
    checkServerStatus(true);
  } else if (title === 'Start Server') {
    startServer();
  } else if (title === 'Stop Server') {
    stopServer();
  } else if (title === 'Restart Server') {
    restartServer();
  } else if (title.startsWith('Server Port:')) {
    changePort();
  } else if (title.includes('Auto-detect Port')) {
    toggleAutoDetect();
  } else if (title === 'View Logs') {
    openLogs();
  } else if (title === 'Settings') {
    openSettings();
  } else if (title === 'Exit') {
    exitApp();
  }
}

/**
 * Update menu with current config
 */
function updateMenu() {
  if (!tray) return;
  
  try {
    tray.sendAction({
      type: 'update-menu',
      menu: createMenu()
    });
  } catch (error) {
    console.error('Failed to update menu:', error.message);
  }
}

/**
 * Get icon path based on server status
 */
function getIconPath(isRunning) {
  const iconDir = path.join(installDir, 'icons');
  if (!fs.existsSync(iconDir)) {
    fs.mkdirSync(iconDir, { recursive: true });
  }
  
  const iconFile = isRunning ? 'server-running.ico' : 'server-stopped.ico';
  const iconPath = path.join(iconDir, iconFile);
  
  // Create simple icons if they don't exist
  if (!fs.existsSync(iconPath)) {
    createIcon(iconPath, isRunning);
  }
  
  return iconPath;
}

/**
 * Create a simple icon (placeholder)
 */
function createIcon(iconPath, isRunning) {
  // For now, just create an empty file
  // In production, you'd want actual .ico files
  fs.writeFileSync(iconPath, '');
}

/**
 * Auto-detect which port the server is running on
 */
function detectServerPort() {
  let portsToCheck = [...COMMON_PORTS];
  
  // Always check current configured port first
  if (!portsToCheck.includes(SERVER_PORT)) {
    portsToCheck.unshift(SERVER_PORT);
  }
  
  checkPortsSequentially(portsToCheck, 0);
}

/**
 * Check ports one by one
 */
function checkPortsSequentially(ports, index) {
  if (index >= ports.length) {
    // No server found on any port
    updateStatus(false);
    return;
  }
  
  const port = ports[index];
  
  const options = {
    hostname: 'localhost',
    port: port,
    path: '/health',
    method: 'GET',
    timeout: 1000
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      if (res.statusCode === 200) {
        // Server found!
        if (SERVER_PORT !== port) {
          console.log(`✓ Server detected on port ${port} (was checking ${SERVER_PORT})`);
          SERVER_PORT = port;
          SERVER_URL = `http://localhost:${SERVER_PORT}`;
          config.port = port;
          saveConfig();
          updateMenu();
        }
        
        try {
          const health = JSON.parse(data);
          updateStatus(true, health);
        } catch (error) {
          updateStatus(true);
        }
      } else {
        // Try next port
        checkPortsSequentially(ports, index + 1);
      }
    });
  });

  req.on('error', () => {
    // Try next port
    checkPortsSequentially(ports, index + 1);
  });

  req.on('timeout', () => {
    req.destroy();
    // Try next port
    checkPortsSequentially(ports, index + 1);
  });

  req.end();
}

/**
 * Check if server is running on configured port
 */
function checkServerStatus(showMessage) {
  // Try health endpoint first
  const healthOptions = {
    hostname: 'localhost',
    port: SERVER_PORT,
    path: '/health',
    method: 'GET',
    timeout: 3000
  };

  const req = http.request(healthOptions, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      if (res.statusCode === 200) {
        try {
          const health = JSON.parse(data);
          updateStatus(true, health);
          if (showMessage) {
            console.log(`✓ Server is running on port ${SERVER_PORT} (uptime: ${health.uptimeFormatted || 'unknown'})`);
          }
        } catch (error) {
          // Health endpoint returned non-JSON, but server is responding
          updateStatus(true);
          if (showMessage) {
            console.log(`✓ Server is running on port ${SERVER_PORT}`);
          }
        }
      } else {
        // Try fallback check
        checkServerFallback(showMessage);
      }
    });
  });

  req.on('error', () => {
    // Try fallback check
    checkServerFallback(showMessage);
  });

  req.on('timeout', () => {
    req.destroy();
    // Try fallback check
    checkServerFallback(showMessage);
  });

  req.end();
}

/**
 * Fallback status check - try root endpoint
 */
function checkServerFallback(showMessage) {
  const rootOptions = {
    hostname: 'localhost',
    port: SERVER_PORT,
    path: '/',
    method: 'GET',
    timeout: 2000
  };

  const req = http.request(rootOptions, (res) => {
    if (res.statusCode === 200 || res.statusCode === 304) {
      updateStatus(true);
      if (showMessage) {
        console.log(`✓ Server is running on port ${SERVER_PORT} (detected via root endpoint)`);
      }
    } else {
      updateStatus(false);
      if (showMessage) {
        console.log(`✗ Server is not responding on port ${SERVER_PORT}`);
      }
    }
  });

  req.on('error', () => {
    updateStatus(false);
    if (showMessage) {
      console.log(`✗ Server is not running on port ${SERVER_PORT}`);
    }
  });

  req.on('timeout', () => {
    req.destroy();
    updateStatus(false);
    if (showMessage) {
      console.log(`✗ Server connection timeout on port ${SERVER_PORT}`);
    }
  });

  req.end();
}

/**
 * Update tray icon and tooltip based on status
 */
function updateStatus(isRunning, health = null) {
  if (!tray) return;
  
  const statusIndicator = isRunning ? '🟢' : '🔴';
  const statusText = isRunning ? 'Running' : 'Stopped';
  
  const tooltip = isRunning 
    ? `${statusIndicator} Playlist Lab - ${statusText} (Port ${SERVER_PORT})${health && health.uptimeFormatted ? ` - ${health.uptimeFormatted}` : ''}`
    : `${statusIndicator} Playlist Lab - ${statusText}`;
  
  try {
    tray.sendAction({
      type: 'update-item',
      item: {
        icon: getIconPath(isRunning),
        tooltip: tooltip,
        title: `${statusIndicator} Playlist Lab - ${statusText}`
      }
    });
  } catch (error) {
    // Silently fail if tray update fails
    console.error('Failed to update tray:', error.message);
  }
}

/**
 * Open web interface in default browser
 */
function openWebInterface() {
  console.log(`Opening ${SERVER_URL}...`);
  
  // Check if server is running first
  const options = {
    hostname: 'localhost',
    port: SERVER_PORT,
    path: '/health',
    method: 'GET',
    timeout: 2000
  };

  const req = http.request(options, (res) => {
    // Server is running, open browser
    exec(`start ${SERVER_URL}`, (error) => {
      if (error) {
        console.error('Failed to open browser:', error);
      }
    });
  });

  req.on('error', () => {
    // Server not running, ask to start it
    console.log('Server is not running. Starting server...');
    startServer();
    
    // Wait a bit then open browser
    setTimeout(() => {
      exec(`start ${SERVER_URL}`, (error) => {
        if (error) {
          console.error('Failed to open browser:', error);
        }
      });
    }, 3000);
  });

  req.end();
}

/**
 * Start the server
 */
function startServer() {
  console.log('Starting Playlist Lab Server...');
  
  const server = spawn(nodePath, [serverLauncherPath], {
    detached: true,
    stdio: 'ignore',
    cwd: installDir,
    env: {
      ...process.env,
      PORT: SERVER_PORT.toString()
    }
  });
  
  server.unref();
  
  setTimeout(() => checkServerStatus(true), 2000);
}

/**
 * Stop the server
 */
function stopServer() {
  console.log('Stopping Playlist Lab Server...');
  
  exec('taskkill /F /IM node.exe /FI "WINDOWTITLE eq *playlist-lab*"', (error) => {
    if (error) {
      console.error('Failed to stop server:', error);
    } else {
      console.log('Server stopped');
    }
    setTimeout(() => checkServerStatus(true), 1000);
  });
}

/**
 * Restart the server
 */
function restartServer() {
  console.log('Restarting Playlist Lab Server...');
  stopServer();
  setTimeout(() => startServer(), 2000);
}

/**
 * Change server port
 */
function changePort() {
  console.log('');
  console.log('='.repeat(50));
  console.log('Change Server Port');
  console.log('='.repeat(50));
  console.log(`Current port: ${SERVER_PORT}`);
  console.log('Common ports: 3000, 3001, 3002, 8080');
  console.log('');
  console.log('To change the port:');
  console.log(`1. Edit: ${configPath}`);
  console.log('2. Change the "port" value');
  console.log('3. Restart the tray app');
  console.log('');
  console.log('Or use environment variable: SET PORT=3001');
  console.log('='.repeat(50));
  console.log('');
  
  // Open config file in notepad
  exec(`notepad "${configPath}"`, (error) => {
    if (error) {
      console.error('Failed to open config file:', error);
    }
  });
}

/**
 * Toggle auto-detect port
 */
function toggleAutoDetect() {
  config.autoDetectPort = !config.autoDetectPort;
  saveConfig();
  updateMenu();
  
  console.log(`Auto-detect port: ${config.autoDetectPort ? 'ENABLED' : 'DISABLED'}`);
  
  if (config.autoDetectPort) {
    console.log('Detecting server port...');
    detectServerPort();
  }
}

/**
 * Open logs folder
 */
function openLogs() {
  const logsDir = path.join(process.env.APPDATA || process.env.HOME, 'PlaylistLabServer');
  exec(`explorer "${logsDir}"`, (error) => {
    if (error) {
      console.error('Failed to open logs folder:', error);
    }
  });
}

/**
 * Open settings folder
 */
function openSettings() {
  const settingsDir = path.join(installDir, 'server');
  exec(`explorer "${settingsDir}"`, (error) => {
    if (error) {
      console.error('Failed to open settings folder:', error);
    }
  });
}

/**
 * Exit the tray application
 */
function exitApp() {
  console.log('Exiting Playlist Lab tray app...');
  if (tray) {
    tray.kill();
  }
  process.exit(0);
}

// Handle process termination
process.on('SIGINT', exitApp);
process.on('SIGTERM', exitApp);
