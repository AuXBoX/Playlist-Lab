#!/usr/bin/env node
/**
 * Windows Startup Manager for Playlist Lab Server
 * 
 * Manages adding/removing the server from Windows startup
 */

const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const os = require('os');

const command = process.argv[2];
const installDir = process.argv[3] || __dirname;

// Startup folder path
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
const launcherPath = path.join(installDir, 'server-launcher.js');
const nodePath = path.join(installDir, 'nodejs', 'node.exe');

/**
 * Create a Windows shortcut using VBScript
 */
function createShortcut(callback) {
  const vbsScript = `
Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = "${shortcutPath.replace(/\\/g, '\\\\')}"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "${nodePath.replace(/\\/g, '\\\\')}"
oLink.Arguments = "${launcherPath.replace(/\\/g, '\\\\')}"
oLink.WorkingDirectory = "${installDir.replace(/\\/g, '\\\\')}"
oLink.Description = "Playlist Lab Server"
oLink.WindowStyle = 7
oLink.Save
`;

  const vbsPath = path.join(os.tmpdir(), 'create-shortcut.vbs');
  fs.writeFileSync(vbsPath, vbsScript);

  exec(`cscript //nologo "${vbsPath}"`, (error, stdout, stderr) => {
    fs.unlinkSync(vbsPath);
    
    if (error) {
      console.error('Error creating shortcut:', error);
      callback(error);
    } else {
      console.log('Shortcut created successfully!');
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
      console.log('Startup shortcut removed successfully!');
      callback(null);
    } catch (error) {
      console.error('Error removing shortcut:', error);
      callback(error);
    }
  } else {
    console.log('Startup shortcut does not exist.');
    callback(null);
  }
}

// Execute command
switch (command) {
  case 'add':
    console.log('Adding Playlist Lab Server to Windows startup...');
    createShortcut((error) => {
      if (error) {
        console.error('Failed to add to startup');
        process.exit(1);
      } else {
        console.log('Playlist Lab Server will now start automatically when you log in.');
        process.exit(0);
      }
    });
    break;
    
  case 'remove':
    console.log('Removing Playlist Lab Server from Windows startup...');
    removeShortcut((error) => {
      if (error) {
        console.error('Failed to remove from startup');
        process.exit(1);
      } else {
        console.log('Playlist Lab Server removed from startup.');
        process.exit(0);
      }
    });
    break;
    
  default:
    console.log('Usage: startup-manager.js [add|remove] [install-dir]');
    process.exit(1);
}
