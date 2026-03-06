import fs from 'fs';
import os from 'os';
import path from 'path';

// Use OS temp dir as fallback to avoid permission issues in Program Files
const logDir = path.join(os.tmpdir(), 'playlist-lab');
const logFile = path.join(logDir, 'import-debug.log');

let logEnabled = false;

// Clear log file on startup
try {
  fs.mkdirSync(logDir, { recursive: true });
  fs.writeFileSync(logFile, `=== Import Debug Log Started at ${new Date().toISOString()} ===\n\n`);
  logEnabled = true;
} catch (err) {
  console.error('Failed to initialize import debug log:', err);
}

export function logImportDebug(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logLine = data 
    ? `[${timestamp}] ${message}\n${JSON.stringify(data, null, 2)}\n\n`
    : `[${timestamp}] ${message}\n\n`;
  
  console.log(`[DEBUG] ${message}`, data || '');
  if (!logEnabled) return;
  try {
    fs.appendFileSync(logFile, logLine);
  } catch (err) {
    // Silently ignore write failures
  }
}
