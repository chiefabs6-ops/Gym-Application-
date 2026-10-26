# Codebase integration: where food tracking fits in Gym Log

[← Research index](README.md) · Related: [product-recommendations.md](product-recommendations.md) · [proposed-tracking-experience.md](proposed-tracking-experience.md)

Read-only inspection, 2026-10-25, at commit `74bd877` (clean tree). All paths are repo-relative. Line numbers refer to that commit.
No files were changed during this inspection. Sections 0–10 are the inventory; **section 11 is the integration analysis**
(reuse, new entities, new screens, code not to touch, risks). Section 12 at the end maps the
[MVP recommendations](product-recommendations.md#mvp--essential-for-launch) onto concrete code locations.

Key claims were spot-checked directly: route root `apps/mobile/src/app/(tabs)` (5 tabs), `db.test.ts:18` expects
`user_version` 6, `ExerciseSelector.tsx:30-31` uses `LIKE ?` + `LIMIT 300`, `app.json:27` blocks `RECORD_AUDIO`,
`ROADMAP.md:16-32` product principles.

---

## 0. Plan of record and scope

- `CLAUDE.md` says `ROADMAP.md` is the plan of record. Work its phases in order, follow §0 and §5, and tick items only after checking them on a device.
- Current scope is **offline-only on the phone** (`CLAUDE.md`, "Roadmap"). Server, DB and sync work is deferred to Phase 8 (`ROADMAP.md:480-504`).
- **ROADMAP has no nutrition content.** It never mentions food, meals, calories, kcal, macros, protein, barcodes or a camera. A grep found only "bodyweight" matches:
  - §3 competitor table stakes list "Bodyweight / measurements" (`ROADMAP.md:126`).
  - **3.5 Bodyweight & measurements** plans a new synced table `body_metrics` with columns (date, type, value) (`ROADMAP.md:402-404`, `ROADMAP.md:524`).
  - 6.2 Health Connect will read and write bodyweight (`ROADMAP.md:462`).
  - Nutrition is therefore a **new, unplanned scope item**. Per the "How to use" note (`ROADMAP.md:3-12`) and §5's last checkbox (`ROADMAP.md:514`), ROADMAP should get a new item before the work starts, plus a row in the §6 data-model table (`ROADMAP.md:516-528`). Phase 3 (in progress) and Phase 7 "Later / optional" are the natural places for it.
- **§0 product principles** (`ROADMAP.md:16-32`):
  1. Offline-first; every feature works in airplane mode.
  2. Fastest logging; minimal taps; previous values pre-filled; no blocking dialogs.
  3. No paywall on the basics.
  4. Transparent smart features.
  5. Your data is yours: export, import, no data loss.
  6. Android quality first.
  7. One design system: tokens in `tailwind.config.js` / `src/theme.ts`, bottom sheets instead of system alerts, 16px cards. No `Alert.alert`, no hard-coded colours.
- **§5 cross-cutting checklist** (`ROADMAP.md:506-514`):
  - Works in airplane mode.
  - Uses design tokens and bottom sheets.
  - Synced data goes through `mutate.ts`, schema changes follow the four-places rule, and migrations are append-only.
  - Weights are stored in kg.
  - Tests cover rule and maths logic (conversions!).
  - Verified on the emulator with a screenshot.
  - `CLAUDE.md` / ROADMAP are updated.
- Feature-design convention: earlier features have a spec and a plan under `docs/superpowers/specs/` and `docs/superpowers/plans/` (for example `2026-10-09-training-split-design.md`).

---

## 1. Frontend framework, app structure, routes, tabs

- Expo SDK 54 (`apps/mobile/package.json:21`), React 19.1.0 and RN 0.81.5 (`:40-41`), expo-router 6 (`:31`; `"main": "expo-router/entry"` `:5`), NativeWind 4 (`:39`), Zustand 5 (`:48`), reanimated 4 (`:43`), react-native-keyboard-controller (`:42`).
- `app.json`: `userInterfaceStyle: "dark"` (`apps/mobile/app.json:8`), new architecture on (`:9`), `edgeToEdgeEnabled` (`:15`), package `com.gymlog.app`, `versionCode` 2, version 0.2.0 (`:6`, `:13-14`).
- **The route root is `apps/mobile/src/app`, not `apps/mobile/app`.** Every route file:

| Route file | Renders |
|---|---|
| `apps/mobile/src/app/_layout.tsx` | Root `Stack`, boot sequence, global sheets |
| `apps/mobile/src/app/(tabs)/_layout.tsx` | Bottom `Tabs` |
| `apps/mobile/src/app/(tabs)/index.tsx` | `screens/ActiveWorkoutScreen` ("Workout") |
| `apps/mobile/src/app/(tabs)/history.tsx` | `screens/HistoryScreen` |
| `apps/mobile/src/app/(tabs)/routines.tsx` | `screens/RoutineBuilderScreen` |
| `apps/mobile/src/app/(tabs)/analytics.tsx` | `screens/AnalyticsScreen` |
| `apps/mobile/src/app/(tabs)/settings.tsx` | `screens/SettingsScreen` |
| `apps/mobile/src/app/workout/[id].tsx` | `screens/WorkoutDetailScreen` (pushed via `router.push('/workout/${id}')`, `HistoryScreen.tsx:52`) |

- The pattern is that route files are one-line re-exports and the real code lives in `src/screens/*`.
- Root layout (`apps/mobile/src/app/_layout.tsx`):
  - Boot order (`:44-56`): `initDatabase()`, then `ensureLocalUser()`, then the settings store `load()`, then store rehydrate, notifications, sounds, `runAutoBackup()`, then sync only if `CLOUD_SYNC_ENABLED`, otherwise `clearOutbox()`.
  - `Stack` with `headerShown: false` (`:101`; the background is hard-coded `#121214`).
  - App-wide sheets are mounted here: `EffortSheet`, `PlateCalculatorSheet`, `WorkoutNotificationSync`, `LockScreenMode` (`:102-105`).
  - The comment at `:95` points to a nonexistent `src/components/KeyboardAware.tsx`. Screens actually import `KeyboardAwareScrollView` from `react-native-keyboard-controller` (`SettingsScreen.tsx:6`, `RoutineBuilderScreen.tsx:42`).
- Tabs (`apps/mobile/src/app/(tabs)/_layout.tsx:4-20`): five tabs, Workout (Dumbbell), History, Routines (ClipboardList), Analytics (TrendingUp), Settings. Icons are lucide at size 22. Colours are hard-coded hex (`:9-11`) instead of `colors.*`.
- Global state stores live in `src/state/`:
  - `activeWorkoutStore`, `restTimerStore`, `intervalRunStore`, `stopwatchStore` and `settingsStore`.
  - Zustand persistence uses SQLite KV (`src/state/storage.ts:1-5`).

---

## 2. Data models (`packages/shared/src/tables.ts`)

Common sync columns on every table: `id` (uuid), `created_at`, `updated_at` (drives LWW), `deleted_at` (tombstone) (`tables.ts:13-20`). Timestamps are int epoch ms (`:10`).

| Table | Columns (beyond sync cols) | Lines |
|---|---|---|
| `users` | `display_name` (≤80, nullable), `unit_system` enum metric/imperial, `preferences` JSON record | `:22-27` |
| `exercise_definitions` | `user_id` (nullable; null = canonical), `name`, `primary_muscle`, `equipment`, `category`, `archived_at`, `tracking_type` (default `weight_reps`) | `:29-41` |
| `workout_templates` | `user_id`, `title`, `notes`, `folder`, `plan_day_id`, `template_exercises` JSON array of `templateExerciseSchema` (`:52-72`, which embeds `templateSetSchema` `:44-50`) | `:74-84` |
| `workout_sessions` | `user_id`, `template_id`, `plan_day_id`, `title`, `start_time`, `end_time`, `notes`, `rpe` | `:86-97` |
| `session_exercises` | `user_id`, `session_id`, `exercise_id`, `order_index`, `notes`, `rest_seconds`, `superset_group` | `:99-109` |
| `sets` | `user_id`, `session_exercise_id`, `order_index`, `set_type`, `weight_kg`, `reps`, `rpe`, `is_completed`, `completed_at`, `duration_s`, `distance_m`, `notes` | `:111-127` |

- Newer columns use `.nullable().default(null)` (for example `:38`, `:48-49`, `:123-126`). This keeps old rows and old backups parsing.
- `SYNC_TABLES` is ordered parent-first (`:139-146`). `SyncRowMap` is at `:149-156`. `MergeStrategy` (`lww` | `append_only`) is at `:159-165`.
- `TableSpec` (`:175-184`) has these fields: `schema`, `strategy`, `ownerColumn` (`'id' | 'user_id'`), `refs` (with `allowGlobal` for canonical refs, `:167-173`), `timestampColumns`, `booleanColumns`, `jsonColumns`.
- `TABLE_SPECS` (`:188-246`): only `sets` is `append_only` (`:239`). JSON columns are `users.preferences` and `workout_templates.template_exercises`. The only boolean column is `sets.is_completed`.
- `columnsOf(table)` = the zod shape keys (`:248`). It drives SQLite upsert column order (`apps/mobile/src/db/rows.ts:5-13`, `:27-40`).
- Enums live in `packages/shared/src/domain.ts`: `SET_TYPES` `:1`, `UNIT_SYSTEMS` `:4`, `MUSCLE_GROUPS` `:7-21`, `EQUIPMENT` `:24-34`, `EXERCISE_CATEGORIES` `:37`, and `KG_PER_LB` and its helpers `:40-43`.
- **Settings in `users.preferences`** (`packages/shared/src/settings.ts`):
  - `settingsSchema` (`:21-48`): every field uses `.catch(default)`, so partial or foreign objects always parse (`:7-11`).
  - Current keys: `default_rest_seconds`, `rest_sound`, `rest_vibration`, `keep_awake`, `previous_source`, `rest_presets`, `effort_input`, `rest_auto_start`, `warmup_rest_seconds`, `exercise_rest`, `exercise_auto_next`, `plate_profiles`, `active_plate_profile`, `workout_notification`, `lock_screen_mode`, `training_plan` (a nested zod schema from `plans.ts`).
  - `DEFAULT_SETTINGS` is at `:52`, `parseSettings` at `:77-79`, and `mergePreferences` (keeps unknown keys) at `:82-85`.
  - Weight conversion: `toDisplayWeight`, `fromDisplayWeight`, `formatWeightNumber` and `formatWeight` are at `:92-113`. Input typed in lb is stored as unrounded kg (`:87-90`).
  - The distance helpers (`distanceUnitLabel`, `formatDistanceNumber`, `fromDisplayDistance`) come from elsewhere in shared and are used by `settingsStore.ts:4-6`.
- Canonical exercises (`packages/shared/src/exercises.ts`): fixed UUIDs `gid(n)` = `00000000-0000-4000-8000-<n padded>` (`:17`). "Never change an existing id" (`:5-6`). `DEFAULT_EXERCISES` is at `:84`.
- Prisma (deferred) mirrors the six tables plus server-only `personal_records`, `workout_session_stats` and `telemetry_points` (`apps/server/src/db/schema.prisma:43-246`). The server maps tables to models through `PRISMA_MODEL: Record<SyncTable,string>` (`apps/server/src/services/sync/mapping.ts:4`) and `snakeToCamel` (`:13`).

---

## 3. Persistence (`apps/mobile/src/db/*`)

### Connection
- `client.ts:7` runs `openDatabaseSync('gym.db', { enableChangeListener: true })`, a single shared connection.

### Migrations (`migrations.ts`)
- `MIGRATIONS: string[]` (`:13-155`) is tracked with `PRAGMA user_version`. The header says "NEVER edit a shipped migration; add a new entry" (`:4-12`).
- Synced columns map to SQLite types as follows: timestamps are INTEGER ms, booleans INTEGER 0/1, JSON is TEXT.
- **There are no FOREIGN KEY constraints, on purpose** (`:10-11`).
- The **current count is 6, so `user_version` is 6**:
  - v1 creates the schema (`:14-129`): the six synced tables, `telemetry_points` (not synced, `:97-107`), `sync_queue` outbox (`:110-123`) and `sync_meta` KV (`:125-128`).
  - v2 adds `folder` and `archived_at` (`:131-134`).
  - v3 adds `tracking_type`, `duration_s` and `distance_m` (`:136-140`).
  - v4 adds `superset_group` (`:142-144`).
  - v5 adds `sets.notes` (`:146-148`).
  - v6 adds `plan_day_id` plus an index (`:150-154`).
  - A new nutrition migration would be **v7** and is appended at `:155`.
- Runner (`:175-188`): it sets WAL, then runs each pending migration in its own transaction with `PRAGMA user_version = v+1`, then calls `seedCanonicalExercises()`.
- The test asserts `user_version` = 6 (`apps/mobile/test/db.test.ts:17-18`). That test must be updated to 7.

### Canonical seed pattern (`migrations.ts:157-173`)
- It runs at every launch inside one transaction, as a raw `INSERT … ON CONFLICT(id) DO UPDATE … WHERE user_id IS NULL`. This bypasses `mutate.ts` on purpose: canonical rows are never enqueued.
- Values are `created_at = 0`, `updated_at = 0`.
- **This is the template for a bundled, read-only food database.** It does not scale to tens of thousands of rows at every launch (see §11).

### mutate.ts (the only write path for synced tables)
- Types: `NewRow<T>` / `RowPatch<T>` exclude the system columns (`:16-18`).
- `stageCreate` (`:34-38`) fills in `id` (if absent), `created_at`, `updated_at` and `deleted_at = null`.
- `stageUpdate` (`:40-44`) reads the current row and builds a full snapshot. `updated_at = max(now, prev+1)` (`:27`).
- `stageDelete` (`:46-51`) writes a tombstone: `deleted_at = updated_at = ts`. It is a no-op if the row is already deleted.
- `write(build)` (`:60-64`) serialises calls on a promise chain. **Never nest `write()`.** `commit` is at `:67`.
- `commitUnlocked` (`:70-90`):
  - **zod-validates every row against `TABLE_SPECS`** (`:74`).
  - Upserts in one transaction.
  - Inserts into `sync_queue` only when `CLOUD_SYNC_ENABLED` (`:81-86`).
- Convenience calls: `createRecord` (`:92-96`), `updateRecord` (`:98-99`), `deleteRecord` (`:101-102`). `getRecord` is at `:29-32`.

### Other modules
- **rows.ts**: `toSqliteValues` / `fromSqlite` handle booleans and JSON via `TABLE_SPECS` (`:5-23`). The cached upsert SQL is at `:25-44`.
- **ids.ts:4**: `newId = randomUUID()` (expo-crypto).
- **meta.ts**: `MetaKey` union in the `sync_meta` KV (`:3-12`), plus `getMeta`, `setMeta` and `deleteMeta`.
- **useLiveQuery.ts** (`:9-48`): `useLiveQuery<T>(sql, params, tables)` re-runs on `addDatabaseChangeListener` for the listed tables. Bursts are coalesced with a 16 ms timeout. It returns `{data, loading}`. Callers must list every table their SQL reads.
- **Repositories** (`src/db/repositories/`):
  - `exercises.ts`: `createExercise` sets `user_id: await getUserId()` (`:30-38`). Custom-only guard is `assertCustom` (`:41-44`). Archiving is at `:56-59`. Name dedupe uses `COLLATE NOCASE` (`:21-28`).
  - `workouts.ts` (431 lines): `startSession`, `addSet` and so on. Each one stages inside a single `write()` (`:22-25`, `:63-80`).
  - `templates.ts` and `plan.ts`.
  - `user.ts` (see §4).
- **Tombstones**: every query filters `deleted_at IS NULL`. Examples: `ExerciseSelector.tsx:30`, `HistoryScreen.tsx:29-31`, `AnalyticsScreen.tsx:15`.
- **config.ts:11**: `CLOUD_SYNC_ENABLED = process.env.EXPO_PUBLIC_CLOUD_SYNC === '1'`. It is currently false. The behaviour notes are at `:3-10`.

### Backup / restore (critical coupling)
- `services/backup.ts` reads **every table in `SYNC_TABLES`** for export (`:51-56`) and restores them by looping `SYNC_TABLES` with `resolveWrite` (`:151-200`).
- Restore re-owns rows when `user_id !== null`, and keeps rows with `user_id === null` (canonical) as they are (`:160-165`).
- In shared `backup.ts`, `tablesSchema` is built from `SYNC_TABLES`, with `.default([])` per table (`packages/shared/src/backup.ts:22-27`).
- `BACKUP_VERSION = 1` (`:10`). A file with a higher version is rejected (`:65`).
- The CSV export covers only workouts (`:118`).

---

## 4. Auth and user ownership

- `ensureLocalUser()` (`apps/mobile/src/db/repositories/user.ts:15-33`) creates a guest `users` row through raw `upsertRow`, which is not enqueued. It sets `unit_system: 'metric'` and `preferences: { default_rest_seconds: 90 }`, and stores the id in `sync_meta.user_id`.
- `getUserId()` (`:35-37`) returns a cached id. Every repository sets `user_id: await getUserId()` explicitly (for example `exercises.ts:35`, `workouts.ts:65`).
- `adoptServerUser()` (`:48-68`) handles sign-in. It runs `UPDATE <table> SET user_id = ?` for **every non-users table in `SYNC_TABLES`** (`:52-55`), so any new synced table must have a `user_id` column, or this breaks.
- Server auth (`apps/mobile/src/services/auth.ts:12-32`) registers using the guest id. It is unused while offline.

---

## 5. UI components and design system

### Reusable components (`apps/mobile/src/components/`)
- **`BottomSheet`** (`BottomSheet.tsx:41-70`):
  - Props: `visible`, `onClose`, `className`, `animationType`, `dismissable`, `onShow`, `avoidKeyboard`.
  - `useKeyboardHeight()` (`:22-33`) works around edge-to-edge with Modal.
  - The panel is `rounded-t-3xl … bg-surface-raised` (`:66`).
- **`ConfirmSheet`** (`ConfirmSheet.tsx:7-56`): replaces `Alert.alert`. It takes a `ConfirmRequest {title, message, confirmLabel, tone, notice, onConfirm}`.
- **`ExerciseSelector`** (`ExerciseSelector.tsx:22-159`) is the **best template for a food search screen**:
  - Full-screen `Modal`, a search `TextInput` with a lucide `Search` icon, a "New" button, and a `FlatList` built on `useLiveQuery`.
  - The query is `name LIKE '%q%'` with `LIMIT 300` (`:27-34`).
  - The empty state offers "Create '<query>'" (`:92-105`), there is a custom badge, and edit or archive is done through a pencil that opens `ExerciseEditorSheet` (`:149-156`).
- **`ExerciseEditorSheet`** (220 lines): a create/edit form inside a bottom sheet with `target: {mode:'edit'|'new'}` (`:25-31`, `:58`). Use it as the pattern for "create custom food".
- **`SettingsControls`**: `SettingsCard` (`:8`), `ToggleRow` (`:41`), `SegmentedRow<T>` (`:61`), and **`StepperRow`** (`:101-160`, with min/max/step clamp, haptics and an optional tap-to-type value). Reuse these for calorie and macro goals.
- **`DurationInputSheet`** (`:29`): a numeric-entry sheet with presets. Use it as the pattern for a "quantity / serving" sheet.
- **Numeric parsing**: `SetRow.tsx:66-69` `parseNum` accepts a comma decimal separator and rejects negatives. Inputs use `keyboardType` `number-pad` or `decimal-pad` (`SetRow.tsx:353`). It is not exported, so it should be extracted to shared or utils if reused.
- **Cards and lists**: history cards are `rounded-xl bg-surface-raised p-4` (`HistoryScreen.tsx:50-54`). `FlatList` uses `ListEmptyComponent` text for empty states (`HistoryScreen.tsx:46`, `AnalyticsScreen.tsx:55`).
- **Bar chart**: the Analytics weekly-volume bars are hand-rolled Views (`AnalyticsScreen.tsx:56-60`). **There is no chart library.** `react-native-svg` is installed but `src` never imports it.
- **No toast or snackbar component exists**, and there is no undo pattern. Destructive actions confirm through `ConfirmSheet`.
- App-wide sheets driven by small Zustand stores, such as `useEffortSheet` (`EffortSheet.tsx:10`) and `usePlateSheet` (`PlateCalculatorSheet.tsx:20`), show a pattern for a global "quick add food" sheet.

### Design system
- Tokens live in `apps/mobile/tailwind.config.js:11-22`:
  - `surface` (`#121214`, raised `#1E1E22`, elevated `#28282E`, border `#2E2E35`)
  - `accent` (emerald `#10B981`, soft, muted)
  - `action` (`#0066FF`)
  - `ink` (`#F4F4F5`, muted, subtle, faint)
  - `pr` (amber), `superset` (blue), `settype` (warmup, drop, failure)
  - `borderRadius.card` = 16px
- They are mirrored for icon and style props in `apps/mobile/src/theme.ts:2-21`, with `cardShadow` at `:24-30`. "Keep both files in sync" (`tailwind.config.js:1-4`).
- Nutrition will likely need new macro colour tokens (protein, carbs, fat). Add them to **both** files.
- Dark only: `app.json:8`. There is no light theme and no `dark:` variants.
- Fonts: no custom fonts (no `expo-font` or `fontFamily`). The UI uses the system font with `tabular-nums` for numbers (`SettingsControls.tsx`, StepperRow).
- Icons: `lucide-react-native` ^0.544 (`package.json:38`). It includes food icons such as `Apple`, `Utensils`, `Flame`, `Beef` and `ScanBarcode`.

### Units
- `useUnits()` (`apps/mobile/src/state/settingsStore.ts:57-75`) returns `unit`, `label`, `display`, `format`, `toKg`, `distanceLabel`, `displayDistance` and `toMeters`.
- `useSettingsStore` (`:32-51`) applies `update(patch)` optimistically, then calls `updateRecord('users', …)` with `mergePreferences` (`:42-50`).
- `getSettings()` (`:54`) reads settings outside React.
- No grams/ounces or kcal/kJ helpers exist yet.

---

## 6. Date and timezone handling

- All dates are epoch ms numbers: `start_time`, `end_time`, `completed_at`, `created_at` and so on (`tables.ts:10`, `:93-94`).
- **No date library** is in `apps/mobile/package.json:17-49`: no date-fns, dayjs, luxon or Intl polyfill. Formatting uses `toLocaleDateString` / `toLocaleTimeString` / `toLocaleString` directly (`WorkoutDetailScreen.tsx:137-158`, `HistoryScreen.tsx:59`, `WorkoutNotificationSync.tsx:27`).
- **No local-day bucketing helper exists.** The only aggregation is UTC epoch weeks: `CAST(ws.start_time / WEEK_MS AS INTEGER)` (`AnalyticsScreen.tsx:7`, `:19`). This buckets by **UTC, Thursday-aligned weeks**, not local calendar weeks. A daily food log needs a proper local-day key.
- There is no calendar screen. Calendar plus streaks is planned (ROADMAP 3.3, `ROADMAP.md:397-398`).
- History is a flat list with `LIMIT 200` (`HistoryScreen.tsx:22-37`). Detail is at `/workout/[id]`.
- `packages/shared/src/backup.ts:104` formats a date for a filename stamp. It is not a general helper.

---

## 7. Existing nutrition, food or bodyweight code

- **None.** `git grep -i` for food, meal, calori, kcal, nutrition, macro, protein, barcode, camera and body_metrics over the repo (excluding the lockfile and ROADMAP) finds only `README.md:8` ("Scan this QR code with the phone camera").
- "Bodyweight" exists only as exercise tracking types: `weighted_bodyweight` and `assisted_bodyweight` (`packages/shared/src/tracking.ts`, `SetRow.tsx:280`, `ExerciseEditorSheet.tsx:51-52`). There is no bodyweight logging and no `body_metrics` table.
- `package-lock.json` has no camera or barcode packages.

---

## 8. Testing

- Mobile tests (`apps/mobile/vitest.config.ts:11-35`) run in the Node environment on `test/**/*.test.ts`. Aliases replace native modules with fakes in `test/mocks/`: expo-sqlite, kv-store, react-native, crypto, notifications, audio, asset, file-system, sharing, constants, secure-store, haptics, keep-awake and netinfo.
- `test/mocks/expoSqlite.ts` is backed by **`node:sqlite` `DatabaseSync(':memory:')`** (`:1-15`). App SQL runs for real, including migrations, the outbox, PR SQL and backup.
  - Nested transactions throw (`:32-33`).
  - `addDatabaseChangeListener` is a no-op (`:62-64`), so `useLiveQuery` reactivity is not tested. Only its SQL can be exercised directly.
  - `resetTestDatabase()` is at `:55-60`.
- `test/helpers.ts`: `freshApp()` resets, migrates, seeds, creates the user and loads settings (`:9-15`). `logWorkout()` drives the real repositories (`:31-50`). `rows(table)` is at `:53`.
- Migration testing (`apps/mobile/test/db.test.ts:15-40`):
  - It asserts `user_version` and the seed count.
  - It **downgrades a fresh DB to v1** by dropping columns or indexes and setting `PRAGMA user_version = 1`, then re-runs `initDatabase()` and checks that data survives.
  - A v7 nutrition migration needs `DROP TABLE` / `DROP INDEX` lines added to that downgrade script and the expected version bumped.
- Other mobile suites: `backup.test.ts` (backup, wipe and restore, re-owning, merge, settings, CSV `:24-125`), `prEngine`, `history`, `routines`, `plan`, `intervalRun`, `settingsAndCues`, `crashLog`.
- Shared tests (`packages/shared/src/__tests__/*.test.ts`) cover pure logic: `pr`, `tracking`, `settings`, `sync` (resolveWrite), `backup`, `formGuides` (enforces a guide per canonical exercise), `plans`, `plates`, `warmups`, `supersets`, `intervals`, `templates` and `effort`.
- Commands: `npm test` runs workspaces with `--if-present`. `npm run typecheck` uses root `package.json` scripts. Mobile tsconfig is `strict` plus `noUncheckedIndexedAccess` (`apps/mobile/tsconfig.json`).

---

## 9. Relevant dependencies (`apps/mobile/package.json:17-49`)

| Present | Notes |
|---|---|
| `expo-sqlite ~16` | DB, KV store and change listener; FTS5 availability needs checking (see §11) |
| `expo-notifications ~0.32` | Could drive meal reminders (the rest timer uses OS-scheduled notifications) |
| `expo-crypto`, `expo-file-system ~19`, `expo-sharing`, `expo-asset ~12` | `expo-asset` could ship a prebuilt food `.db` file |
| `expo-haptics`, `expo-keep-awake`, `expo-audio`, `expo-secure-store`, `expo-linking` | |
| `@react-native-community/netinfo` | Used by sync; could gate an optional online lookup |
| `react-native-svg 15.12.1` | Available for rings and charts (unused in `src`) |
| `react-native-keyboard-controller 1.18.5` | Keyboard-aware forms |

- **Absent**: `expo-camera` (or a barcode scanner), any date library, any chart library, `expo-image-picker`, `expo-font`.
- Adding `expo-camera` is a native dependency. It needs a prebuild, and its config plugin adds the `CAMERA` permission (and optionally `RECORD_AUDIO`, see §10). Use `npm run deps:fix -w @gym/mobile` (`expo install`) to get an SDK-54-aligned version.

---

## 10. Release and build notes relevant to camera permission (`docs/release-apk.md`)

- Prebuild is needed after any `app.json` or native-dependency change, because `android/` is generated and gitignored (`:11`). `npm run phone` re-prebuilds automatically when `app.json` or `package.json` changes (`:3-5`).
- "Unneeded permissions are stripped via `android.blockedPermissions` in `app.json`. Check new native deps for added permissions" (`:19`).
- Current permissions are `VIBRATE`, `POST_NOTIFICATIONS` and `USE_EXACT_ALARM` (`app.json:21-25`).
- **`android.permission.RECORD_AUDIO` is already blocked** (`app.json:27`). The `expo-camera` plugin should be configured with `recordAudioAndroid: false`, and `CAMERA` must be added. The camera permission must be requested at runtime, with a graceful denied state (principle 1 and §5).
- Updates must use the same keystore and a bumped `versionCode` and `version` (`release-apk.md:27-33`), otherwise users lose data. Migration safety matters doubly here.
- APK is arm64 only and was 39 MB at 1.1 (`ROADMAP.md:171`). A bundled food DB adds directly to APK size.

---

## 11. Integration analysis

### 11.1 Reuse as-is
- `mutate.ts` (`write` / `stageCreate` / `stageUpdate` / `stageDelete` / `createRecord`…) for every user-authored nutrition row. `useLiveQuery` for daily totals and lists.
- `BottomSheet`, `ConfirmSheet`, `SettingsCard` / `StepperRow` / `SegmentedRow` / `ToggleRow`, `DurationInputSheet` (as a pattern), `ExerciseSelector` (as the food-search template) and `ExerciseEditorSheet` (as the custom-food form template).
- The Zustand global-sheet pattern (`useEffortSheet`) for a quick-add sheet. The settings store with `mergePreferences` for goals.
- Test harness: `freshApp()`, real SQL on `node:sqlite`, and the downgrade-style migration test.

### 11.2 Likely new entities (following the rules)
Every synced table gets these: snake_case, the sync columns, a `user_id` column (required by `adoptServerUser` `user.ts:52-55` and backup re-owning), full-row snapshots via `mutate.ts`, and `deleted_at` tombstones filtered in every query.

| Table | Purpose | Key columns (proposal) | Strategy |
|---|---|---|---|
| `foods` | Custom foods (and canonical ones if bundled via the seed pattern) | `user_id` (null = canonical), `name`, `brand`, `barcode`, `kcal_per_100g`, `protein_g_per_100g`, `carbs_g_per_100g`, `fat_g_per_100g` (+ optional fibre/sugar/sodium_mg), `default_serving_id`/`default_serving_g`, `archived_at`, `source` | lww |
| `food_servings` | Named portions ("1 slice = 28 g") | `user_id`, `food_id`, `label`, `grams` | lww |
| `food_log_entries` | One eaten item | `user_id`, `food_id` (or `recipe_id`), `eaten_at` (epoch ms), **`local_date` ('YYYY-MM-DD')**, `meal` enum (breakfast/lunch/dinner/snack), `grams`, **snapshot of `kcal`, `protein_g`, `carbs_g`, `fat_g`** at log time, `serving_label`, `notes` | probably `append_only` like `sets` (concurrent logging on two devices should union) |
| `recipes` | Meals / recipes | `user_id`, `name`, `servings`, `items` JSON (like `template_exercises`) **or** a child table `recipe_items` (`recipe_id`, `food_id`, `grams`, `order_index`) | lww |
| (ROADMAP 3.5) `body_metrics` | Bodyweight is closely related; it is already planned | `date`, `type`, `value` (`ROADMAP.md:524`) | lww |

- **Canonical units, the kg-only analogue.** Store mass in **grams** and energy in **kcal**, with macros in grams. Convert at the UI boundary through a new `useNutritionUnits()` or an extension of `useUnits()`: oz/g follows `unit_system`, and kcal/kJ becomes an optional preference. Add pure conversion helpers with tests in `packages/shared` (§5 requires tests for conversions).
- **Snapshot the nutrients onto log entries.** That way, editing or deleting a food never rewrites history. This mirrors how history must stay stable, and it lets totals be a single `SUM()` with no joins.
- **Goals belong in `users.preferences`.** Add fields to `settingsSchema` using `.catch()` defaults: for example `nutrition_goals: { kcal, protein_g, carbs_g, fat_g } | null`, `meal_names`, `energy_unit: 'kcal'|'kj'`, and `day_start_hour`. This needs no new table or migration, and old preference objects keep parsing (`settings.ts:7-11`).
- Possible additions to `TABLE_SPECS`:
  - Refs: `food_servings.food_id` and `food_log_entries.food_id` need `allowGlobal: true` if canonical foods exist (`tables.ts:171-172`).
  - `timestampColumns` gains `eaten_at` and `archived_at`.
  - `jsonColumns` gains `items` if recipes are embedded.
- The four-places rule (`CLAUDE.md` §1) applies:
  1. zod schemas and `TABLE_SPECS` / `SYNC_TABLES` / `SyncRowMap` in `tables.ts`.
  2. Append migration v7 in `migrations.ts`.
  3. `schema.prisma` plus `prisma migrate dev`. While server work is deferred, at minimum `PRISMA_MODEL` in `apps/server/src/services/sync/mapping.ts:4` is a `Record<SyncTable,…>`, so **typecheck fails** until it gets entries. Server pull iterates `SYNC_TABLES` (`apps/server/src/services/sync/pull.ts:22-29`). Recommendation: add Prisma models in the same change (no DB run needed), or decide explicitly how to keep the server compiling.
  4. The camelCase Prisma fields must equal `snakeToCamel(column)`.

### 11.3 New screens and components (suggested)
- **Navigation**: a 6th tab, "Food" or "Nutrition" (`(tabs)/nutrition.tsx` re-exporting `screens/NutritionScreen`), in `(tabs)/_layout.tsx`. Alternatively, fold Analytics into another tab to keep five. Detail routes: `food/[id].tsx` (edit food) and maybe `nutrition/[date].tsx`.
- `NutritionScreen`:
  - Day header with previous/next day controls.
  - Calorie and macro progress (Views, or `react-native-svg` rings).
  - Meal sections with entries, and "+ Add" per meal.
- `FoodSelector`, modelled on `ExerciseSelector`: search, recent/frequent foods first (principle 2), "Create '<q>'", and an optional barcode button.
- `FoodEditorSheet` (custom food), `ServingSheet` (grams or serving × quantity, with numeric input), `RecipeBuilder`, and a goals section in Settings (`SettingsCard` + `StepperRow`).
- Optional `BarcodeScannerScreen` (expo-camera) that **looks up locally only**. Any online lookup (for example Open Food Facts) would conflict with offline-first unless it is optional and degrades with a message (principle 1). Before shipping, check the licence of any food data (the CLAUDE.md asset rules show the project cares; Open Food Facts is ODbL, which has share-alike obligations).

### 11.4 Code that should not change
- Shipped migrations v1–v6 (`migrations.ts:14-154`).
- Canonical exercise ids and the exercise seed (`exercises.ts`, `migrations.ts:157-173`).
- The `mutate.ts` contract and its write lock, `resolveWrite()` in `packages/shared/src/sync.ts:73`, and the PR engine SQL plus `epley1RM` pairing.
- The rest-timer deadline model, the `CLOUD_SYNC_ENABLED` flag and the hidden sync UI, the RepDB attribution and licences, and the sync code (it must stay intact but unused).
- The `users` row creation in `ensureLocalUser` (it is not enqueued, by design).

### 11.5 Risks: migrations, data integrity, back-compat
1. **Append only.** Add migration v7. Never edit v1–v6. Update `db.test.ts:17-18` (expects 6) and extend its v1-downgrade script so it drops the new tables.
2. **`SYNC_TABLES` is a fan-out point.** Adding tables automatically affects these places:
   - backup export and restore (`services/backup.ts:51-56`, `:156-200`)
   - the backup zod schema (`packages/shared/src/backup.ts:22-27`)
   - `adoptServerUser` (`user.ts:52-55`, which needs a `user_id` column)
   - the `applyPull` loop (`apps/mobile/src/db/sync/applyPull.ts:17-20`)
   - `PushMutation.table` enum (`packages/shared/src/sync.ts:15`)
   - server pull and push, and `PRISMA_MODEL`

   This is mostly good: nutrition is backed up for free. Keep the order parent-first (`foods` before `food_servings` before `food_log_entries`).
3. **Backup compatibility.**
   - Older backups lack the new tables. `.default([])` handles that.
   - A new backup restored on an **older** app version has the nutrition keys silently stripped, because `z.object` drops unknown keys. Data loss is silent but limited to that old app.
   - Bumping `BACKUP_VERSION` would instead make old apps reject the file (`backup.ts:65`). Decide which behaviour you want and add a restore test like the ones in `backup.test.ts`. Consider extending `summarize()` (`services/backup.ts:117-127`) to report food entries.
   - Restore re-owns only rows with a non-null `user_id`, so canonical foods (null) survive correctly.
4. **Bundled food DB size and seeding.**
   - The exercise seed upserts all rows at every launch in one transaction. That is fine for 45 rows but not for 10k–100k foods. It would also bloat backups if canonical foods sat in a synced table that backup reads in full (`SELECT * FROM table`).
   - Options:
     - (a) A **separate, non-synced, read-only reference table** (like `telemetry_points`, outside `SYNC_TABLES`), populated only when a bundled dataset version changes (track it with a `sync_meta` key; `MetaKey` union `meta.ts:3-12`). Log entries then reference it, with nutrient snapshots so old entries stay valid if the dataset changes.
     - (b) Ship a prebuilt `.db` through `expo-asset` and `ATTACH` it.
   - Either way the APK grows (39 MB today). The dataset licence must permit in-app use.
5. **Search performance.** `LIKE '%q%'` with `LIMIT 300` (the `ExerciseSelector.tsx:27-34` pattern) is a full scan. On a large food table use an FTS5 virtual table, or a prefix `LIKE 'q%'` on a `COLLATE NOCASE` index. Before relying on FTS5, **verify it is enabled** both in expo-sqlite's Android build (config-plugin option) and in Node's `node:sqlite` used by tests.
6. **Day boundaries and timezones.**
   - No local-day helper exists, and the existing weekly analytics are UTC-bucketed (`AnalyticsScreen.tsx:19`).
   - For food, store `eaten_at` (epoch ms) **and** a `local_date` string computed on the device at log time. Index `(user_id, local_date)`, or `(local_date)` plus the `deleted_at` filter.
   - Then travel or DST never moves a meal to another day, and daily-total SQL is a simple `GROUP BY local_date`.
   - Put the helper (`toLocalDateKey(ms, tzOffset?)`) in `packages/shared` with tests that cover DST and midnight edges. An optional `day_start_hour` preference handles late-night eaters.
7. **Numeric integrity.** Use `REAL` columns for grams, kcal and macros, with zod bounds (as `weight_kg` does at `tables.ts:117`). Round only for display. Reuse comma-decimal parsing (`SetRow.tsx:66-69`). `commitUnlocked` rejects out-of-bounds rows via zod (`mutate.ts:74`), so choose generous maxima.
8. **Writes.** Every user-authored row goes through `mutate.ts`. Raw SQL is acceptable only for a non-synced reference dataset, as with the canonical exercise seed. Do not call `write()` inside `write()`. The test adapter also throws on nested transactions (`expoSqlite.ts:32-33`).
9. **Camera.** Adding `expo-camera` means prebuild, a new `CAMERA` permission, `RECORD_AUDIO` kept blocked (`app.json:27`), a runtime permission prompt with a graceful denied state, and a mock alias in `vitest.config.ts` if any tested module imports it.
10. **Design-system compliance.** Add new colour tokens to both `tailwind.config.js` and `theme.ts`. Use bottom sheets (no `Alert.alert`) and 16px cards. Avoid copying the hard-coded hex values in `(tabs)/_layout.tsx:9-11` and `_layout.tsx:101`.
11. **Docs.** Add the ROADMAP item and the §6 data-model row, and update `CLAUDE.md` (new tables and the units rule "grams/kcal canonical"). Optionally write a `docs/superpowers/specs/…-nutrition-design.md` spec, following the existing convention.

---

## 12. MVP recommendations mapped to the codebase

How each [MVP item](product-recommendations.md#mvp--essential-for-launch) would land in the existing code. This is a
sketch for later planning, not a plan; nothing has been implemented.

| MVP item | Reuse | New | Notes |
|---|---|---|---|
| M1 Daily diary | `useLiveQuery`, `SettingsCard`-style cards, tokens in `tailwind.config.js` + `theme.ts`, route re-export pattern (`src/app/(tabs)/*.tsx` → `src/screens/*`) | `screens/NutritionScreen.tsx`, `(tabs)/nutrition.tsx`, macro colour tokens, `toLocalDateKey()` in `packages/shared` with DST tests | Tab count decision (6 tabs vs merge). Avoid copying the hard-coded hex in `(tabs)/_layout.tsx:9-11`. |
| M2 Offline search | `ExerciseSelector.tsx` structure (modal, search field, `FlatList`, "Create '<q>'" empty state) | `FoodSelector`, bundled reference table + versioned seed (`sync_meta` key), history query over `food_log_entries` | Don't reuse the every-launch seed for thousands of rows (`migrations.ts:157-173`). Keep reference foods out of `SYNC_TABLES` so backups stay small. |
| M3 Portion sheet | `BottomSheet`, `DurationInputSheet` pattern, `parseNum` from `SetRow.tsx:66-69` (extract to a shared util) | `PortionSheet`, gram/oz helpers + tests in `packages/shared` | §5 checklist requires conversion tests. |
| M4 Custom food | `ExerciseEditorSheet` (create/edit target mode), `createRecord` / `updateRecord`, archive pattern from `exercises.ts:56-59` | `FoodEditorSheet`, `foods` + `food_servings` tables (zod in `tables.ts`, migration v7) | Nullable nutrient columns (blank ≠ zero). Archive instead of delete. |
| M5 Quick add | `BottomSheet`, numeric inputs | Quick-add entry type (entry with `food_id = null` + name) | Keeps one entries table. |
| M6 Edit/delete + undo | `stageUpdate` / `stageDelete` tombstones (`mutate.ts:40-51`) | Toast/snackbar component (none exists) | Undo = `updateRecord` clearing `deleted_at`, or re-create; decide which keeps `updated_at` strictly increasing. |
| M7 Copy / repeat | `write()` batching several `stageCreate` calls in one transaction (`workouts.ts` pattern) | Copy helpers in a `nutrition` repository | Never nest `write()`. |
| M8 Goals | `settingsSchema` with `.catch()` defaults, `mergePreferences`, `StepperRow` | `nutrition_goals` (with dated history) in preferences | No migration needed for preferences. |

Schema changes for M2–M7 trigger the **four-places rule** (`CLAUDE.md` §1): zod + `TABLE_SPECS` + `SYNC_TABLES`,
migration v7 (+ update `db.test.ts:18` and its downgrade script), Prisma models, and `snakeToCamel` naming. The server
`PRISMA_MODEL` record (`apps/server/src/services/sync/mapping.ts:4`) must get entries or `npm run typecheck` fails,
even though server work is deferred. ROADMAP needs a new item and a §6 data-model row before work starts.
