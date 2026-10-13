import { randomUUID } from 'expo-crypto';

/** Client-generated UUID v4 for every synced row and every outbox mutation. */
export const newId = (): string => randomUUID();
