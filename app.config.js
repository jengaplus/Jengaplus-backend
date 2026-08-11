const fs = require('fs');
const path = require('path');

const ASSET_DIR = path.resolve(__dirname, 'assets');
const SPLASH_CANDIDATES = ['jengaplus_enhanced.png', 'splash-icon.png'];

const splashImage = SPLASH_CANDIDATES.find((file) =>
  fs.existsSync(path.join(ASSET_DIR, file))
);

module.exports = ({ config }) => {
  return {
    ...config,
    expo: {
      ...config.expo,
      splash: {
        image: splashImage ? `./assets/${splashImage}` : './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
      },
    },
  };
};
