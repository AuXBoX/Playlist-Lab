const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'build');
const iconPng = path.join(buildDir, 'icon.png');
const iconIco = path.join(buildDir, 'icon.ico');

console.log('Creating Windows ICO file from PNG...');
console.log('Source:', iconPng);
console.log('Output:', iconIco);

// png-to-ico exports default function
const convertFn = pngToIco.default || pngToIco;
convertFn(iconPng)
  .then(buf => {
    fs.writeFileSync(iconIco, buf);
    console.log('✓ ICO file created successfully');
    console.log('Size:', buf.length, 'bytes');
  })
  .catch(err => {
    console.error('✗ Failed to create ICO:', err.message);
    process.exit(1);
  });
