// Metro config that lets the mobile app import the repo's shared, platform-neutral
// modules (types, business logic, seed data, adapter) from ../../src via @shared/*.
// Native npm packages resolve from apps/mobile/node_modules first (nodeModulesPaths),
// so the web app's React 18 tree is not mixed in.
// getSentryExpoConfig is Expo's default config plus debug ids in the bundle, which
// let Sentry match crash stack traces to source maps. Harmless without Sentry.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const path = require('path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '../..');

const config = getSentryExpoConfig(projectRoot);
config.watchFolders = [repoRoot, path.resolve(repoRoot, 'src')];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
// Ignore macOS AppleDouble files ("._name"). On non-Apple filesystems such as an
// exFAT external drive, macOS writes one beside every file; Expo Router would
// otherwise try to load e.g. app/._auth.tsx as a screen and the bundle fails.
const appleDouble = /(^|[\\/])\._[^\\/]*$/;
const existing = config.resolver.blockList;
config.resolver.blockList = existing
  ? [].concat(existing, appleDouble)
  : appleDouble;

module.exports = config;
