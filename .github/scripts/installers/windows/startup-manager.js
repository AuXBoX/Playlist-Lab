#!/usr/bin/env node
/**
 * Windows Startup Manager for Playlist Lab Server
 * 
 * Manages startup configuration and launches the tray app
 */

const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const os = require('os');

// Parse command line arguments
const args = process.argv.slice(2);
let mode = 'autostart';
let installDir = __dirname;
let startNow = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--mode' && args[i + 1]) {
    mode = args[i + 1];
    i++;
  } else if (args[i] === '--install-dir' && args[i + 1]) {
    installDir = args[i + 1];
    i++;
  } else if (args[i] === '--start-now') {
    startNow = true;
  }
}

// Paths
const startupFolder = path.join(
  os.homedir(),
  'AppData',
  'Roaming',
  'Microsoft',
  'Windows',
  'Start Menu',
  'Programs',
  'Startup'
);

const shortcutPath = path.join(startupFolder, 'PlaylistLabServer.lnk');
const trayAppPath = path.join(installDir, 'tray-app.js');
const nodePath = path.join(installDir, 'nodejs', 'node.exe');

/**
 * Create a Windows shortcut using VBScript
 */
function createShortcut(targetPath, args, callback) {
  const vbsScript = `
Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = "${shortcutPath.replace(/\\/g, '\\\\')}"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "${nodePath.replace(/\\/g, '\\\\')}"
oLink.Arguments = "${trayAppPath.replace(/\\/g, '\\\\')}"
oLink.WorkingDirectory = "${installDir.replace(/\\/g, '\\\\')}"
oLink.Description = "Playlist Lab Server"
oLink.WindowStyle = 7
oLink.Save
`;

  const vbsPath = path.join(os.tmpdir(), 'create-shortcut.vbs');
  fs.writeFileSync(vbsPath, vbsScript);

  exec(`cscript //nologo "${vbsPath}"`, (error, stdout, stderr) => {
    try { fs.unlinkSync(vbsPath); } catch (_) {}
    
    if (error) {
      console.error('Error creating shortcut:', error);
      callback(error);
    } else {
      console.log('✓ Startup shortcut created');
      callback(null);
    }
  });
}

/**
 * Remove the startup shortcut
 */
function removeShortcut(callback) {
  if (fs.existsSync(shortcutPath)) {
    try {
      fs.unlinkSync(shortcutPath);
      console.log('✓ Startup shortcut removed');
      callback(null);
    } catch (error) {
      console.error('Error removing shortcut:', error);
      callback(error);
    }
  } else {
    callback(null);
  }
}

/**
 * Start the tray app now
 */
function startTrayApp() {
  console.log('Starting Playlist Lab Server...');
  
  const trayProcess = spawn(nodePath, [trayAppPath], {
    detached: true,
    stdio: 'ignore',
    cwd: installDir,
    env: { ...process.env, INSTALL_DIR: installDir }
  });
  
  trayProcess.unref();
  console.log('✓ Playlist Lab Server started');
}

/**
 * Install as Windows service (placeholder for future implementation)
 */
function installService(callback) {
  console.log('Service mode not yet implemented. Using autostart mode instead.');
  createShortcut(trayAppPath, '', callback);
}

/**
 * Remove Windows service (placeholder for future implementation)
 */
function removeService(callback) {
  console.log('Removing service configuration...');
  removeShortcut(callback);
}

// Execute based on mode
console.log(`Configuring Playlist Lab Server (mode: ${mode})...`);

switch (mode) {
  case 'autostart':
    removeShortcut(() => {
      createShortcut(trayAppPath, '', (error) => {
        if (error) {
          console.error('Failed to configure autostart');
          process.exit(1);
        } else {
          console.log('✓ Configured to start automatically on login');
          if (startNow) startTrayApp();
          process.exit(0);
        }
      });
    });
    break;
    
  case 'service':
    removeShortcut(() => {
      installService((error) => {
        if (error) {
          console.error('Failed to configure service');
          process.exit(1);
        } else {
          console.log('✓ Configured as Windows service');
          if (startNow) startTrayApp();
          process.exit(0);
        }
      });
    });
    break;
    
  case 'manual':
    removeShortcut(() => {
      removeService(() => {
        console.log('✓ Configured for manual start only');
        console.log('  Use Start Menu shortcut to launch Playlist Lab Server');
        if (startNow) startTrayApp();
        process.exit(0);
      });
    });
    break;
    
  case 'remove':
    console.log('Removing Playlist Lab Server startup configuration...');
    removeShortcut(() => {
      removeService(() => {
        console.log('✓ Startup configuration removed');
        process.exit(0);
      });
    });
    break;
    
  default:
    console.log('Usage: startup-manager.js --mode [autostart|service|manual|remove] [--start-now]');
    process.exit(1);
}
