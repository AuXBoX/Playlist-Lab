#!/usr/bin/env node
/**
 * Update version numbers in all package.json files
 * Usage: node update-version.js <version>
 * Example: node update-version.js 1.2.2
 */

const fs = require('fs');
const path = require('path');

const version = process.argv[2];

if (!version) {
  console.error('Error: Version number required');
  console.error('Usage: node update-version.js <version>');
  console.error('Example: node update-version.js 1.2.2');
  process.exit(1);
}

// Validate version format (semver)
if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/.test(version)) {
  console.error(`Error: Invalid version format: ${version}`);
  console.error('Expected format: X.Y.Z or X.Y.Z-prerelease');
  process.exit(1);
}

console.log(`Updating all package.json files to version ${version}...`);

// List of all package.json files to update
const packageFiles = [
  'package.json',
  'apps/server/package.json',
  'apps/web/package.json',
  'apps/desktop/package.json',
  'packages/shared/package.json',
];

let updatedCount = 0;
let errorCount = 0;

for (const file of packageFiles) {
  const filePath = path.resolve(process.cwd(), file);
  
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Skipping ${file} (not found)`);
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const pkg = JSON.parse(content);
    
    const oldVersion = pkg.version;
    pkg.version = version;
    
    // Write back with proper formatting (2 spaces, newline at end)
    fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    
    console.log(`✓ Updated ${file}: ${oldVersion} → ${version}`);
    updatedCount++;
  } catch (error) {
    console.error(`✗ Failed to update ${file}: ${error.message}`);
    errorCount++;
  }
}

console.log(`\nSummary: ${updatedCount} updated, ${errorCount} errors`);

if (errorCount > 0) {
  process.exit(1);
}

console.log('✓ All package.json files updated successfully');
