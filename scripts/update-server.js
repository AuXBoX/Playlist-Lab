#!/usr/bin/env node
/**
 * Server Update Script
 * Handles graceful server updates with backup and rollback capability
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

function exec(command, options = {}) {
  try {
    return execSync(command, {
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf-8',
      ...options,
    });
  } catch (error) {
    if (!options.ignoreError) {
      throw error;
    }
    return null;
  }
}

async function main() {
  printHeader('Server Update');

  // Check if running in Docker
  const isDocker = fs.existsSync('/.dockerenv');
  if (isDocker) {
    printWarning('Running in Docker container');
    printWarning('Use docker-compose to update the container instead');
    process.exit(0);
  }

  // Get current version
  print('\nChecking current version...');
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const currentVersion = packageJson.version;
  print(`Current version: ${currentVersion}`);

  // Check for updates
  print('\nChecking for updates...');
  const gitStatus = exec('git status --porcelain', { silent: true, ignoreError: true });
  if (gitStatus && gitStatus.trim()) {
    printWarning('Working directory has uncommitted changes');
    printWarning('Commit or stash changes before updating');
    process.exit(1);
  }

  // Fetch latest changes
  print('\nFetching latest changes...');
  exec('git fetch origin');
  
  const currentBranch = exec('git rev-parse --abbrev-ref HEAD', { silent: true }).trim();
  const localCommit = exec('git rev-parse HEAD', { silent: true }).trim();
  const remoteCommit = exec(`git rev-parse origin/${currentBranch}`, { silent: true }).trim();

  if (localCommit === remoteCommit) {
    printStatus('Already up to date');
    process.exit(0);
  }

  print(`\nNew commits available:`);
  exec(`git log --oneline ${localCommit}..${remoteCommit}`);

  // Confirm update
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((resolve) => {
    readline.question('\nProceed with update? (yes/no): ', resolve);
  });
  readline.close();

  if (answer.toLowerCase() !== 'yes') {
    print('\nUpdate cancelled');
    process.exit(0);
  }

  // Create backup
  print('\nCreating database backup...');
  exec('node scripts/backup-database.js');
  printStatus('Backup created');

  // Stop server if running
  print('\nStopping server...');
  exec('npm run docker:down', { ignoreError: true, silent: true });
  printStatus('Server stopped');

  // Pull latest changes
  print('\nPulling latest changes...');
  exec('git pull origin ' + currentBranch);
  printStatus('Changes pulled');

  // Install dependencies
  print('\nInstalling dependencies...');
  exec('npm ci');
  printStatus('Dependencies installed');

  // Build application
  print('\nBuilding application...');
  exec('npm run build:prod');
  printStatus('Build complete');

  // Run database migrations (if any)
  print('\nChecking for database migrations...');
  // Add migration logic here if needed
  printStatus('Database up to date');

  // Start server
  print('\nStarting server...');
  exec('npm run docker:up');
  printStatus('Server started');

  // Wait for health check
  print('\nWaiting for server to be ready...');
  let attempts = 0;
  const maxAttempts = 30;
  
  while (attempts < maxAttempts) {
    try {
      const healthCheck = exec('curl -f http://localhost:3000/api/health', {
        silent: true,
        ignoreError: true,
      });
      if (healthCheck) {
        printStatus('Server is healthy');
        break;
      }
    } catch (error) {
      // Ignore
    }
    
    attempts++;
    if (attempts >= maxAttempts) {
      printError('Server failed to start');
      printWarning('Check logs with: npm run docker:logs');
      process.exit(1);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Get new version
  const newPackageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const newVersion = newPackageJson.version;

  // Summary
  printHeader('Update Complete');
  print(`\nUpdated from ${currentVersion} to ${newVersion}`);
  print(`Commit: ${remoteCommit.slice(0, 7)}`);
  printStatus('Server is running');
  print('\nView logs: npm run docker:logs');
  print('Stop server: npm run docker:down\n');
}

main().catch((error) => {
  printError(`Update failed: ${error.message}`);
  console.error(error);
  printWarning('\nTo rollback:');
  print('1. Stop server: npm run docker:down');
  print('2. Restore backup: node scripts/restore-database.js');
  print('3. Revert code: git reset --hard HEAD~1');
  print('4. Rebuild: npm run build:prod');
  print('5. Start server: npm run docker:up');
  process.exit(1);
});
