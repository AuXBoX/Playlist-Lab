#!/usr/bin/env node
/**
 * Icon Generation Script for Playlist Lab
 * 
 * Generates PNG icons at various sizes from the SVG logo.
 * Requires: npm install sharp
 * 
 * Usage: node scripts/generate-icons.js
 * 
 * Outputs:
 *   apps/web/public/  - favicon-16x16.png, favicon-32x32.png, icon-192.png, icon-512.png, apple-touch-icon.png
 *   apps/mobile/assets/ - icon.png (1024x1024), adaptive-icon.png, splash.png, favicon.png
 *   apps/desktop/      - icon.png (512x512)
 */

const fs = require('fs');
const path = require('path');

async function generateIcons() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('sharp not installed. Run: npm install sharp');
    console.log('Alternatively, use an online SVG-to-PNG converter with apps/web/public/logo.svg');
    process.exit(1);
  }

  const svgPath = path.join(__dirname, '..', 'apps', 'web', 'public', 'logo.svg');
  const svg = fs.readFileSync(svgPath);

  const targets = [
    // Web
    { path: 'apps/web/public/favicon-16x16.png', size: 16 },
    { path: 'apps/web/public/favicon-32x32.png', size: 32 },
    { path: 'apps/web/public/favicon_16x16.png', size: 16 },
    { path: 'apps/web/public/favicon_32x32.png', size: 32 },
    { path: 'apps/web/public/icon-192.png', size: 192 },
    { path: 'apps/web/public/icon-512.png', size: 512 },
    { path: 'apps/web/public/icon_192x192.png', size: 192 },
    { path: 'apps/web/public/icon_512x512.png', size: 512 },
    { path: 'apps/web/public/apple-touch-icon.png', size: 180 },
    { path: 'apps/web/public/apple_touch_180x180.png', size: 180 },
    // Mobile
    { path: 'apps/mobile/assets/icon.png', size: 1024 },
    { path: 'apps/mobile/assets/icon-ios.png', size: 1024 },
    { path: 'apps/mobile/assets/adaptive-icon.png', size: 1024 },
    { path: 'apps/mobile/assets/favicon.png', size: 48 },
    { path: 'apps/mobile/assets/notification-icon.png', size: 96 },
  ];

  for (const target of targets) {
    const outPath = path.join(__dirname, '..', target.path);
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    await sharp(svg)
      .resize(target.size, target.size)
      .png()
      .toFile(outPath);

    console.log(`Generated ${target.path} (${target.size}x${target.size})`);
  }

  console.log('Done. Icon generation complete.');
}

generateIcons().catch(console.error);
