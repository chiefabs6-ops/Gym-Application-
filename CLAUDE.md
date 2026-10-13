# Gym Log — offline-first workout tracker

Monorepo (npm workspaces): Expo/React Native Android app + Fastify API + BullMQ workers, sharing one sync contract.

```
apps/mobile      Expo SDK 54, expo-router, expo-sqlite, Zustand, NativeWind, lucide-react-native
apps/server      Fastify 5, Prisma 6 (Postgres + TimescaleDB), Redis, BullMQ
packages/shared  Wire schemas (zod), sync protocol, conflict resolution, Epley/PR math, canonical exercises
```

## Roadmap
**`ROADMAP.md` is the plan of record.** Work its phases in order, follow its §0 product principles and §5 cross-cutting
checklist, and tick items (with date) only after verifying them on the emulator/device.
**Current scope (2026-10-07): offline-only on the phone.** Do not start server/database/account work (`apps/server`,
Docker, sync enablement); it is deferred to ROADMAP Phase 8. Keep the existing sync code intact but unused.

## More docs (read only when relevant)
- `docs/release-apk.md`: building and installing the release APK on the phone (JAVA_HOME, prebuild, keystore, metro quirk, permissions, icons).
- `docs/server-and-sync.md`: server/DB commands, env setup, sync protocol, conflict rules, server conventions. Read before touching sync code or `apps/server`.
- `docs/exercise-assets.md`: exercises with missing or approximate illustrations.

## Commands (run from repo root)

| Task | Command |
|---|---|
| Install everything | `npm install` (runs `prisma generate` via postinstall) |
| Mobile | `npm run dev:mobile`, then press `a` for Android |
| Typecheck all | `npm run typecheck` |
| Tests | `npm test` (vitest: `packages/shared` + `apps/mobile`; mobile runs real SQL on node:sqlite, see `apps/mobile/test/`) |
| Align Expo dep versions | `npm run deps:fix -w @gym/mobile` |

## Architecture rules (read before changing anything)

### 1. One data contract: `packages/shared/src/tables.ts`
- Column names are **snake_case and identical** in SQLite, the HTTP payloads, and Postgres (`@map`).
- Wire format: timestamps = epoch **ms** numbers, booleans = booleans, JSON columns = objects.
- **Adding/changing a synced column requires all four:** zod schema in `tables.ts` (+ `TABLE_SPECS` column lists),
  a new mobile migration in `apps/mobile/src/db/migrations.ts` (append; never edit a shipped one),
  `schema.prisma` + `prisma migrate dev`, and the camelCase field must be `snakeToCamel(column)`.
- Server-only fields (password_hash, email, server_version, sync_version) are never in the shared schemas, so they
  can't leak through `toWireRow`.

### 2. The device is the source of truth
- IDs are client-generated UUID v4 (`apps/mobile/src/db/ids.ts`). The server never generates ids for synced rows.
- **All writes to synced tables go through `apps/mobile/src/db/mutate.ts`** (`write`, `createRecord`,
  `updateRecord`, `deleteRecord`, or repositories built on them). That writes the row **and** (when
  `CLOUD_SYNC_ENABLED`) an outbox entry in `sync_queue` in one SQLite transaction. Raw `INSERT/UPDATE` on synced
  tables = the change never syncs.
- **Offline-only mode (`apps/mobile/src/config.ts`, currently ON):** `CLOUD_SYNC_ENABLED` is false unless
  `EXPO_PUBLIC_CLOUD_SYNC=1`. While false: no outbox entries, the outbox is cleared at startup, the sync manager never
  starts (verified: zero sockets), and sign-in/sync UI (`CloudAccountSection`) is hidden.
- `write()` serialises read-modify-write mutations. Never call `write()` from inside a `write()` builder (deadlock).
- Every mutation payload is a **full row snapshot** with a strictly increasing `updated_at`.
- Deletes are tombstones (`deleted_at`). Every query must filter `deleted_at IS NULL`.
- Weights are stored in kg only. Convert at the UI boundary with `useUnits()` (`src/state/settingsStore.ts`);
  never show a hard-coded "kg". User settings live in the `users` row (`unit_system` + `preferences`, see
  `packages/shared/src/settings.ts`) and are read synchronously via `getSettings()` / `useSettingsStore`.

### 3. Sync (deferred, see `docs/server-and-sync.md`)
- Conflict rules live in **one function**, `resolveWrite()` in `packages/shared/src/sync.ts`, shared by client and server.

### 4. Active workout engine
- `useActiveWorkoutStore` holds only *which* session is active + PR badges; workout data is read from SQLite via
  `useLiveQuery` (re-runs on `addDatabaseChangeListener` for the listed tables).
- Rest timer stores an absolute deadline (`endsAt`) and derives remaining time from the wall clock; completion in
  background is an OS-scheduled `expo-notifications` notification. Don't replace this with interval counting:
  Android suspends JS timers when backgrounded or asleep.
- Exercise logging types (`packages/shared/src/tracking.ts`) drive the set table (`SetRow` / `SetTableHeader`),
  PREVIOUS text (`formatSetSummary`), routine targets and PRs. Supersets: neighbours sharing `superset_group`
  (`packages/shared/src/supersets.ts`); the workout screen auto-advances within a superset and rests after the round.
- PR engine (`apps/mobile/src/services/prEngine.ts`) runs one aggregate SQL query on set completion. Its SQL
  mirrors `epley1RM` (`weight * (1 + reps/30)`) in `packages/shared/src/pr.ts`. **Change both together.**
  History detail badges use `SESSION_PR_SQL` (same file, same expression), derived on the fly so edits recompute them.
  Records depend on the exercise's `tracking_type` (`RECORD_KINDS` in pr.ts); the SQL `BEST_COLUMNS` mirrors
  `setMetrics()`. Volume only counts `countsTowardVolume` types (`volumeTypeSql` for SQL).
  Warmups and empty sets never count; no badge if there's no prior history.

### 5. Generated assets (don't hand-edit outputs)
- Rest-timer beeps: `node apps/mobile/scripts/generate-beeps.mjs` → `apps/mobile/assets/sounds/*.wav`.
- Exercise illustrations: `python apps/mobile/scripts/build-exercise-images.py` (needs Pillow, numpy, scipy) →
  `apps/mobile/assets/exercises/<exercise-id>.png` + `apps/mobile/src/generated/exerciseImages.ts`.
  Source: RepDB free tier (in-app use with attribution). Keep the "Exercise data by RepDB (repdb.co)" credit in the
  form guide and Settings screen, and keep `assets/exercises/LICENSE.md`. Never publish the images as a dataset and
  never run them through generative AI (licence terms). Do not add images from sites without a licence that allows app use.
- Form tips: `packages/shared/src/formGuides.ts`; a test enforces a guide for every canonical exercise.
- Canonical exercises: never change an id; adding/renaming one needs a form guide (test-enforced) and an entry in
  `build-exercise-images.py`. The on-device seed upserts canonical rows at every launch, so renames reach old installs.
