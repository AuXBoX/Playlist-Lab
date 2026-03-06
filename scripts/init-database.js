#!/usr/bin/env node
/**
 * Database Initialization Script
 * Creates and initializes the SQLite database with schema
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Configuration
const DATABASE_PATH = process.env.DATABASE_PATH || './data/playlist-lab.db';
const SCHEMA_PATH = path.join(__dirname, '../apps/server/src/database/schema.sql');

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

async function main() {
  printHeader('Database Initialization');

  // Check if database already exists
  const dbExists = fs.existsSync(DATABASE_PATH);
  if (dbExists) {
    printWarning(`Database already exists at: ${DATABASE_PATH}`);
    
    // Ask for confirmation
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise((resolve) => {
      readline.question('Do you want to reinitialize? This will DELETE all data! (yes/no): ', resolve);
    });
    readline.close();

    if (answer.toLowerCase() !== 'yes') {
      print('\nDatabase initialization cancelled.');
      process.exit(0);
    }

    // Backup existing database
    const backupPath = `${DATABASE_PATH}.backup.${Date.now()}`;
    print(`\nCreating backup at: ${backupPath}`);
    fs.copyFileSync(DATABASE_PATH, backupPath);
    printStatus('Backup created');

    // Remove existing database
    fs.unlinkSync(DATABASE_PATH);
    printStatus('Existing database removed');
  }

  // Ensure data directory exists
  const dataDir = path.dirname(DATABASE_PATH);
  if (!fs.existsSync(dataDir)) {
    print(`\nCreating data directory: ${dataDir}`);
    fs.mkdirSync(dataDir, { recursive: true });
    printStatus('Data directory created');
  }

  // Read schema
  print('\nReading database schema...');
  if (!fs.existsSync(SCHEMA_PATH)) {
    printError(`Schema file not found: ${SCHEMA_PATH}`);
    process.exit(1);
  }
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  printStatus('Schema loaded');

  // Create database
  print('\nCreating database...');
  const db = new Database(DATABASE_PATH);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Execute schema
  print('Executing schema...');
  db.exec(schema);
  printStatus('Schema executed');

  // Verify tables
  print('\nVerifying tables...');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  
  const expectedTables = [
    'users',
    'user_servers',
    'user_settings',
    'playlists',
    'schedules',
    'missing_tracks',
    'cached_playlists',
    'sessions',
    'admin_users',
  ];

  const tableNames = tables.map(t => t.name);
  const missingTables = expectedTables.filter(t => !tableNames.includes(t));

  if (missingTables.length > 0) {
    printError(`Missing tables: ${missingTables.join(', ')}`);
    process.exit(1);
  }

  printStatus(`All ${expectedTables.length} tables created successfully`);
  tables.forEach(table => {
    print(`  - ${table.name}`);
  });

  // Close database
  db.close();

  // Summary
  printHeader('Database Initialization Complete');
  print(`\nDatabase location: ${path.resolve(DATABASE_PATH)}`);
  print(`Database size: ${(fs.statSync(DATABASE_PATH).size / 1024).toFixed(2)} KB\n`);
  printStatus('Database is ready for use');
}

main().catch((error) => {
  printError(`Initialization failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
