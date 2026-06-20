import winston from 'winston';
import path from 'path';
import os from 'os';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Determine log directory:
// 1. Use LOG_DIR env var if set (set by tray app to AppData location)
// 2. In production, use AppData\Playlist Lab\logs
// 3. Otherwise use ./logs in current directory
function getLogDir(): string {
  if (process.env.LOG_DIR) {
    return process.env.LOG_DIR;
  }
  
  const isProduction = process.cwd().includes('Program Files') || process.cwd().includes('Program Files (x86)');
  if (isProduction) {
    return path.join(os.homedir(), 'AppData', 'Roaming', 'Playlist Lab', 'logs');
  }
  
  return './logs';
}

const LOG_DIR = getLogDir();

// Create logger instance
export const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'playlist-lab-server' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      ),
    }),
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// If we're not in production, log to console with simpler format
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}
