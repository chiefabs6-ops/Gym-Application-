import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Mobile unit/integration tests (ROADMAP 1.5). Runs in Node: app code executes its REAL SQL against
 * Node's built-in SQLite through an expo-sqlite-compatible adapter; other native modules are
 * replaced by small in-memory fakes (see test/mocks).
 */
const mock = (file: string) => fileURLToPath(new URL(`./test/mocks/${file}`, import.meta.url).href);

export default defineConfig({
  define: { __DEV__: false },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
  resolve: {
    alias: [
      { find: /^expo-sqlite\/kv-store$/, replacement: mock('kvStore.ts') },
      { find: /^expo-sqlite$/, replacement: mock('expoSqlite.ts') },
      { find: /^react-native$/, replacement: mock('reactNative.ts') },
      { find: /^expo-crypto$/, replacement: mock('expoCrypto.ts') },
      { find: /^expo-notifications$/, replacement: mock('expoNotifications.ts') },
      { find: /^expo-audio$/, replacement: mock('expoAudio.ts') },
      { find: /^expo-asset$/, replacement: mock('expoAsset.ts') },
      { find: /^expo-file-system$/, replacement: mock('expoFileSystem.ts') },
      { find: /^expo-sharing$/, replacement: mock('expoSharing.ts') },
      { find: /^expo-constants$/, replacement: mock('expoConstants.ts') },
      { find: /^expo-secure-store$/, replacement: mock('expoSecureStore.ts') },
      { find: /^expo-haptics$/, replacement: mock('noop.ts') },
      { find: /^expo-keep-awake$/, replacement: mock('noop.ts') },
      { find: /^@react-native-community\/netinfo$/, replacement: mock('netinfo.ts') },
    ],
  },
});
