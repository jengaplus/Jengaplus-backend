const fs = require('fs');
const path = require('path');

const ASSET_DIR = path.resolve(__dirname, 'assets');
const SPLASH_CANDIDATES = ['jengaplus_enhanced.png', 'splash-icon.png'];

const splashImage = SPLASH_CANDIDATES.find((file) =>
  fs.existsSync(path.join(ASSET_DIR, file))
);

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
    splash: {
      ...(baseConfig.splash || {}),
      image: splashImage ? `./assets/${splashImage}` : (baseConfig.splash?.image || './assets/splash-icon.png'),
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
