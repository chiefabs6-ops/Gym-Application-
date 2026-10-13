// Expo SDK 52+ auto-detects npm workspaces (watchFolders / nodeModulesPaths).
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Release builds only (`expo export:embed`, run by Gradle's createBundleReleaseJsAndAssets):
// Gradle passes the entry as `../../node_modules/expo-router/entry.js` relative to this app folder,
// but with the workspace root as server root it's resolved one level too high and the build fails.
// Serving from the app folder fixes that. The dev server (`expo start`) must keep the workspace
// root, otherwise bundle URLs like /node_modules/expo-router/entry.bundle return 404.
if (process.argv.includes('export:embed')) {
  config.server = { ...config.server, unstable_serverRoot: __dirname };
}

module.exports = withNativeWind(config, { input: './global.css' });
