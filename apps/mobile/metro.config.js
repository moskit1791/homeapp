const path = require('path');
const fs = require('fs');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules')
];
config.resolver.disableHierarchicalLookup = true;
const singletonModules = [
  '@expo/metro-runtime',
  '@expo/vector-icons',
  'expo',
  'expo-asset',
  'expo-constants',
  'expo-font',
  'expo-linking',
  'expo-router',
  'expo-splash-screen',
  'expo-status-bar',
  'react',
  'react-native',
  'react-native-gesture-handler',
  'react-native-reanimated',
  'react-native-safe-area-context',
  'react-native-screens'
];

config.resolver.extraNodeModules = Object.fromEntries(
  singletonModules
    .map((moduleName) => [moduleName, path.resolve(projectRoot, 'node_modules', moduleName)])
    .filter(([, modulePath]) => fs.existsSync(modulePath))
);
config.resolver.blockList = [
  /.*\/android\/build\/.*/,
  /.*\\android\\build\\.*/,
  /.*\/\.cxx\/.*/,
  /.*\\\.cxx\\.*/,
  /.*\/build\/snapshot\/.*/,
  /.*\\build\\snapshot\\.*/
];

module.exports = config;
