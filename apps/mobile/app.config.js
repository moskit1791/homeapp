/* global __dirname, module, process, require */
/* eslint-disable @typescript-eslint/no-require-imports */

const appJson = require('./app.json');
const fs = require('node:fs');
const path = require('node:path');

module.exports = () => {
  const config = appJson.expo;
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
  const projectId = process.env.EXPO_PROJECT_ID || config.extra?.eas?.projectId;
  const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const googleServicesFile = resolveOptionalFile(
    process.env.GOOGLE_SERVICES_JSON || './google-services.json'
  );

  return {
    ...config,
    owner: process.env.EXPO_OWNER || config.owner || 'moskit17',
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {})
    },
    extra: {
      ...config.extra,
      apiUrl,
      ...(googleAndroidClientId ? { googleAndroidClientId } : {}),
      ...(googleIosClientId ? { googleIosClientId } : {}),
      ...(googleWebClientId ? { googleWebClientId } : {}),
      ...(projectId
        ? {
            eas: {
              ...(config.extra?.eas ?? {}),
              projectId
            },
            projectId
          }
        : {})
    }
  };
};

function resolveOptionalFile(filePath) {
  const absolutePath = path.resolve(__dirname, filePath);

  return fs.existsSync(absolutePath) ? filePath : undefined;
}
