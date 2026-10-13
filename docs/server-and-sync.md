# Server, database and sync (deferred to ROADMAP Phase 8)

## Commands (run from repo root)

| Task | Command |
|---|---|
| Start Postgres+Timescale and Redis | `npm run infra:up` (docker compose) |
| Migrate DB (+ create hypertable) | `npm run db:migrate` |
| Seed canonical exercises | `npm run db:seed` |
| API (watch) | `npm run dev:server` → http://localhost:3000 |
| BullMQ workers (watch) | `npm run dev:worker` |

First-time env: copy `apps/server/.env.example` → `apps/server/.env` and `apps/mobile/.env.example` → `apps/mobile/.env`.
On the Android emulator the host is `10.0.2.2`; on a physical device use your LAN IP.

## Sync protocol
- `POST /sync/push {mutations[]}` → per-mutation `applied | stale | rejected`.
  Server bumps `users.sync_version` first (row lock → a user's pushes are serialised), stamps every written row
  with that `server_version`, all in one transaction.
- `GET /sync/pull?cursor=N` → all rows with `server_version > N`, read under REPEATABLE READ; returns new cursor.
- Conflict rules live in **one function**: `resolveWrite()` in `packages/shared/src/sync.ts`, used by both sides:
  - LWW on `updated_at` (>= so replays are idempotent) for users, exercises, templates, sessions, session_exercises.
  - `sets` are **append-only**: a create never overwrites an existing row, so sets logged on two devices are unioned.
    Edits to one set are still LWW.
  - Tombstones always win; deleted rows are never resurrected.
- Client pull skips rows with a pending outbox entry (local wins until pushed).
- `SyncManager` (`apps/mobile/src/db/sync/syncManager.ts`): triggered by writes (debounced), NetInfo reconnect,
  app foreground. Exponential backoff with jitter (1s → 5min). `rejected` mutations → `status='dead'` (never block
  the queue). 401 stops retrying until sign-in.
- Telemetry (GPS/HR) is **not** row-synced: batched to `POST /telemetry/:sessionId`, idempotent on
  `(session_id, recorded_at)`, stored in a TimescaleDB hypertable.
- Guest mode: a local user id is created on first launch; `/auth/register` accepts that `id` so offline data keeps
  its owner. Logging into a different existing account re-owns local rows (`adoptServerUser`).
- Turning sync on later requires uploading the full local history on first sign-in (ROADMAP 8.2), since nothing was
  queued while offline-only.

## Server conventions
- Validate every request body/query with zod; `ZodError` → 400 via the global error handler.
- Long or fan-out work goes to BullMQ (`apps/server/src/services/queue`), never inline in a request.
  Jobs must be idempotent (they retry with exponential backoff). Custom `jobId`s must not contain `:`.
- Redis holds ephemeral state only (active-workout snapshot, queues). Postgres is the durable store.
- Prisma schema: `apps/server/src/db/schema.prisma`; migrations in `apps/server/src/db/migrations`.
  The hypertable is created by `src/db/setup-timescale.ts` (idempotent; runs after every migrate).
- The server recomputes authoritative PRs asynchronously (BullMQ `recompute-prs`), from full history (idempotent).

## Known gaps
- `/sync/pull` isn't paginated (fine for normal use; large first syncs need a snapshot endpoint).
- No refresh tokens (30-day JWT). No follow graph, so social fan-out is a stub.
