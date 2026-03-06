#!/usr/bin/env node
/**
 * Database Backup Script
 * Creates a backup of the SQLite database with optional compression
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Database = require('better-sqlite3');

// Configuration
const DATABASE_PATH = process.env.DATABASE_PATH || './data/playlist-lab.db';
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const KEEP_BACKUPS = parseInt(process.env.KEEP_BACKUPS || '7');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function print(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function printStatus(message) {
  print(`[✓] ${message}`, colors.green);
}

function printError(message) {
  print(`[✗] ${message}`, colors.red);
}

function printWarning(message) {
  print(`[!] ${message}`, colors.yellow);
}

function printHeader(message) {
  print(`\n${'='.repeat(50)}`, colors.cyan);
  print(message, colors.cyan);
  print('='.repeat(50), colors.cyan);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

async function main() {
  printHeader('Database Backup');

  // Check if database exists
  if (!fs.existsSync(DATABASE_PATH)) {
    printError(`Database not found: ${DATABASE_PATH}`);
    process.exit(1);
  }

  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    print(`\nCreating backup directory: ${BACKUP_DIR}`);
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    printStatus('Backup directory created');
  }

  // Generate backup filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupFilename = `playlist-lab-${timestamp}.db`;
  const backupPath = path.join(BACKUP_DIR, backupFilename);

  // Get database stats before backup
  print('\nGathering database statistics...');
  const db = new Database(DATABASE_PATH, { readonly: true });
  
  const stats = {
    users: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
    playlists: db.prepare('SELECT COUNT(*) as count FROM playlists').get().count,
    schedules: db.prepare('SELECT COUNT(*) as count FROM schedules').get().count,
    missingTracks: db.prepare('SELECT COUNT(*) as count FROM missing_tracks').get().count,
    cachedPlaylists: db.prepare('SELECT COUNT(*) as count FROM cached_playlists').get().count,
  };
  
  db.close();
  printStatus('Statistics gathered');

  // Create backup using SQLite backup API
  print('\nCreating backup...');
  const sourceDb = new Database(DATABASE_PATH, { readonly: true });
  const backupDb = new Database(backupPath);
  
  sourceDb.backup(backupDb);
  
  sourceDb.close();
  backupDb.close();
  
  printStatus('Backup created');

  // Get backup file size
  const backupSize = fs.statSync(backupPath).size;
  const originalSize = fs.statSync(DATABASE_PATH).size;

  // Vacuum backup to reduce size
  print('\nOptimizing backup...');
  const optimizeDb = new Database(backupPath);
  optimizeDb.pragma('vacuum');
  optimizeDb.close();
  
  const optimizedSize = fs.statSync(backupPath).size;
  printStatus('Backup optimized');

  // Clean up old backups
  print('\nCleaning up old backups...');
  const backupFiles = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('playlist-lab-') && f.endsWith('.db'))
    .map(f => ({
      name: f,
      path: path.join(BACKUP_DIR, f),
      time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);

  if (backupFiles.length > KEEP_BACKUPS) {
    const toDelete = backupFiles.slice(KEEP_BACKUPS);
    toDelete.forEach(file => {
      fs.unlinkSync(file.path);
      print(`  Deleted: ${file.name}`);
    });
    printStatus(`Removed ${toDelete.length} old backup(s)`);
  } else {
    printStatus('No old backups to remove');
  }

  // Summary
  printHeader('Backup Complete');
  print(`\nBackup location: ${path.resolve(backupPath)}`);
  print(`Original size: ${formatBytes(originalSize)}`);
  print(`Backup size: ${formatBytes(optimizedSize)}`);
  print(`Compression: ${Math.round((1 - optimizedSize / originalSize) * 100)}%`);
  print('\nDatabase contents:');
  print(`  Users: ${stats.users}`);
  print(`  Playlists: ${stats.playlists}`);
  print(`  Schedules: ${stats.schedules}`);
  print(`  Missing Tracks: ${stats.missingTracks}`);
  print(`  Cached Playlists: ${stats.cachedPlaylists}`);
  print(`\nBackups kept: ${Math.min(backupFiles.length, KEEP_BACKUPS)}`);
  printStatus('Backup successful');
}

main().catch((error) => {
  printError(`Backup failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
