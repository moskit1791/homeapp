#!/usr/bin/env node

const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

function absolutizeOption(optionName) {
  const optionIndex = process.argv.indexOf(optionName);

  if (optionIndex === -1) {
    return;
  }

  const valueIndex = optionIndex + 1;
  const value = process.argv[valueIndex];

  if (!value || path.isAbsolute(value)) {
    return;
  }

  process.argv[valueIndex] = path.resolve(projectRoot, value);
}

absolutizeOption('--config');
absolutizeOption('--entry-file');

const expoPackageJson = require.resolve('expo/package.json');
const expoCliBin = require.resolve('@expo/cli/build/bin/cli', {
  paths: [path.dirname(expoPackageJson)]
});

require(expoCliBin);
