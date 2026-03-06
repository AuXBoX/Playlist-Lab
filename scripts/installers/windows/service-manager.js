#!/usr/bin/env node
/**
 * Windows Service Manager for Playlist Lab Server
 * 
 * Manages the server as a Windows service using node-windows
 */

const Service = require('node-windows').Service;
const path = require('path');

const command = process.argv[2];
const installDir = process.argv[3] || __dirname;
const nodePath = path.join(installDir, 'nodejs', 'node.exe');

const svc = new Service({
  name: 'PlaylistLabServer',
  description: 'Playlist Lab API Server - Manages playlists and integrates with Plex',
  script: path.join(installDir, 'server-launcher.js'),
  execPath: nodePath,
  nodeOptions: [
    '--max_old_space_size=2048'
  ],
  env: [
    {
      name: 'NODE_ENV',
      value: 'production'
    },
    {
      name: 'DATA_DIR',
      value: path.join(process.env.APPDATA || process.env.HOME, 'PlaylistLabServer')
    }
  ]
});

// Handle service events
svc.on('install', () => {
  console.log('Service installed successfully!');
  console.log('Starting service...');
  svc.start();
});

svc.on('alreadyinstalled', () => {
  console.log('Service is already installed.');
});

svc.on('start', () => {
  console.log('Service started successfully!');
  console.log('Playlist Lab Server is now running as a Windows service.');
  process.exit(0);
});

svc.on('stop', () => {
  console.log('Service stopped.');
  process.exit(0);
});

svc.on('uninstall', () => {
  console.log('Service uninstalled successfully!');
  process.exit(0);
});

svc.on('error', (err) => {
  console.error('Service error:', err);
  process.exit(1);
});

// Execute command
switch (command) {
  case 'install':
    console.log('Installing Playlist Lab Server as a Windows service...');
    svc.install();
    break;
    
  case 'uninstall':
    console.log('Uninstalling Playlist Lab Server service...');
    svc.uninstall();
    break;
    
  case 'start':
    console.log('Starting Playlist Lab Server service...');
    svc.start();
    break;
    
  case 'stop':
    console.log('Stopping Playlist Lab Server service...');
    svc.stop();
    break;
    
  case 'restart':
    console.log('Restarting Playlist Lab Server service...');
    svc.restart();
    break;
    
  default:
    console.log('Usage: service-manager.js [install|uninstall|start|stop|restart] [install-dir]');
    process.exit(1);
}
