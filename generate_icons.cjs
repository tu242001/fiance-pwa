// Run: node generate_icons.cjs
// Requires: npm install sharp
// Or just use any online SVG-to-PNG converter and save as icons/icon-192.png and icons/icon-512.png

const fs = require('fs');
const path = require('path');

const svg = fs.readFileSync(path.join(__dirname, 'public/icons/icon.svg'), 'utf8');

try {
  const sharp = require('sharp');
  const buf = Buffer.from(svg);
  sharp(buf).resize(192, 192).png().toFile('public/icons/icon-192.png', () => console.log('192 done'));
  sharp(buf).resize(512, 512).png().toFile('public/icons/icon-512.png', () => console.log('512 done'));
} catch(e) {
  console.log('sharp not installed. Please manually convert public/icons/icon.svg to:');
  console.log('  public/icons/icon-192.png (192x192)');
  console.log('  public/icons/icon-512.png (512x512)');
  console.log('Use: https://svgtopng.com or similar tool');
}
