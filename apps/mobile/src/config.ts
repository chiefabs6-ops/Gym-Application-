/**
 * Feature flags.
 *
 * CLOUD_SYNC_ENABLED (ROADMAP 1.3 / Phase 8): the app currently runs offline-only. While off:
 *  - local writes are NOT added to the sync outbox (and any old outbox entries are cleared at startup),
 *  - the sync manager never starts (no network calls at all),
 *  - sign-in / sync UI is hidden.
 * The sync code is kept intact. To turn it on later set EXPO_PUBLIC_CLOUD_SYNC=1 and, on first sign-in,
 * upload the full local history (Phase 8.2), since nothing was queued while this was off.
 */
export const CLOUD_SYNC_ENABLED = process.env.EXPO_PUBLIC_CLOUD_SYNC === '1';
