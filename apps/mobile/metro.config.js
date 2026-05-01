const path = require('path');
const fs = require('fs');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const config = getDefaultConfig(projectRoot);
const projectNodeModules = path.resolve(projectRoot, 'node_modules');
const workspaceNodeModules = path.resolve(workspaceRoot, 'node_modules');

config.projectRoot = projectRoot;
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  projectNodeModules,
  workspaceNodeModules,
  ...collectPnpmPackageNodeModules(projectNodeModules),
  ...collectPnpmPackageNodeModules(workspaceNodeModules),
  ...collectPnpmVirtualStoreNodeModules(workspaceNodeModules)
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

function collectPnpmPackageNodeModules(nodeModulesRoot) {
  if (!fs.existsSync(nodeModulesRoot)) {
    return [];
  }

  const packageNames = fs.readdirSync(nodeModulesRoot).flatMap((entry) => {
    if (entry.startsWith('.')) {
      return [];
    }

    if (!entry.startsWith('@')) {
      return [entry];
    }

    const scopeRoot = path.join(nodeModulesRoot, entry);

    if (!fs.existsSync(scopeRoot)) {
      return [];
    }

    return fs
      .readdirSync(scopeRoot)
      .filter((scopedEntry) => !scopedEntry.startsWith('.'))
      .map((scopedEntry) => `${entry}/${scopedEntry}`);
  });

  return [
    ...new Set(
      packageNames
        .map((packageName) => findRealNodeModulesPath(nodeModulesRoot, packageName))
        .filter(Boolean)
    )
  ];
}

function findRealNodeModulesPath(nodeModulesRoot, packageName) {
  const packagePath = path.join(nodeModulesRoot, ...packageName.split('/'));

  if (!fs.existsSync(packagePath)) {
    return null;
  }

  const realPath = fs.realpathSync(packagePath);
  const segments = realPath.split(path.sep);
  const nodeModulesIndex = segments.lastIndexOf('node_modules');

  if (nodeModulesIndex === -1) {
    return null;
  }

  return segments.slice(0, nodeModulesIndex + 1).join(path.sep);
}

function collectPnpmVirtualStoreNodeModules(nodeModulesRoot) {
  const pnpmRoot = path.join(nodeModulesRoot, '.pnpm');

  if (!fs.existsSync(pnpmRoot)) {
    return [];
  }

  return fs
    .readdirSync(pnpmRoot)
    .map((entry) => path.join(pnpmRoot, entry, 'node_modules'))
    .filter((entryNodeModules) => fs.existsSync(entryNodeModules));
}
