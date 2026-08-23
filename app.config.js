const fs = require('fs');
const path = require('path');

const ASSET_DIR = path.resolve(__dirname, 'assets');
const requiredAssets = ['icon.png', 'jengaplus_enhanced.png', 'splash-icon.png', 'jengaplus_splash_final_1080.png'];
const missingAssets = requiredAssets.filter((file) => !fs.existsSync(path.join(ASSET_DIR, file)));
if (missingAssets.length > 0) {
  console.warn(`Missing optional branding assets: ${missingAssets.join(', ')}`);
}

// Keep Expo's static app.json (including the heis_prince EAS project link) authoritative.
module.exports = ({ config }) => config;
