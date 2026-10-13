import { db } from './client';
import { HttpError, apiFetch } from './sync/api';

export interface TelemetrySample {
  t: number;
  lat: number | null;
  lng: number | null;
  altitude_m: number | null;
  heart_rate: number | null;
}

const UPLOAD_BATCH = 2_000;

/** Called at sensor rate (≈1 Hz). Duplicate timestamps are ignored. */
export async function recordTelemetry(sessionId: string, s: TelemetrySample): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO telemetry_points (session_id, recorded_at, lat, lng, altitude_m, heart_rate)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, s.t, s.lat, s.lng, s.altitude_m, s.heart_rate],
  );
}

/**
 * Uploads pending samples in batches. Skips sessions whose own row hasn't reached the
 * server yet (still in the outbox), since the server requires the session to exist.
 */
export async function flushTelemetry(): Promise<void> {
  const sessions = await db.getAllAsync<{ session_id: string }>(
    `SELECT DISTINCT t.session_id FROM telemetry_points t
     WHERE t.uploaded = 0
       AND NOT EXISTS (SELECT 1 FROM sync_queue q WHERE q.record_id = t.session_id AND q.status = 'pending')`,
  );

  for (const { session_id } of sessions) {
    for (;;) {
      const rows = await db.getAllAsync<{ recorded_at: number } & Omit<TelemetrySample, 't'>>(
        `SELECT recorded_at, lat, lng, altitude_m, heart_rate FROM telemetry_points
         WHERE session_id = ? AND uploaded = 0 ORDER BY recorded_at LIMIT ?`,
        [session_id, UPLOAD_BATCH],
      );
      if (rows.length === 0) break;

      try {
        await apiFetch(`/telemetry/${session_id}`, {
          method: 'POST',
          body: { points: rows.map(({ recorded_at, ...rest }) => ({ t: recorded_at, ...rest })) },
        });
      } catch (err) {
        // Session will never exist server-side (e.g. its create was dead-lettered): park the samples.
        if (err instanceof HttpError && err.status === 404) {
          await db.runAsync(`UPDATE telemetry_points SET uploaded = 2 WHERE session_id = ?`, [session_id]);
          break;
        }
        throw err;
      }
      await db.runAsync(
        `UPDATE telemetry_points SET uploaded = 1 WHERE session_id = ? AND uploaded = 0 AND recorded_at <= ?`,
        [session_id, rows[rows.length - 1]!.recorded_at],
      );
    }
  }
}
