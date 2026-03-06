import fs from 'fs';
import path from 'path';

// Use LOG_DIR environment variable or fallback to a relative path
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../../logs');
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
