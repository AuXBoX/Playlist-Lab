#!/usr/bin/env node
/**
 * Production Build Script for Playlist Lab
 * Cross-platform Node.js implementation
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for terminal output
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
  printHeader('Playlist Lab - Production Build');

  // Check Node.js version
  print('\nChecking Node.js version...');
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 18) {
    printError(`Node.js 18 or higher is required. Current version: ${nodeVersion}`);
    process.exit(1);
  }
  printStatus(`Node.js version: ${nodeVersion}`);

  // Clean previous builds
  print('\nCleaning previous builds...');
  exec('npm run clean', { ignoreError: true, silent: true });
  printStatus('Clean complete');

  // Install dependencies
  print('\nInstalling dependencies...');
  exec('npm ci');
  printStatus('Dependencies installed');

  // Build shared package
  print('\nBuilding shared package...');
  exec('npm run build --workspace=packages/shared');
  printStatus('Shared package built');

  // Build server
  print('\nBuilding server...');
  exec('npm run build --workspace=apps/server');
  printStatus('Server built');

  // Build web client
  print('\nBuilding web client...');
  exec('npm run build --workspace=apps/web');
  printStatus('Web client built');

  // Check for EAS CLI
  print('\nChecking for EAS CLI...');
  const hasEAS = exec('eas --version', { ignoreError: true, silent: true });
  if (hasEAS) {
    printWarning('EAS CLI detected. Mobile builds can be triggered separately.');
    printWarning("Run 'npm run build:mobile' to build mobile apps with EAS Build");
  } else {
    printWarning('EAS CLI not found. Mobile builds skipped.');
    printWarning('Install with: npm install -g eas-cli');
  }

  // Create build info
  print('\nCreating build info...');
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const buildVersion = packageJson.version;
  const buildDate = new Date().toISOString();
  const buildCommit = exec('git rev-parse --short HEAD', {
    ignoreError: true,
    silent: true,
  })?.trim() || 'unknown';

  const buildInfo = {
    version: buildVersion,
    buildDate,
    commit: buildCommit,
    nodeVersion: process.version,
    npmVersion: exec('npm -v', { silent: true }).trim(),
  };

  fs.writeFileSync('build-info.json', JSON.stringify(buildInfo, null, 2));
  printStatus('Build info created: build-info.json');

  // Summary
  printHeader('Build Summary');
  print(`\nVersion: ${buildVersion}`);
  print(`Commit: ${buildCommit}`);
  print(`Build Date: ${buildDate}\n`);
  printStatus('Server: apps/server/dist/');
  printStatus('Web Client: apps/web/dist/');
  
  printHeader('Production build complete!');
}

main().catch((error) => {
  printError(`Build failed: ${error.message}`);
  process.exit(1);
});
