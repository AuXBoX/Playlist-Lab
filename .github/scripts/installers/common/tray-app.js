#!/usr/bin/env node
/**
 * Playlist Lab Server - Cross-Platform Tray Application
 * Works on Windows, macOS, and Linux via the 'systray2' package.
 * Falls back to headless monitor if systray is unavailable.
 */

'use strict';

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const readline = require('readline');

const platform = os.platform(); // 'win32' | 'darwin' | 'linux'
const isWindows = platform === 'win32';
const isMac = platform === 'darwin';

const installDir = process.env.INSTALL_DIR || path.resolve(__dirname);
const configPath = path.join(installDir, 'tray-config.json');

const dataDir = isWindows
  ? path.join(process.env.APPDATA || os.homedir(), 'PlaylistLabServer')
  : isMac
    ? path.join(os.homedir(), 'Library', 'Application Support', 'PlaylistLabServer')
    : path.join(os.homedir(), '.local', 'share', 'PlaylistLabServer');

// ── Config ────────────────────────────────────────────────────────────────────

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (_) {}
  return { port: 3001 };
}

function saveConfig(cfg) {
  try { fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2)); } catch (_) {}
}

let config = loadConfig();

// ── Logging ───────────────────────────────────────────────────────────────────

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.appendFileSync(path.join(dataDir, 'tray.log'), line + '\n');
  } catch (_) {}
}

// ── Server health check ───────────────────────────────────────────────────────

function checkHealth(port, cb) {
  const req = http.request(
    { hostname: 'localhost', port, path: '/health', method: 'GET', timeout: 2000 },
    (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { cb(res.statusCode === 200, JSON.parse(body)); }
        catch (_) { cb(res.statusCode === 200, {}); }
      });
    }
  );
  req.on('error', () => cb(false, {}));
  req.on('timeout', () => { req.destroy(); cb(false, {}); });
  req.end();
}

// ── Server process management ─────────────────────────────────────────────────

let serverProcess = null;

function getNodePath() {
  if (isWindows) {
    const local = path.join(installDir, 'nodejs', 'node.exe');
    if (fs.existsSync(local)) return local;
  }
  return process.execPath;
}

function getServerLauncher() {
  // Try JS launcher first, then shell script
  const jsLauncher = path.join(installDir, 'server-launcher.js');
  if (fs.existsSync(jsLauncher)) return { cmd: getNodePath(), args: [jsLauncher] };

  const shLauncher = path.join(installDir, 'server-launcher.sh');
  if (fs.existsSync(shLauncher)) return { cmd: 'bash', args: [shLauncher] };

  return null;
}

function startServer() {
  if (serverProcess) { log('Server already managed by tray'); return; }

  const launcher = getServerLauncher();
  if (!launcher) { log('ERROR: No server launcher found'); return; }

  log(`Starting server on port ${config.port}...`);
  fs.mkdirSync(dataDir, { recursive: true });

  const out = fs.openSync(path.join(dataDir, 'server.log'), 'a');
  const err = fs.openSync(path.join(dataDir, 'server-error.log'), 'a');

  serverProcess = spawn(launcher.cmd, launcher.args, {
    cwd: installDir,
    detached: false,
    stdio: ['ignore', out, err],
    env: { ...process.env, PORT: String(config.port), INSTALL_DIR: installDir },
  });

  serverProcess.on('exit', (code) => {
    log(`Server exited (code ${code})`);
    serverProcess = null;
  });
  serverProcess.on('error', (e) => {
    log(`Server spawn error: ${e.message}`);
    serverProcess = null;
  });
}

function stopServer(cb) {
  if (serverProcess) {
    log('Stopping server...');
    serverProcess.once('exit', () => { serverProcess = null; if (cb) cb(); });
    serverProcess.kill('SIGTERM');
    setTimeout(() => { if (serverProcess) serverProcess.kill('SIGKILL'); }, 5000);
  } else {
    // Try to kill by port as fallback
    killByPort(config.port, cb);
  }
}

function killByPort(port, cb) {
  let cmd;
  if (isWindows) {
    cmd = `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do taskkill /F /PID %a`;
    exec(cmd, () => { if (cb) cb(); });
  } else {
    exec(`lsof -ti tcp:${port} | xargs kill -9 2>/dev/null || true`, () => { if (cb) cb(); });
  }
}

function openBrowser() {
  const url = `http://localhost:${config.port}`;
  if (isWindows) exec(`start "" "${url}"`);
  else if (isMac) exec(`open "${url}"`);
  else exec(`xdg-open "${url}"`);
}

