import { openDatabaseSync } from 'expo-sqlite';

/**
 * Single shared connection. enableChangeListener powers useLiveQuery's reactivity.
 * Call initDatabase() (src/db/migrations.ts) before any query.
 */
export const db = openDatabaseSync('gym.db', { enableChangeListener: true });
