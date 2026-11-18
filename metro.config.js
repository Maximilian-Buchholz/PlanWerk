const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web worker imports its wa-sqlite.wasm binary directly —
// Metro only treats that as a bundleable asset if .wasm is registered here.
config.resolver.assetExts.push('wasm');

module.exports = config;
