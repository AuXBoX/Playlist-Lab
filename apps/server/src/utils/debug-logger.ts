import fs from 'fs';
import path from 'path';
import os from 'os';

// Determine log directory:
// 1. Use LOG_DIR env var if set (set by tray app to AppData location)
// 2. In production, use AppData\Playlist Lab\logs
// 3. Otherwise use relative path from source
function getLogDir(): string {
  if (process.env.LOG_DIR) {
    return process.env.LOG_DIR;
  }
  
  const isProduction = process.cwd().includes('Program Files') || process.cwd().includes('Program Files (x86)');
  if (isProduction) {
    return path.join(os.homedir(), 'AppData', 'Roaming', 'Playlist Lab', 'logs');
  }
  
  return path.join(__dirname, '../../logs');
}

const LOG_DIR = getLogDir();
const DEBUG_LOG_FILE = path.join(LOG_DIR, 'debug.log');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

export function debugLog(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logLine = data 
    ? `[${timestamp}] ${message} ${JSON.stringify(data, null, 2)}\n`
    : `[${timestamp}] ${message}\n`;
  
  // Write to file
  fs.appendFileSync(DEBUG_LOG_FILE, logLine);
  
  // Also log to console
  console.log(message, data || '');
}

export function clearDebugLog() {
  if (fs.existsSync(DEBUG_LOG_FILE)) {
    fs.unlinkSync(DEBUG_LOG_FILE);
  }
}
