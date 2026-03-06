#!/usr/bin/env node
/**
 * Playlist Lab Server - Cross-Platform Tray Application
 *
 * Uses the 'systray' npm package (pre-built Go binaries, no compilation).
 * Falls back to headless monitor if systray is unavailable.
 * Works on Windows, macOS, and Linux.
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');

const platform = os.platform();
const isWindows = platform === 'win32';
const isMac = platform === 'darwin';

// Install dir: when run from the installed location, __dirname IS the install dir.
const installDir = process.env.INSTALL_DIR || path.resolve(__dirname);

const nodePath = isWindows
  ? path.join(installDir, 'nodejs', 'node.exe')
  : process.execPath;

const serverLauncherPath = path.join(installDir, 'server-launcher.js');

const dataDir = isWindows
  ? path.join(process.env.APPDATA || os.homedir(), 'PlaylistLabServer')
  : isMac
    ? path.join(os.homedir(), 'Library', 'Application Support', 'PlaylistLabServer')
    : path.join(os.homedir(), '.local', 'share', 'PlaylistLabServer');

// ── Config ────────────────────────────────────────────────────────────────────

const configPath = path.join(installDir, 'tray-config.json');

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (_) {}
  return { port: 3001 };
}

const config = loadConfig();
const serverPort = config.port || 3001;
let serverProcess = null;

// ── Logging ───────────────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  process.stdout.write(line);
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.appendFileSync(path.join(dataDir, 'tray.log'), line);
  } catch (_) {}
}

// ── Server control ────────────────────────────────────────────────────────────

function isServerRunning(cb) {
  const req = http.request(
    { hostname: 'localhost', port: serverPort, path: '/health', method: 'GET', timeout: 2000 },
    (res) => cb(res.statusCode === 200)
  );
  req.on('error', () => cb(false));
  req.on('timeout', () => { req.destroy(); cb(false); });
  req.end();
}

function startServer() {
  if (serverProcess) return;
  if (!fs.existsSync(serverLauncherPath)) { log(`ERROR: server-launcher.js not found at ${serverLauncherPath}`); return; }
  if (!fs.existsSync(nodePath)) { log(`ERROR: node not found at ${nodePath}`); return; }

  log('Starting server...');
  fs.mkdirSync(dataDir, { recursive: true });

  const out = fs.openSync(path.join(dataDir, 'server.log'), 'a');
  const err = fs.openSync(path.join(dataDir, 'server-error.log'), 'a');

  serverProcess = spawn(nodePath, [serverLauncherPath], {
    cwd: installDir,
    detached: false,
    stdio: ['ignore', out, err],
    env: { ...process.env, PORT: String(serverPort), INSTALL_DIR: installDir },
  });

  serverProcess.on('exit', (code) => { log(`Server exited (code ${code})`); serverProcess = null; });
  serverProcess.on('error', (e) => { log(`Server error: ${e.message}`); serverProcess = null; });
}

function stopServer(cb) {
  if (serverProcess) {
    serverProcess.once('exit', () => { serverProcess = null; if (cb) cb(); });
    serverProcess.kill('SIGTERM');
    setTimeout(() => { if (serverProcess) serverProcess.kill('SIGKILL'); }, 5000);
  } else {
    if (cb) cb();
  }
}

function openBrowser() {
  const url = `http://localhost:${serverPort}`;
  const cmd = isWindows ? `start "" "${url}"` : isMac ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, (e) => { if (e) log(`Browser open failed: ${e.message}`); });
}

// ── Icon (16x16 PNG base64) ───────────────────────────────────────────────────
// Minimal valid 1x1 PNGs — systray scales them. Green = running, red = stopped.

const ICON_GREEN = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAI0lEQVQ4jWNg' +
  'YGBg+M9AAIyGwWgYjIbBaBiMhsFoGAwGAATEAAGkAAGkAAAAAElFTkSuQmCC';
const ICON_RED = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAI0lEQVQ4jWNg' +
  'YGBg+M9AAIyGwWgYjIbBaBiMhsFoGAwGAATEAAGkAAGkAAAAAElFTkSuQmCC';

// ── Tray ──────────────────────────────────────────────────────────────────────

function tryLoadSystray() {
  const candidates = [
    path.join(installDir, 'node_modules', 'systray'),
    path.join(installDir, 'server', 'node_modules', 'systray'),
    'systray', // global / PATH
  ];
  for (const p of candidates) {
    try {
      const mod = require(p);
      return mod.default || mod;
    } catch (_) {}
  }
  return null;
}

function startTray(SysTray) {
  const items = [
    { title: 'Open Playlist Lab', tooltip: 'Open in browser', checked: false, enabled: true },
    { title: '<SEPARATOR>' },
    { title: 'Start Server',   tooltip: '', checked: false, enabled: true },
    { title: 'Stop Server',    tooltip: '', checked: false, enabled: true },
    { title: 'Restart Server', tooltip: '', checked: false, enabled: true },
    { title: '<SEPARATOR>' },
    { title: 'Exit', tooltip: '', checked: false, enabled: true },
  ];

  const tray = new SysTray({
    menu: { icon: ICON_RED, title: '', tooltip: 'Playlist Lab Server - Starting...', items },
    debug: false,
    copyDir: true,
  });

  tray.onClick((action) => {
    const title = action.item && action.item.title;
    if (title === 'Open Playlist Lab')  openBrowser();
    else if (title === 'Start Server')  startServer();
    else if (title === 'Stop Server')   stopServer();
    else if (title === 'Restart Server') stopServer(() => setTimeout(startServer, 1000));
    else if (title === 'Exit')          stopServer(() => { tray.kill(); process.exit(0); });
  });

  function updateIcon() {
    isServerRunning((running) => {
      try {
        tray.sendAction({
          type: 'update-item',
          item: {
            icon: running ? ICON_GREEN : ICON_RED,
            tooltip: `Playlist Lab - ${running ? 'Running' : 'Stopped'} (port ${serverPort})`,
            title: '',
          },
          seq_id: 0,
        });
      } catch (_) {}
    });
  }

  setInterval(updateIcon, 10000);
  setTimeout(updateIcon, 3000);
  log('Tray started');
}

// ── Headless fallback ─────────────────────────────────────────────────────────

function runHeadless() {
  log(`Running headless — server at http://localhost:${serverPort}`);
  // Auto-restart if server dies
  setInterval(() => {
    isServerRunning((running) => {
      if (!running && !serverProcess) {
        log('Server not running, restarting...');
        startServer();
      }
    });
  }, 15000);
}

// ── Entry point ───────────────────────────────────────────────────────────────

isServerRunning((running) => {
  if (!running) startServer();
  else log(`Server already running on port ${serverPort}`);

  const SysTray = tryLoadSystray();
  if (SysTray) {
    startTray(SysTray);
  } else {
    log('systray not available, running headless');
    runHeadless();
  }
});

process.on('SIGINT', () => stopServer(() => process.exit(0)));
process.on('SIGTERM', () => stopServer(() => process.exit(0)));
