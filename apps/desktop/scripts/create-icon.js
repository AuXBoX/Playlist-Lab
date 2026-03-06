const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// This script creates a proper Windows ICO file from PNG
// ICO files need multiple sizes embedded: 16, 32, 48, 256

const buildDir = path.join(__dirname, '..', 'build');
const iconPng = path.join(buildDir, 'icon.png');
const iconIco = path.join(buildDir, 'icon.ico');

console.log('Creating Windows ICO file from PNG...');

// Check if we have ImageMagick
try {
  execSync('magick -version', { stdio: 'ignore' });
  console.log('Using ImageMagick to create ICO...');
  
  // Create ICO with multiple sizes
  execSync(`magick "${iconPng}" -define icon:auto-resize=256,128,96,64,48,32,16 "${iconIco}"`, {
    stdio: 'inherit'
  });
  
  console.log('✓ ICO file created successfully');
} catch (error) {
  console.log('ImageMagick not found. Trying alternative method...');
  
  // Try using png-to-ico package
  try {
    const pngToIco = require('png-to-ico');
    
    pngToIco(iconPng)
      .then(buf => {
        fs.writeFileSync(iconIco, buf);
        console.log('✓ ICO file created successfully');
      })
      .catch(err => {
        console.error('Failed to create ICO:', err.message);
        console.log('\nPlease install ImageMagick or run: npm install png-to-ico');
        process.exit(1);
      });
  } catch (err) {
    console.error('\nCould not create ICO file automatically.');
    console.log('\nOptions:');
    console.log('1. Install ImageMagick: https://imagemagick.org/script/download.php');
    console.log('2. Or install png-to-ico: npm install png-to-ico');
    console.log('3. Or use an online converter: https://www.icoconverter.com/');
    process.exit(1);
  }
}
