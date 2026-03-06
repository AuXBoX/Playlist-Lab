#!/usr/bin/env node
/**
 * Database Restore Script
 * Restores database from a backup file
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Configuration
const DATABASE_PATH = process.env.DATABASE_PATH || './data/playlist-lab.db';
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';

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
  printHeader('Database Restore');

  // Check if backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    printError(`Backup directory not found: ${BACKUP_DIR}`);
    process.exit(1);
  }

  // List available backups
  print('\nAvailable backups:');
  const backupFiles = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('playlist-lab-') && f.endsWith('.db'))
    .map(f => ({
      name: f,
      path: path.join(BACKUP_DIR, f),
      time: fs.statSync(path.join(BACKUP_DIR, f)).mtime,
      size: fs.statSync(path.join(BACKUP_DIR, f)).size,
    }))
    .sort((a, b) => b.time.getTime() - a.time.getTime());

  if (backupFiles.length === 0) {
    printError('No backups found');
    process.exit(1);
  }

  backupFiles.forEach((file, index) => {
    print(`  ${index + 1}. ${file.name}`);
    print(`     Date: ${file.time.toLocaleString()}`);
    print(`     Size: ${formatBytes(file.size)}`);
  });

  // Get user selection
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const selection = await new Promise((resolve) => {
    readline.question(`\nSelect backup to restore (1-${backupFiles.length}): `, resolve);
  });

  const selectedIndex = parseInt(selection) - 1;
  if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= backupFiles.length) {
    readline.close();
    printError('Invalid selection');
    process.exit(1);
  }

  const selectedBackup = backupFiles[selectedIndex];
  print(`\nSelected: ${selectedBackup.name}`);

  // Confirm restore
  const confirm = await new Promise((resolve) => {
    readline.question('This will REPLACE the current database. Continue? (yes/no): ', resolve);
  });
  readline.close();

  if (confirm.toLowerCase() !== 'yes') {
    print('\nRestore cancelled');
    process.exit(0);
  }

  // Backup current database if it exists
  if (fs.existsSync(DATABASE_PATH)) {
    const currentBackupPath = `${DATABASE_PATH}.before-restore.${Date.now()}`;
    print(`\nBacking up current database to: ${currentBackupPath}`);
    fs.copyFileSync(DATABASE_PATH, currentBackupPath);
    printStatus('Current database backed up');
  }

  // Restore backup
  print('\nRestoring backup...');
  fs.copyFileSync(selectedBackup.path, DATABASE_PATH);
  printStatus('Backup restored');

  // Verify restored database
  print('\nVerifying restored database...');
  try {
    const db = new Database(DATABASE_PATH, { readonly: true });
    
    const stats = {
      users: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
      playlists: db.prepare('SELECT COUNT(*) as count FROM playlists').get().count,
      schedules: db.prepare('SELECT COUNT(*) as count FROM schedules').get().count,
      missingTracks: db.prepare('SELECT COUNT(*) as count FROM missing_tracks').get().count,
      cachedPlaylists: db.prepare('SELECT COUNT(*) as count FROM cached_playlists').get().count,
    };
    
    db.close();
    printStatus('Database verified');

    // Summary
    printHeader('Restore Complete');
    print(`\nRestored from: ${selectedBackup.name}`);
    print(`Backup date: ${selectedBackup.time.toLocaleString()}`);
    print('\nDatabase contents:');
    print(`  Users: ${stats.users}`);
    print(`  Playlists: ${stats.playlists}`);
    print(`  Schedules: ${stats.schedules}`);
    print(`  Missing Tracks: ${stats.missingTracks}`);
    print(`  Cached Playlists: ${stats.cachedPlaylists}`);
    printStatus('Database is ready for use');
  } catch (error) {
    printError('Database verification failed');
    throw error;
  }
}

main().catch((error) => {
  printError(`Restore failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
