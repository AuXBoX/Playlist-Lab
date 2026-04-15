#!/usr/bin/env node
/**
 * Prepare server dependencies for Windows installer
 * This script modifies package.json to use a published version of @playlist-lab/shared
 * instead of the workspace file: reference, then runs npm install
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const serverDir = path.join(__dirname, '../../../../apps/server');
const packageJsonPath = path.join(serverDir, 'package.json');
const packageJsonBackupPath = path.join(serverDir, 'package.json.backup');

console.log('Preparing server dependencies for installer...');

// Backup original package.json
fs.copyFileSync(packageJsonPath, packageJsonBackupPath);
console.log('✓ Backed up package.json');

try {
  // Read package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Replace workspace dependency with local path that will work in installed location
  // We'll copy the shared package to a location where npm can find it
  packageJson.dependencies['@playlist-lab/shared'] = 'file:../../packages/shared';
  
  // Write modified package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('✓ Modified package.json');
  
  // Install dependencies
  console.log('Installing dependencies...');
  execSync('npm install --production --no-optional --legacy-peer-deps', {
    cwd: serverDir,
    stdio: 'inherit'
  });
  console.log('✓ Dependencies installed');
  
} finally {
  // Restore original package.json
  fs.copyFileSync(packageJsonBackupPath, packageJsonPath);
  fs.unlinkSync(packageJsonBackupPath);
  console.log('✓ Restored original package.json');
}

console.log('✓ Server dependencies prepared successfully');