// ── Change port (interactive) ─────────────────────────────────────────────────

function promptChangePort(onDone) {
  if (isWindows) {
    // Use PowerShell InputBox on Windows
    const ps = `Add-Type -AssemblyName Microsoft.VisualBasic; $p = [Microsoft.VisualBasic.Interaction]::InputBox('Enter new port number:', 'Change Port', '${config.port}'); Write-Output $p`;
    exec(`powershell -Command "${ps}"`, (err, stdout) => {
      const newPort = parseInt(stdout.trim(), 10);
      if (!isNaN(newPort) && newPort > 0 && newPort < 65536) {
        config.port = newPort;
        saveConfig(config);
        log(`Port changed to ${newPort}`);
        notify('Port Changed', `Server port set to ${newPort}. Restart server to apply.`);
      }
      if (onDone) onDone();
    });
  } else {
    // Use readline on macOS/Linux
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`Enter new port (current: ${config.port}): `, (answer) => {
      rl.close();
      const newPort = parseInt(answer.trim(), 10);
      if (!isNaN(newPort) && newPort > 0 && newPort < 65536) {
        config.port = newPort;
        saveConfig(config);
        log(`Port changed to ${newPort}`);
        notify('Port Changed', `Server port set to ${newPort}. Restart server to apply.`);
      }
      if (onDone) onDone();
    });
  }
}

// ── Notifications ─────────────────────────────────────────────────────────────

function notify(title, msg) {
  try {
    if (isWindows) {
      const ps = `Add-Type -AssemblyName System.Windows.Forms; $n = New-Object System.Windows.Forms.NotifyIcon; $n.Icon = [System.Drawing.SystemIcons]::Information; $n.Visible = $true; $n.ShowBalloonTip(3000, '${title}', '${msg}', 0); Start-Sleep -Seconds 4; $n.Dispose()`;
      exec(`powershell -WindowStyle Hidden -Command "${ps}"`);
    } else if (isMac) {
      exec(`osascript -e 'display notification "${msg}" with title "${title}"'`);
    } else {
      exec(`notify-send "${title}" "${msg}" 2>/dev/null || true`);
    }
  } catch (_) {}
}

// ── Build tray menu items ─────────────────────────────────────────────────────
// (menu items are now built inline in startTray)

// ── Icon generation ───────────────────────────────────────────────────────────
// systray2 requires a file path to a PNG (macOS/Linux) or ICO (Windows).
// We generate minimal valid 16x16 solid-color PNGs at startup.

/**
 * Build a minimal valid 16x16 PNG with a solid fill color.
 * Uses raw PNG binary construction — no external dependencies needed.
 */
function buildSolidPng(r, g, b) {
  // PNG signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk: 16x16, 8-bit RGB
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(16, 0); // width
  ihdrData.writeUInt32BE(16, 4); // height
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type: RGB
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makePngChunk('IHDR', ihdrData);

  // IDAT chunk: raw scanlines (filter byte 0 + 16 RGB pixels per row)
  const scanline = Buffer.alloc(1 + 16 * 3);
  scanline[0] = 0; // filter type None
  for (let i = 0; i < 16; i++) {
    scanline[1 + i * 3] = r;
    scanline[2 + i * 3] = g;
    scanline[3 + i * 3] = b;
  }
  const raw = Buffer.concat(Array(16).fill(scanline));
  const compressed = zlibDeflate(raw);
  const idat = makePngChunk('IDAT', compressed);

  // IEND chunk
  const iend = makePngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

function makePngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBytes = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf), 0);
  return Buffer.concat([len, typeBytes, data, crc]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c;
    }
    return t;
  })());
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zlibDeflate(data) {
  // Use Node's built-in zlib for deflate
  return require('zlib').deflateSync(data);
}

function getIconPath(color) {
  const tmpDir = os.tmpdir();
  const file = path.join(tmpDir, `pl-icon-${color}.png`);
  if (!fs.existsSync(file)) {
    let r, g, b;
    if (color === 'green') { r = 34; g = 197; b = 94; }
    else { r = 239; g = 68; b = 68; } // red
    fs.writeFileSync(file, buildSolidPng(r, g, b));
  }
  return file;
}

// ── Systray integration ───────────────────────────────────────────────────────

