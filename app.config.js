const fs = require('fs');
const path = require('path');

const ASSET_DIR = path.resolve(__dirname, 'assets');
const requiredAssets = ['icon.png', 'jengaplus_enhanced.png', 'splash-icon.png'];
const missingAssets = requiredAssets.filter((file) => !fs.existsSync(path.join(ASSET_DIR, file)));
if (missingAssets.length > 0) {
  console.warn(`Missing optional branding assets: ${missingAssets.join(', ')}`);
}

module.exports = ({ config }) => {
  const baseConfig = config.expo || config;
  const extraConfig = baseConfig.extra || {};
  const easConfig = extraConfig.eas || {};

  const expoConfig = {
    ...baseConfig,
    extra: {
      ...extraConfig,
      eas: {
        ...easConfig,
        projectId: 'b1d39f00-ebb2-472a-852d-05b0bfdc4181',
      },
    },
  };

  if (config.expo) {
    return {
      ...config,
      expo: expoConfig,
    };
  }

  return expoConfig;
};
