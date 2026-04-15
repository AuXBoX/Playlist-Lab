#!/usr/bin/env node
/**
 * Prepare server dependencies for Windows installer
 * This script ensures node_modules is properly set up with the shared package
 * resolved as a real directory, not a symlink
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(__dirname, '../../../..');
const serverDir = path.join(projectRoot, 'apps/server');
const sharedDir = path.join(projectRoot, 'packages/shared');
const serverNodeModules = path.join(serverDir, 'node_modules');
const sharedInNodeModules = path.join(serverNodeModules, '@playlist-lab', 'shared');

console.log('Preparing server dependencies for installer...');
console.log('Project root:', projectRoot);
console.log('Server dir:', serverDir);
console.log('Shared dir:', sharedDir);

// Step 1: Run npm install to get all dependencies
console.log('\n[1/3] Installing server dependencies...');
try {
  execSync('npm install --production --no-optional --legacy-peer-deps', {
    cwd: serverDir,
    stdio: 'inherit'
  });
  console.log('✓ Dependencies installed');
} catch (error) {
  console.error('✗ Failed to install dependencies');
  process.exit(1);
}

// Step 2: Remove the symlink/reference to @playlist-lab/shared
console.log('\n[2/3] Removing workspace symlink...');
const playlistLabDir = path.join(serverNodeModules, '@playlist-lab');
if (fs.existsSync(sharedInNodeModules)) {
  // Remove the symlink or directory
  fs.rmSync(sharedInNodeModules, { recursive: true, force: true });
  console.log('✓ Removed @playlist-lab/shared symlink');
}

// Step 3: Copy the actual shared package files
console.log('\n[3/3] Copying shared package as real directory...');
if (!fs.existsSync(playlistLabDir)) {
  fs.mkdirSync(playlistLabDir, { recursive: true });
}

// Copy shared package dist and package.json
const sharedDistSrc = path.join(sharedDir, 'dist');
const sharedDistDest = path.join(sharedInNodeModules, 'dist');
const sharedPkgSrc = path.join(sharedDir, 'package.json');
const sharedPkgDest = path.join(sharedInNodeModules, 'package.json');

if (!fs.existsSync(sharedDistSrc)) {
  console.error('✗ Shared package dist not found. Did you build it?');
  process.exit(1);
}

// Create shared directory
fs.mkdirSync(sharedInNodeModules, { recursive: true });

// Copy dist directory
copyRecursive(sharedDistSrc, sharedDistDest);
console.log('✓ Copied shared/dist');

// Copy package.json
fs.copyFileSync(sharedPkgSrc, sharedPkgDest);
console.log('✓ Copied shared/package.json');

console.log('\n✓ Server dependencies prepared successfully');
console.log('✓ node_modules is ready for installer packaging');

// Helper function to copy directories recursively
function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
