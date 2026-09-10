// Metro config that lets the mobile app import the repo's shared, platform-neutral
// modules (types, business logic, seed data, adapter) from ../../src via @shared/*.
// Native npm packages resolve from apps/mobile/node_modules first (nodeModulesPaths),
// so the web app's React 18 tree is not mixed in.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [repoRoot, path.resolve(repoRoot, 'src')];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

module.exports = config;
