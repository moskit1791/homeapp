/* global module, process, require */
/* eslint-disable @typescript-eslint/no-require-imports */

const appJson = require('./app.json');

module.exports = () => {
  const config = appJson.expo;
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

  return {
    ...config,
    extra: {
      ...config.extra,
      apiUrl
    }
  };
};
