#!/usr/bin/env node
/**
 * Generate Tray Icons for Playlist Lab Server
 * Creates PNG icons with status indicators (green/red)
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Build a 16x16 PNG icon with Playlist Lab logo and status indicator
 * @param {string} status - 'running' or 'stopped'
 * @returns {Buffer} PNG file data
 */
function buildTrayIcon(status) {
  // Icon colors
  const bgColor = status === 'running' ? { r: 34, g: 197, b: 94 } : { r: 239, g: 68, b: 68 };
  const logoColor = { r: 255, g: 255, b: 255 }; // White logo
  
  // Create 16x16 icon with logo and colored background
  const width = 16;
  const height = 16;
  
  // Create pixel data (RGBA format)
  const pixels = new Array(height);
  for (let y = 0; y < height; y++) {
    pixels[y] = new Array(width);
    for (let x = 0; x < width; x++) {
      // Default to background color
      pixels[y][x] = { ...bgColor, a: 255 };
    }
  }
  
  // Draw simplified Playlist Lab logo (beaker shape)
  // Top part (narrow neck)
  for (let y = 2; y < 6; y++) {
    for (let x = 6; x < 10; x++) {
      pixels[y][x] = { ...logoColor, a: 255 };
    }
  }
  
  // Bottom part (wide base - trapezoid)
  for (let y = 6; y < 14; y++) {
    const width_at_y = 4 + Math.floor((y - 6) * 0.75);
    const start_x = 8 - Math.floor(width_at_y / 2);
    const end_x = start_x + width_at_y;
    for (let x = start_x; x < end_x; x++) {
      if (x >= 0 && x < 16) {
        pixels[y][x] = { ...logoColor, a: 255 };
      }
    }
  }
  
  // Add status indicator dot in corner
  const dotColor = status === 'running' 
    ? { r: 34, g: 197, b: 94, a: 255 }   // Green
    : { r: 239, g: 68, b: 68, a: 255 };  // Red
  
  // Bottom-right corner indicator
  pixels[14][14] = dotColor;
  pixels[14][13] = dotColor;
  pixels[13][14] = dotColor;
  
  // Convert to PNG
  return pixelsToPng(pixels);
}

/**
 * Convert pixel array to PNG buffer
 */
function pixelsToPng(pixels) {
  const height = pixels.length;
  const width = pixels[0].length;
  
  // PNG signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  
  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makePngChunk('IHDR', ihdrData);
  
  // IDAT chunk - raw scanlines
  const scanlines = [];
  for (let y = 0; y < height; y++) {
    const scanline = Buffer.alloc(1 + width * 4);
    scanline[0] = 0; // filter type: None
    for (let x = 0; x < width; x++) {
      const pixel = pixels[y][x];
      const offset = 1 + x * 4;
      scanline[offset] = pixel.r;
      scanline[offset + 1] = pixel.g;
      scanline[offset + 2] = pixel.b;
      scanline[offset + 3] = pixel.a;
    }
    scanlines.push(scanline);
  }
  const raw = Buffer.concat(scanlines);
  const compressed = require('zlib').deflateSync(raw);
  const idat = makePngChunk('IDAT', compressed);
  
  // IEND chunk
  const iend = makePngChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([sig, ihdr, idat, iend]);
}

/**
 * Create PNG chunk
 */
function makePngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBytes = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf), 0);
  return Buffer.concat([len, typeBytes, data, crc]);
}

/**
 * Calculate CRC32
 */
function crc32(buf) {
  let crc = 0xffffffff;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      t[i] = c;
    }
    return t;
  })());
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Generate icons if run directly
if (require.main === module) {
  const outputDir = path.join(__dirname, 'icons');
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Generate running (green) icon
  const runningIcon = buildTrayIcon('running');
  fs.writeFileSync(path.join(outputDir, 'tray-running.png'), runningIcon);
  console.log('✓ Generated tray-running.png');
  
  // Generate stopped (red) icon
  const stoppedIcon = buildTrayIcon('stopped');
  fs.writeFileSync(path.join(outputDir, 'tray-stopped.png'), stoppedIcon);
  console.log('✓ Generated tray-stopped.png');
  
  console.log(`\nIcons saved to: ${outputDir}`);
}

module.exports = { buildTrayIcon };
