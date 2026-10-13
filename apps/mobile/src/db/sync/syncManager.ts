import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { MAX_PUSH_BATCH, type Mutation, type PullResponse, type PushResponse } from '@gym/shared';
import { db } from '../client';
import { getMeta } from '../meta';
import { flushTelemetry } from '../telemetry';
import { HttpError, apiFetch, getToken } from './api';
import { applyPull } from './applyPull';

/**
 * Background sync manager (module singleton).
 *
 *   push: drain sync_queue in seq order, in batches → POST /sync/push
 *   pull: GET /sync/pull?cursor → applyPull()
 *
 * Triggers: local writes (debounced), connectivity regained, app foregrounded.
 * Transient failures (network, 5xx) retry with exponential backoff + jitter.
 * Permanent per-mutation rejections are dead-lettered (status = 'dead') so they never block the queue.
 */

const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 5 * 60_000;
const DEBOUNCE_MS = 400;

let inFlight: Promise<void> | null = null;
let rerunRequested = false;
let consecutiveFailures = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

type Listener = (status: SyncStatus) => void;
export interface SyncStatus {
  syncing: boolean;
  lastSyncedAt: number | null;
  lastError: string | null;
  nextRetryAt: number | null;
}
let status: SyncStatus = { syncing: false, lastSyncedAt: null, lastError: null, nextRetryAt: null };
const listeners = new Set<Listener>();

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l(status));
}

export const getSyncStatus = () => status;
export function subscribeSyncStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function backoffDelay(failures: number): number {
  const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, failures - 1));
  return exp * (0.5 + Math.random() * 0.5); // "equal jitter"
}

/** Debounced trigger. Safe to call from anywhere, any number of times. */
export function requestSync(delayMs = DEBOUNCE_MS): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runSync();
  }, delayMs);
}

export function runSync(): Promise<void> {
  if (inFlight) {
    rerunRequested = true;
    return inFlight;
  }
  inFlight = (async () => {
    const net = await NetInfo.fetch();
    if (!net.isConnected || net.isInternetReachable === false) return; // NetInfo listener resumes us
    if (!(await getToken())) return; // guest mode: outbox keeps growing until sign-in

    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    setStatus({ syncing: true, nextRetryAt: null });
    try {
      await pushAll();
      await pullAll();
      await flushTelemetry();
      consecutiveFailures = 0;
      setStatus({ syncing: false, lastSyncedAt: Date.now(), lastError: null });
    } catch (err) {
      consecutiveFailures++;
      const unauthorized = err instanceof HttpError && err.status === 401;
      const delay = backoffDelay(consecutiveFailures);
      setStatus({
        syncing: false,
        lastError: unauthorized ? 'Signed out' : String(err),
        nextRetryAt: unauthorized ? null : Date.now() + delay,
      });
      if (!unauthorized) retryTimer = setTimeout(() => void runSync(), delay);
    }
  })().finally(() => {
    inFlight = null;
    if (rerunRequested) {
      rerunRequested = false;
      requestSync(0);
    }
  });
  return inFlight;
}

interface QueueRow {
  seq: number;
  mutation_id: string;
  table_name: Mutation['table'];
  op: Mutation['op'];
  record_id: string;
  payload: string;
  client_ts: number;
}

async function pushAll(): Promise<void> {
  for (;;) {
    const rows = await db.getAllAsync<QueueRow>(
      `SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY seq LIMIT ?`,
      [MAX_PUSH_BATCH],
    );
    if (rows.length === 0) return;

    const mutations: Mutation[] = rows.map((r) => ({
      mutation_id: r.mutation_id,
      table: r.table_name,
      op: r.op,
      record_id: r.record_id,
      payload: JSON.parse(r.payload) as Record<string, unknown>,
      client_ts: r.client_ts,
    }));

    let response: PushResponse;
    try {
      response = await apiFetch<PushResponse>('/sync/push', { method: 'POST', body: { mutations } });
    } catch (err) {
      // A 400/413 on the envelope will never succeed on retry: dead-letter the batch.
      if (err instanceof HttpError && (err.status === 400 || err.status === 413)) {
        await markDead(rows.map((r) => r.mutation_id), `batch_${err.status}`);
        continue;
      }
      await db.runAsync(
        `UPDATE sync_queue SET attempts = attempts + 1 WHERE seq BETWEEN ? AND ? AND status = 'pending'`,
        [rows[0]!.seq, rows[rows.length - 1]!.seq],
      );
      throw err;
    }

    await db.withTransactionAsync(async () => {
      for (const r of response.results) {
        if (r.status === 'rejected') {
          await db.runAsync(`UPDATE sync_queue SET status = 'dead', last_error = ? WHERE mutation_id = ?`, [
            r.reason ?? 'rejected',
            r.mutation_id,
          ]);
        } else {
          await db.runAsync(`DELETE FROM sync_queue WHERE mutation_id = ?`, [r.mutation_id]);
        }
      }
    });
  }
}

async function markDead(mutationIds: string[], reason: string) {
  await db.withTransactionAsync(async () => {
    for (const id of mutationIds) {
      await db.runAsync(`UPDATE sync_queue SET status = 'dead', last_error = ? WHERE mutation_id = ?`, [reason, id]);
    }
  });
}

async function pullAll(): Promise<void> {
  const cursor = Number((await getMeta('pull_cursor')) ?? '0');
  const response = await apiFetch<PullResponse>(`/sync/pull?cursor=${cursor}`);
  await applyPull(response);
}

/** Wire up triggers. Call once at app start; returns a disposer. */
/**
 * Offline-only mode (ROADMAP 1.3): drop outbox entries left over from before the switch.
 * The rows themselves are untouched; Phase 8.2 uploads the full local history on first sign-in.
 */
export async function clearOutbox(): Promise<number> {
  const result = await db.runAsync(`DELETE FROM sync_queue`);
  return result.changes;
}

export function startSyncManager(): () => void {
  let wasOnline = true;
  const unsubNet = NetInfo.addEventListener((state) => {
    const online = !!state.isConnected && state.isInternetReachable !== false;
    if (online && !wasOnline) {
      consecutiveFailures = 0; // fresh connectivity: retry immediately, not on the old backoff
      requestSync(0);
    }
    wasOnline = online;
  });
  const appStateSub = AppState.addEventListener('change', (next) => {
    if (next === 'active') requestSync(0);
  });
  requestSync(0);

  return () => {
    unsubNet();
    appStateSub.remove();
    if (retryTimer) clearTimeout(retryTimer);
    if (debounceTimer) clearTimeout(debounceTimer);
  };
}
