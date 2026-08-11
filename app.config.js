const appJson = require('./app.json');

module.exports = ({ config }) => {
  return {
    ...config,
    expo: {
      ...config.expo,
      splash: {
        // Change this path to use the splash image you want:
        // './assets/jengaplus_enhanced.png' or './assets/splash-icon.png'
        image: './assets/jengaplus_enhanced.png',
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
      },
    },
  };
};
