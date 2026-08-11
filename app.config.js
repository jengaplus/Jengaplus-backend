const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const assetDir = path.resolve(__dirname, 'assets');
  const candidateImages = ['jengaplus_enhanced.png', 'splash-icon.png'];
  const splashImage = candidateImages.find((file) => fs.existsSync(path.join(assetDir, file)));

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