function tryLoadSystray() {
  // Try systray2 first (better cross-platform support), then systray
  const candidates = [
    path.join(installDir, 'node_modules', 'systray2'),
    path.join(installDir, 'node_modules', 'systray'),
    path.join(installDir, 'server', 'node_modules', 'systray2'),
    path.join(installDir, 'server', 'node_modules', 'systray'),
  ];
  for (const p of candidates) {
    try {
      const mod = require(p);
      return mod.default || mod;
    } catch (_) {}
  }
  // Try global require
  try { return require('systray2'); } catch (_) {}
  try { return require('systray'); } catch (_) {}
  return null;
}

function startTray(SysTray) {
  const iconGreen = getIconPath('green');
  const iconRed = getIconPath('red');

  // Build menu items array with proper separator objects
  function buildItems(isRunning) {
    const status = isRunning
      ? `Running on port ${config.port}`
      : `Stopped (port ${config.port})`;
    return [
      { title: 'Open Playlist Lab',           tooltip: 'Open in browser',       checked: false, enabled: true },
      { title: `Status: ${status}`,            tooltip: 'Server status',         checked: false, enabled: false },
      { title: '<SEPARATOR>' },
      { title: 'Start Server',                 tooltip: 'Start the server',      checked: false, enabled: !isRunning },
      { title: 'Stop Server',                  tooltip: 'Stop the server',       checked: false, enabled: isRunning },
      { title: 'Restart Server',               tooltip: 'Restart the server',    checked: false, enabled: true },
      { title: '<SEPARATOR>' },
      { title: `Change Port (${config.port})`, tooltip: 'Change server port',    checked: false, enabled: true },
      { title: '<SEPARATOR>' },
      { title: 'Exit',                         tooltip: 'Exit tray app',         checked: false, enabled: true },
    ];
  }

  const tray = new SysTray({
    menu: {
      icon: iconRed,
      title: '',
      tooltip: 'Playlist Lab Server - Checking...',
      items: buildItems(false),
    },
    debug: false,
    copyDir: true,
  });

  tray.onClick((action) => {
    const title = action.item && action.item.title;
    if (!title) return;

    if (title === 'Open Playlist Lab') {
      openBrowser();
    } else if (title === 'Start Server') {
      startServer();
      setTimeout(() => refreshTray(), 3000);
    } else if (title === 'Stop Server') {
      stopServer(() => refreshTray());
    } else if (title === 'Restart Server') {
      stopServer(() => { setTimeout(() => { startServer(); setTimeout(() => refreshTray(), 3000); }, 1000); });
    } else if (title.startsWith('Change Port')) {
      promptChangePort(() => refreshTray());
    } else if (title === 'Exit') {
      stopServer(() => { tray.kill(); process.exit(0); });
    }
  });

  function refreshTray() {
    checkHealth(config.port, (running) => {
      const tooltip = running
        ? `Playlist Lab - Running on port ${config.port}`
        : `Playlist Lab - Stopped`;
      try {
        tray.sendAction({
          type: 'update-menu',
          menu: {
            icon: running ? iconGreen : iconRed,
            title: '',
            tooltip,
            items: buildItems(running),
          },
        });
      } catch (_) {}
    });
  }

  // Poll every 10s
  setInterval(() => refreshTray(), 10000);
  setTimeout(() => refreshTray(), 2000);

  log('Tray started');
}

// ── Headless fallback ─────────────────────────────────────────────────────────

function runHeadless() {
  log(`Running headless — no systray available. Server at http://localhost:${config.port}`);
  log('Use Ctrl+C to stop.');

  // Auto-restart if server dies
  setInterval(() => {
    checkHealth(config.port, (running) => {
      if (!running && !serverProcess) {
        log('Server not running, restarting...');
        startServer();
      }
    });
  }, 15000);

  // Handle stdin for basic control
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (key) => {
      if (key.toString() === 'q' || key[0] === 3) { // q or Ctrl+C
        stopServer(() => process.exit(0));
      } else if (key.toString() === 'o') {
        openBrowser();
      } else if (key.toString() === 'r') {
        stopServer(() => setTimeout(startServer, 1000));
      }
    });
    log('Keys: [o] open browser  [r] restart server  [q] quit');
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

log(`Playlist Lab Tray starting on ${platform}, port ${config.port}`);

// Start server if not already running
checkHealth(config.port, (running) => {
  if (!running) {
    startServer();
  } else {
    log(`Server already running on port ${config.port}`);
  }

  const SysTray = tryLoadSystray();
  if (SysTray) {
    startTray(SysTray);
  } else {
    log('systray module not found — running headless');
    runHeadless();
  }
});

process.on('SIGINT', () => stopServer(() => process.exit(0)));
process.on('SIGTERM', () => stopServer(() => process.exit(0)));
