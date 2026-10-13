import Storage from 'expo-sqlite/kv-store';
import { createJSONStorage } from 'zustand/middleware';

/** Zustand persistence backed by SQLite's key-value store (survives process death). */
export const kvStorage = createJSONStorage(() => Storage);
