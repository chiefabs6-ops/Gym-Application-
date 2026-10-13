# Gym Log: Product Roadmap

> **How to use this file**
> - Work the phases **in order**. A phase is done only when every item in it is ticked *and* its exit criteria are met.
> - Inside a phase, items are listed in suggested build order. Each item has acceptance criteria. "Done" means those
>   criteria are verified on the emulator or a device, not just that it type-checks.
> - When you start an item, mark it `[~]`. When it's verified, mark it `[x]` and add the date.
> - Size: **S** ≈ ≤ 1 day · **M** ≈ 2–4 days · **L** ≈ 1–2 weeks.
> - Architecture rules live in `CLAUDE.md`. Every schema change follows the "four places" rule there:
>   shared zod schema, a new mobile migration, Prisma + migrate, and the snake_case ↔ camelCase mapping.
>
> Last updated: 2026-10-08 (2.1–2.11 done)

---

## 0. Product principles (the "full design" every phase must respect)

These come from what we've built so far plus the competitor research in §3. When a decision is unclear, use them as tie-breakers.

1. **Offline-first, device is the source of truth.** Every feature must work in airplane mode. Any network feature
   (sync, YouTube, social) degrades gracefully and says why.
2. **Fastest logging in the category.** Minimal taps, one-handed, previous values pre-filled, no blocking dialogs.
   Strong and FitNotes are loved for exactly this.
3. **No paywall on the basics.** Unlimited routines, uncapped history and charts, free plate and warm-up calculators.
   Caps and paywalled basics are the #1 complaint about Strong, Hevy, JEFIT and StrongLifts.
4. **Transparent smart features.** Progression and suggestions always show *why*, e.g. "+2.5 kg because you hit 3×12
   at RIR 2". Black-box AI is the main complaint about Fitbod, RP and Hevy Trainer.
5. **Your data is yours.** Export at any time, import from other apps, and no data loss on phone change or update.
   These are FitNotes' and Strong's biggest failures.
6. **Android quality is the priority, not an afterthought.** Strong and Gravitus are punished for weak Android versions.
7. **One design system.** Use the tokens in `tailwind.config.js` / `src/theme.ts`, bottom sheets instead of system
   alerts, and 16px cards. No new screen ships with `Alert.alert` or hard-coded colours.

---

## 1. What's built so far

Status key: ✅ verified on emulator · 🧪 type-checks / unit-tested only (not run end-to-end) · ⚠️ partial · ⏸️ deferred

### Foundation & architecture
| | Item |
|---|---|
| ✅ | npm-workspaces monorepo: `apps/mobile`, `apps/server`, `packages/shared`; `CLAUDE.md` with architecture rules |
| ✅ | Shared data contract (zod row schemas, `TABLE_SPECS`), Epley PR maths, canonical exercise list (44, fixed UUIDs) |
| 🧪 | Shared conflict resolution `resolveWrite()` (LWW, append-only sets, tombstones win). 12 unit tests pass |
| ✅ | React pinned to a single version (fixed "Invalid hook call" from duplicate React) |

### Mobile data layer & sync
| | Item |
|---|---|
| ✅ | SQLite schema + `PRAGMA user_version` migrations, canonical exercise seed |
| ✅ | `mutate.ts` transactional outbox (row + `sync_queue` in one transaction), serialized `write()` lock |
| ✅ | `useLiveQuery` reactive queries (SQLite change listener) |
| ✅ | Guest mode (local user id; register adopts it) |
| 🧪 | Sync manager: push/pull, exponential backoff + jitter, NetInfo/AppState triggers, dead-lettering |
| 🧪 | Telemetry (GPS/HR) local buffer + batched upload. No recording UI yet |

### Server
| | Item |
|---|---|
| 🧪 | Fastify API: `/auth` (register/login/me), `/sync/push`, `/sync/pull`, `/telemetry`, `/workouts/active` |
| 🧪 | Prisma schema (Postgres) + TimescaleDB hypertable setup script + seed |
| 🧪 | BullMQ workers: PR recompute, session volume stats, social fan-out (stub) |
| ⏸️ | **Deferred to Phase 8.** Never run against a real database (no Docker); migrations not generated yet |

### Active workout
| | Item |
|---|---|
| ✅ | Focus-mode pager (one exercise per page, swipe or Back/Next, "Exercise X of Y", progress dots, persisted index) |
| ✅ | Sticky header (timer, current exercise, Finish), overview drawer (jump / add / remove exercises) |
| ✅ | Set table SET / PREVIOUS / KG / REPS / ✓. Ghost values from last session, tap PREVIOUS to copy, auto-fill on ✓ |
| ✅ | Set-type sheet (W / D / F / delete), animated check + haptics, completed-row highlight |
| ✅ | Instant PR detection (Epley) with PR badges |
| ⚠️ | Rest timer: wall-clock deadline, background notification, floating banner (+30s / Skip), full modal, mute toggle. 3·2·1 + finish beeps load correctly but **haven't been confirmed audible by a person yet** |
| ✅ | Finish sheet (summary, unticked-set warning, session RPE, notes, two-step discard) |
| ✅ | "Workout in progress" sheet when starting a routine mid-workout (resume / discard & start), double-start guard |
| ✅ | Per-exercise notes |

### Content
| | Item |
|---|---|
| ✅ | Form guide popup: steps + common mistakes for all 44 exercises (test-enforced), YouTube button that's aware of offline |
| ✅ | Line-art illustrations (Everkinetic, CC BY-SA 4.0) for 33/44 exercises, start + end positions, credits shown |
| ✅ | Rest-timer beeps generated by script (`scripts/generate-beeps.mjs`) |

### Other screens
| | Item |
|---|---|
| ✅ | Routines: create, edit, duplicate, delete, start; folders; rep ranges; per-set targets (2.2) |
| ✅ | History: list + detail view (sets, PRs, notes, RPE), edit past workouts, repeat, delete (2.1) |
| ⚠️ | Analytics: weekly volume bars, best e1RM per exercise (basic) |
| ⚠️ | Account: sign in/register, sync status, pending/rejected counts, credits |
| ✅ | App-wide dark theme (charcoal / emerald tokens) |

---

## 2. Known issues & technical debt (carried into the phases below)

- Backend and end-to-end sync never exercised against Postgres/Redis (no Docker). **Deferred to Phase 8.**
- No standalone APK has been built or installed on a real phone yet (Phase 1.1). Testing so far was only in Expo Go.
- No app icon, splash screen or final app name.
- **Data-safety gap:** with no account, data lives only on the device and there's no export or backup yet.
- ~~No mobile tests~~ (done in 1.5). Server tests → Phase 8.
- The sync outbox (`sync_queue`) grows with every edit while there's no server. Handled in Phase 1.3.
- `/sync/pull` isn't paginated. JWT has no refresh token. Social fan-out is a stub. (All Phase 8.)
- ~~Units: kg only; no settings screen.~~ Done in 1.4.
- Hint text "tap the set badge for W/D/F" is unclear. Hide the PREVIOUS hint when there's no history.
- ~~11 exercises have no illustration, 5 are approximate.~~ Replaced with RepDB art in 2.12 (43/44, see `docs/exercise-assets.md`).
- Exercise definitions have no secondary muscles or movement pattern. These are needed for muscle volume, swaps and heatmaps.
- ~~Exercise types: only weight × reps.~~ Done in 2.4.
- Dev environment: the emulator display can hang in long sessions (cold boot fixes it). Low RAM. adb reverse is lost when adb restarts.

---

## 3. Competitor research summary (Oct 2026)

Apps studied: **Strong, Hevy, JEFIT, FitNotes, Gravitus, Setgraph** (logging-first) and **Fitbod, Alpha Progression,
Boostcamp, Liftosaur, StrongLifts 5x5, RP Hypertrophy, JuggernautAI** (programming/progression). Caliber and Ladder were looked at briefly.

**What the market expects (table stakes):**
- Supersets
- Plate calculator
- Warm-up calculator
- Per-exercise history charts
- Records at every rep range
- Bodyweight / measurements
- CSV export
- Routine folders
- Bodyweight / duration / distance exercise types
- Per-exercise rest timers
- Health Connect sync
- Lock-screen workout controls (Hevy has them on Android)

**What users love:**
- Strong / FitNotes: speed and minimal taps.
- Hevy: auto-filled previous values and a generous free tier.
- Alpha Progression: per-set weight/rep recommendations that also work offline.
- Boostcamp: a free library of classic programs (5/3/1, nSuns, GZCLP, PPL).
- Liftosaur: transparent, configurable progression rules.
- Fitbod: recovery heatmap and time-boxed sessions.

**What users hate:**
- Template caps (3–4 routines) and history caps (Hevy: 3 months of free charts).
- Ads and fake sales (JEFIT); features that used to be free moving behind a paywall (Gravitus, JEFIT).
- Weak Android versions (Strong, Gravitus).
- Data loss on phone change or update (FitNotes, Strong).
- Black-box "AI" (Fitbod "random", Hevy Trainer "ChatGPT could do better", RP "simple calc").
- RP has no offline mode; prices of $300+/yr for RP and JuggernautAI.

**Our positioning:** an offline-first Android logger with uncapped history, free core tools, data you can export, and
**deterministic progression engines that explain themselves**. Most of the groundwork (Epley e1RM, set types,
previous values, local SQLite) already exists, so the "smart" features are rule engines over data we already store.

Progression mechanisms worth copying (implementation details in Phase 4):
- Double progression (`dp(inc, min, max)`)
- Linear progression with failure counter → −10% deload
- RIR-based load: `e1RM = w × (1 + (reps + RIR)/30)` and `next = e1RM / (1 + (targetReps + targetRIR)/30)`, clamped ±5%
- Training Max + AMRAP bump (5/3/1, nSuns)
- RP-style weekly volume feedback per muscle

Sources: competitor sites, help centres, App Store listings, review aggregators and 2024–2026 reviews (Reddit was not
directly crawlable, so some sentiment is second-hand). Full per-app notes are in §8.

---

## 4. Phases

### Phase 1: Offline app on my phone, polished & data-safe  *(do first)*
Goal: a standalone app installed on a real Android phone that works fully offline, with no server, and can't lose data.
*(Decision 2026-10-07: everything that needs a server or database moved to **Phase 8**.)*

- [x] **1.1 Standalone Android build on a physical phone** (M), **done 2026-10-07** (airplane-mode cold start still worth a manual spot check)
  - ✅ Release APK built (arm64, 39 MB) and installed on OnePlus CPH2747 / Android 16; launches without Expo Go or a PC.
  - ✅ Icon set (adaptive + monochrome themed), splash, versionCode 1, exact-alarm permission granted, unneeded permissions blocked.
  - ✅ Data survives an update install (`adb install -r`).
  - ✅ Rest alert audible with the screen locked (own beep on the ALARM stream, channel `rest-timer-v2`); first 3·2·1 tick latency fixed by priming audio.
  - `expo run:android --variant release` using the Android Studio JDK (or an EAS local build). Install over USB.
  - App name, **icon, adaptive icon, splash**, version code. Remove the Expo Go-only dev workarounds from the release path.
  - *Accept:* installed on your phone without Expo Go or a PC; cold start in airplane mode works; the rest notification
    and beeps fire with the screen locked; data survives an app update (install a new build over the old one).
- [x] **1.2 Local data export & backup** (M) *(data safety: the phone is the only copy)*, **done 2026-10-07**
  - ✅ Verified on emulator: auto-backup to a chosen folder (Documents) → wipe all app data → restore → History and
    routines identical (74 rows added, 27 already present); restoring the same file again → 0 added / 0 updated.
  - ✅ Share JSON backup and CSV export open the Android share sheet; backup card + 14-day reminder render on the phone.
  - Notes: restore **merges** (LWW + tombstones, rows re-owned by this device), never wipes. Restored rows aren't
    queued for sync (Phase 8.2 uploads everything on first sign-in). The auto-backup folder setting and preferences
    aren't part of the backup. Android blocks the storage root and Download for folder access, so use Documents or a subfolder.
  - Export everything as JSON (full fidelity) + CSV (workouts / sets) via the share sheet (Drive, email, files).
  - Import from our own JSON backup.
  - Optional automatic weekly backup to a user-chosen folder (Storage Access Framework).
  - "Last backup" shown in settings, with a gentle reminder if it's older than 14 days.
  - *Accept:* export → uninstall → reinstall → import → identical history, routines and PRs.
- [x] **1.3 Offline-only mode** (S), **done 2026-10-07**
  - ✅ `CLOUD_SYNC_ENABLED` flag (`src/config.ts`, off). No outbox writes; outbox cleared at startup; sync manager not started.
  - ✅ Account tab → **Settings** (Backup + About). Sign-in/sync UI moved to `CloudAccountSection`, rendered only with the flag.
  - ✅ Verified on phone: no sign-in UI; the app opens **zero network sockets** during startup (checked via /proc/net).
  - Hide sign-in / sync UI on the Account tab (rename it **Settings**) behind a `CLOUD_SYNC_ENABLED` flag.
    Keep all sync code intact for Phase 8.
  - Stop the outbox growing forever while offline-only: either don't enqueue while the flag is off, or prune it.
    Must be reversible, so Phase 8 can do a full initial upload.
  - *Accept:* no sign-in prompts anywhere; the app never tries the network except for YouTube links.
- [x] **1.4 Settings screen** (S), **done 2026-10-07**
  - ✅ Units kg/lb (stored in kg, `useUnits()` at the UI boundary: set inputs/placeholders, PREVIOUS, column header,
    finish sheet, History, Analytics). Verified on phone: lb shows correct conversions; setting survives a restart.
  - ✅ Default rest (15 s–10 min), rest sound, rest vibration (in-app and lock screen via 4 notification channels),
    keep screen awake during a workout, PREVIOUS values from last session / same routine.
  - ✅ Stored in the local `users` row (`unit_system` + `preferences`, parsed with defaults by `parseSettings` in shared,
    5 unit tests). Restoring a backup on a fresh install now restores settings too.
  - ✅ Rest time picker sheet (`DurationInputSheet`), used by Settings → Default rest **and** the routine builder's
    per-exercise rest: type m:ss or tap a preset; **custom presets** (Add to presets / long-press to remove, max 8,
    stored in `preferences.rest_presets`, shared by both places). Verified on phone incl. keyboard-open layout.
  - Units kg/lb (stored in kg; convert at the UI boundary everywhere).
  - Default rest time, rest sound on/off, vibration, keep-screen-awake during a workout.
  - "Previous values from: last session / this routine" (Hevy).
  - Backup/export entry points (1.2) and credits.
  - *Accept:* the lb setting changes every weight display and input; settings persist across restarts.
- [x] **1.5 Automated tests (mobile + shared)** (M), **done 2026-10-07**
  - ✅ `npm test` (repo root) runs everything: **51 tests** (mobile 27 + shared 24), all passing.
  - ✅ Mobile tests use **vitest** (not jest-expo) and run the app's real SQL against Node's built-in SQLite via an
    expo-sqlite-compatible adapter (`apps/mobile/test/mocks/expoSqlite.ts`); other native modules are small fakes.
  - Covered: migrations/seed, mutate.ts (schema validation, offline outbox, updated_at ordering, `write()` lock
    no-lost-update, discard tombstones), PR engine SQL (= `epley1RM`, ties, warm-ups, deleted workouts),
    backup round-trip + idempotent restore + merge keeps newer edits + settings restore, auto-backup pruning/errors,
    reminder, CSV export, settings persistence, rest-timer cue timing (`services/restCues.ts`).
  - Sanity check: an injected integer-division bug in the PR SQL is caught by the suite.
  - jest-expo: outbox + `write()` lock, PR engine SQL vs `epley1RM`, rest-timer cues, export/import round-trip.
  - *Accept:* `npm test` runs all suites and they pass.
- [x] **1.6 Polish & debt** (S), **done 2026-10-07**
  - ✅ Set number badge shows a ▾; footer hints rewritten and the "copy PREVIOUS" hint only shows when there is history.
  - ✅ Root `ErrorBoundary` + startup failure → friendly `CrashScreen` ("your workouts are safe", Try again, Share error
    report). Offline crash log (`services/crashLog.ts`, newest 20, JSON lines in the app's document folder) incl. global
    JS errors; Settings → About shows/share/clear saved reports. *(Crash screen covered by unit tests; not force-crashed on device.)*
  - ✅ All `Alert.alert` replaced by in-app sheets (`ConfirmSheet`): routine delete/validation/discard-changes, remove exercise.
    (Only the hidden Phase 8 sign-in form still uses one.)
  - ✅ Beeps confirmed audible on the phone (user, 2026-10-07).
  - ✅ Found & fixed on device: typed weights could be lost if the keyboard was closed with Back before saving. Set rows
    now autosave 0.6 s after typing (and on blur/unmount); the routine editor updates its draft on every keystroke.
  - Clearer set-badge hint plus a ▾ affordance; hide the PREVIOUS hint when there's no history.
  - Error boundary with a friendly crash screen (offline crash log saved locally, exportable).
  - Confirm the 3·2·1 and finish beeps are audible on the phone.
  - Remove the remaining `Alert.alert` calls (routine delete, exercise remove) in favour of sheets.
- **Exit criteria:** you've used the installed app on your phone for real gym sessions in airplane mode; a backup
  round-trip has been tested; tests pass with one command.

### Phase 2: Logging essentials (feature parity with Strong / Hevy)
Goal: nothing a serious lifter expects is missing from the logging flow.

- [x] **2.1 History detail + edit past workouts** (M), **done 2026-10-08**
  - ✅ History card → `/workout/[id]` (`WorkoutDetailScreen`): duration, volume, sets, PR count, session RPE + notes,
    each exercise's ticked sets with e1RM and PR badges (unticked sets hidden, with a count).
  - ✅ PRs are derived on the fly (`SESSION_PR_SQL` in `prEngine.ts`: bests from earlier sessions + earlier-ticked sets),
    so editing any workout recomputes badges. Verified on phone: 30 kg × 10 in a later workout → 3 PR badges instantly.
  - ✅ Edit mode: weight/reps/type/tick (reuses `SetRow` without PREVIOUS), add/delete sets, add/remove exercises,
    exercise notes, details sheet (name, duration in minutes, RPE, notes). All writes via `mutate.ts`.
  - ✅ Repeat (copies exercises + ticked sets as a new session; "workout in progress" sheet if one is active) and
    Delete (confirm sheet → tombstones → back to History). Both verified on phone. 7 new tests (`test/history.test.ts`).
  - Tap a workout → full set list, notes, RPE, PRs.
  - Edit, delete or "repeat this workout".
  - *Accept:* edits sync; PRs recompute.
- [x] **2.2 Routine editing, folders, rep ranges** (M), **done 2026-10-08**
  - ✅ Tap a routine to edit: rename, add/remove/reorder exercises, sets, reps, **target weight** (new optional
    `target_weight_kg` in `template_exercises`, pre-fills sets when started), rest (time picker + presets), delete with
    confirmation, discard-changes prompt. Verified on phone.
  - ✅ (2026-10-08) **Duplicate** (unique "(copy)" title; copies unsaved edits too, after a prompt) → opens the copy.
  - ✅ **Folders**: new synced column `workout_templates.folder` (migration v2). Editor folder chips + "New folder";
    Routines tab grouped by folder (collapsible), "…" → rename / merge / remove folder. Workout tab shows the folder.
  - ✅ **Rep ranges**: type `8-12` in Reps (`rep_min`/`rep_max` in the JSON; `parseRepTarget` in shared). In a workout the
    card shows "Target 8–12 reps" and the reps box hint is the range (reps start empty).
  - ✅ **Per-set targets**: "Customise sets" → table of type (tap: working → W → D → F), weight, reps per set (`sets[]`);
    "Same for all sets" collapses back. Starting the routine creates exactly those sets (`expandTemplateSets`).
  - ✅ Android Back in the editor = Cancel (asks before dropping edits). Verified on phone; 7 shared + 5 mobile tests.
  - Edit or reorder existing routines; duplicate; folders.
  - Rep ranges (e.g. 8–12) and per-set targets in templates.
  - *Schema:* extend the `template_exercises` JSON with `rep_min` / `rep_max` and `sets[]`.
- [x] **2.3 Custom exercises** (S), **done 2026-10-08**
  - ✅ Exercise picker: **New** button, or "Create “<search text>”" when nothing matches → sheet with name, primary
    muscle, equipment, type. New exercises are picked straight away. Custom rows show a CUSTOM tag + pencil (edit).
  - ✅ **Archive / Restore** (new synced column `exercise_definitions.archived_at`): hidden from the picker, kept in
    history, PRs and routines; "Show archived (N)" lists them. Canonical exercises can't be edited. Duplicate names
    (case-insensitive, live + unarchived) are blocked. Verified on phone; 4 mobile tests. Sync: via mutate.ts (Phase 8).
  - ✅ (user request) **18 more canonical exercises** (ids 27–44): Seated Row (Cable), Bicep/Hammer Curl (Cable),
    Zottman Curl, Wrist Curl, Reverse Wrist Curl, Wrist Rotation, Incline Bench (Barbell), Chest Fly (Dumbbell),
    Incline Chest Fly, Pec Deck, Lateral Raise (Cable), Band Pull-Apart, Rear Delt Fly, Shoulder Press (Dumbbell /
    Machine), Triceps Pushdown (Rope), Dip; "Triceps Pushdown (Cable)" renamed "(Straight Bar)". All have form guides;
    14 new illustrations (+ Lat Pulldown). The seed now upserts canonical rows so renames reach existing installs.
  - Create, edit and archive your own exercises (name, muscle, equipment, type). The schema already supports `user_id`.
  - *Accept:* custom exercises appear in the selector and history, and sync.
- [x] **2.4 Exercise types** (L) *(schema change)*, **done 2026-10-08**
  - ✅ `exercise_definitions.tracking_type` + `sets.duration_s` / `sets.distance_m` (migration v3; zod, Prisma, seed).
    Six types (`packages/shared/src/tracking.ts`): weight × reps, reps only, bodyweight + weight (+kg, empty = BW),
    assisted (−kg, less is better), time, distance + time. Canonical: Push Up / Hanging Leg Raise / Band Pull-Apart =
    reps only; Pull Up / Dip = bodyweight + weight; Plank = time; Running / Cycling / Rowing = distance + time.
  - ✅ Set table columns, PREVIOUS text, ghost values, placeholders and History lines follow the type
    (`formatSetSummary`). Time input: m:ss or keypad digits (130 = 1:30). Distance in km / mi (stored in m).
  - ✅ **Inline stopwatch** for timed sets (wall-clock based); stopping saves the time and ticks the set.
  - ✅ **PRs per type** (`RECORD_KINDS`): most reps, heaviest added weight, least assistance, longest, furthest,
    best pace (shared `setMetrics` mirrored by `BEST_COLUMNS` SQL). Volume only counts real load
    (`countsTowardVolume`); e1RM / Analytics bests only for weight × reps. CSV export gains duration / distance.
  - ✅ Routine targets per type (time, distance, ±weight); custom-exercise editor picks the logging type.
  - Verified on phone (Plank stopwatch 0:06, Pull Up +KG/BW, Running 5 km · 25:00 with pace in History).
    10 shared + 4 mobile tests.
  - Types: weight × reps, bodyweight, weighted bodyweight, assisted (negative), duration, distance + duration.
  - Inline stopwatch for timed sets.
  - *Schema:* `exercise_definitions.tracking_type`; `sets.duration_s`, `sets.distance_m`. PR logic per type.
- [x] **2.5 Supersets / circuits** (M), **done 2026-10-08**
  - ✅ `session_exercises.superset_group` (migration v4) + `superset_group` in routine exercises; carried into a workout
    from a routine and by "Repeat". Pure helpers in `packages/shared/src/supersets.ts` (labels A1/A2/B1, link / unlink,
    cleanup of singletons and gaps), 4 tests + 2 mobile tests.
  - ✅ Link / unlink "Superset with next" in the routine editor and the workout overview drawer; labels everywhere
    (cards, overview, History). Each superset page shows a strip of its members with progress (tap to jump).
  - ✅ Ticking a set in A1 → no rest, jump to A2; after the last member → rest timer, back to the first member with
    sets left. Verified on phone.
  - Group exercises; the pager shows the grouped exercises together and auto-advances A1 → A2 → rest.
  - *Schema:* `session_exercises.superset_group`.
- [x] **2.6 Workout editing in-session** (S), **done 2026-10-08**
  - ✅ Overview drawer: move up / down (▲▼; supersets an exercise leaves are dissolved; the pager follows the exercise
    on screen), **replace** (⇄ → picker; keeps its sets, notes and place).
  - ✅ **Per-set notes** (new synced column `sets.notes`, migration v5): note box in the set sheet (tap the set number);
    shown under the set in the workout and in History; in the CSV export. 3 mobile tests. Verified on phone.
  - (Drag-to-reorder skipped in favour of buttons: no gesture library needed and works one-handed.)
  - Reorder exercises (drag in the overview drawer), replace an exercise (keep its sets), per-set notes.
- [x] **2.7 Per-set RPE / RIR input** (S), **done 2026-10-08**
  - ✅ Settings → Workout → "Effort per set": Off / RPE / RIR (`preferences.effort_input`). Adds a column; tap it for a
    quick picker (RPE 6–10 in halves, or RIR 5+…0). Always stored as RPE in `sets.rpe` (RIR = 10 − RPE,
    `packages/shared/src/effort.ts`, 3 tests). History shows "@8" or "RIR 2". Verified on phone.
  - Optional column toggled in settings. RIR ↔ RPE mapping (RPE 10 = RIR 0).
  - The data model already has `sets.rpe`.
- [x] **2.8 Smarter rest timer** (S), **done 2026-10-08**
  - ✅ "Rest m:ss" button on each exercise card → time picker; sets this workout's rest for the exercise and remembers it
    (`preferences.exercise_rest`) for next time. Order: routine/workout value → remembered → default (`resolveRestSeconds`).
  - ✅ Settings: **Warm-up rest** (after W sets; "Same" = off) and **Start rest timer on ✓** toggle. 3 shared tests.
  - Per-exercise default that remembers the last value used.
  - Separate warm-up rest; auto-start on ✓ (toggle).
- [x] **2.9 Plate calculator** (S), **done 2026-10-08**
  - ✅ `packages/shared/src/plates.ts`: bounded knapsack per side (fewest plates, heaviest first on ties; nearest loadable
    weight, ties lighter; respects pairs owned; kg or lb gyms). 5 tests.
  - ✅ Sheet with bar drawing, "25 + 15 kg per side", nearest-weight warning, "Use 100 kg" → writes the set's weight.
    Gyms (`preferences.plate_profiles`): add / switch / rename / delete, unit, bar weight, pairs per plate.
  - ✅ Opens from a **Plates** button on barbell exercises (next unticked set) and by holding a weight box. (Holding a
    box that already has focus shows Android's text menu instead, hence the button.) Verified on phone.
  - Configurable bar(s) and plate inventory, per gym.
  - Shows the plates per side; falls back to the nearest loadable weight.
  - Opens from the KG input.
- [x] **2.10 Warm-up set generator** (S), **done 2026-10-08**
  - ✅ **Warm-up** button (weight × reps exercises): compound (barbell + leg press / DB incline / shoulder presses)
    40/60/80 % × 8/5/3, isolation 50 % × 10, from the first working set's weight (or last time's). Barbell weights round
    to the gym's plates (never below the bar), others to 2.5 kg / 5 lb. Unticked W sets are replaced; working sets move
    down. 5 shared + 1 mobile tests. Verified on phone: 100 kg → W 40×8, 60×5, 80×3.
  - From the first working weight: ramps by exercise class (compound 40/60/80%, isolation 50%), rounded to loadable weights.
  - Inserts warm-up (W) sets. Free (principle 3).
- [x] **2.11 Ongoing workout notification / lock-screen card** (M), **done 2026-10-08** (verified on phone by the user)
  - ✅ Silent sticky notification (channel `workout-ongoing`, lock-screen visible) while a workout runs: "Bench Press ·
    set 2 of 4", "Rest until 22:31 · Next: 100 kg × 5 · 3/9 done"; updates live; removed on finish / discard.
    Confirmed present on the phone (ongoing, silent, 1 action). Settings → "Lock-screen workout card" toggle.
  - ✅ **Complete set ✓** action (`opensAppToForeground: false`): logs the next unticked set (exercise on screen first),
    filling blanks from last time, then PR check + rest timer as usual (`prepareNextSet`, 2 tests).
  - ✅ (2026-10-08, user request) **Lock-screen workout mode**, Maps-style: while a workout runs, the app may show over
    the lock screen (local native module `apps/mobile/modules/lock-screen`: setShowWhenLocked, keyguard state events,
    requestDismissKeyguard; flag persisted so a cold start from the notification applies it). Over the keyguard only
    `LockScreenWorkout` is shown (in a Modal, above any open sheet): exercise + superset strip, set X of Y, last time,
    big −/+ steppers per field (tap to type), **Done** → shared flow (`afterSetCompleted`: superset → next member, end of
    round → rest), rest card (+30s / Skip), ◀ ▶ exercises, Unlock. No history / settings / finish / discard while
    locked. Settings → "Workout on lock screen". Superset flow now lives in the store (`completeSet`), shared by the
    workout screen, lock screen and notification; fixes uneven-set supersets skipping rest. 3 shared tests.
  - ✅ Verified by the user on the phone (2026-10-08): workout over the lock screen after power, steppers + keyboard,
    Done flow, notification shade still usable, swipe up → normal lock screen, tapping the notification brings it back.
  - Persistent notification: current exercise, next set target, rest countdown, a **"Complete set"** action.
  - Needs a dev build (notification actions).
  - *Accept:* a set can be logged without unlocking the phone.
- [ ] **2.12 Fill illustration gaps** (S–M)
  - Find licensed art for the 8 missing exercises, or commission it. Fix the 3 approximations.
  - Built 2026-10-09: all Everkinetic line art replaced with RepDB flat 2D figures (free tier, in-app use with
    attribution), recoloured to light greys on transparent by `build-exercise-images.py`. 43/44 illustrated; only
    Wrist Rotation has no source image. Credit "Exercise data by RepDB (repdb.co)" in form guide + Settings.
  - *Accept:* illustrations look right on the phone (form guide + exercise cards, dark panel), credit visible.
- [x] **2.13 Interval timer for timed sets** (M), spec `docs/superpowers/specs/2026-10-09-interval-timer-design.md`
  - Built 2026-10-09: ▶ on a timed set with a time starts a work/rest countdown (`intervalRunStore`, maths in
    `packages/shared/src/intervals.ts`). Per-exercise "Auto-start next set" (routine `auto_next` → hands-free
    battle rope 15 × 60 s / 30 s; off → plank waits for a tap). One OS alarm per phase change; finished sets are
    logged with their real end time when the app next runs. Banner (pause / skip / stop), lock-screen card,
    ongoing notification text. 12 mobile + 10 shared tests.
  - ✅ Verified by the user on the phone (2026-10-09): countdown, auto-next, beeps (screen on and locked), pause/resume,
    logged sets. Quick actions under an exercise use a 2 × 2 grid when there are 4 ("Auto-next on" was cut off).
  - *Accept:* 3 × 20 s / 10 s on the phone, screen on and locked in a pocket: a beep at every phase change, sets
    logged with correct `duration_s` / `completed_at`, pause/resume while locked.
- [ ] **2.14 Standalone interval timer** (S–M): Tabata / EMOM / AMRAP / custom presets, not logged; reuses 2.13.
- **Exit criteria:** a full Strong-style session (supersets, warm-ups, a timed plank, bodyweight pull-ups) can be logged quickly, offline.

### Phase 3: Progress & insights
Goal: users see their progress clearly, with no caps.

- [ ] **3.1 Exercise detail screen** (M)
  - Per lift: history list, charts (e1RM, top set, volume, best reps at weight) over all time.
  - Opens from a card title, from history and from analytics.
- [ ] **3.2 Records screen** (S)
  - PRs at every rep count (1RM…15RM), heaviest weight, best volume, with dates. A % table (1RM × %).
- [ ] **3.3 Calendar + weekly-target streaks** (S)
  - Month calendar of sessions; streak counted against a weekly goal (e.g. 3×/week) so rest days don't break it.
- [ ] **3.4 Muscle volume** (M) *(schema change)*
  - Add `secondary_muscles` and `movement_pattern` to exercise definitions (and the canonical list).
  - Weekly sets per muscle (primary 1.0 / secondary 0.5) against target bands (e.g. 10–20).
- [ ] **3.5 Bodyweight & measurements** (M) *(new synced table `body_metrics`)*
  - Bodyweight with a trend line (7-day average); circumferences; body-fat %.
  - Quick-log from the finish sheet.
- [ ] **3.6 Progress photos** (M)
  - Stored locally (encrypted folder), optional sync later; side-by-side compare.
- [ ] **3.7 Reports** (S)
  - Weekly summary card (sets, volume, PRs, streak); monthly report; a year-end "Wrapped" later.
- [ ] **3.8 Plateau alerts** (S)
  - e1RM flat or down for 3+ weeks on a lift → gentle insight with a suggested action (deload, rep-range change).
- **Exit criteria:** every logged lift has an uncapped chart and records, and muscle volume is visible weekly.

### Phase 4: Transparent smart progression *(our differentiator)*
Goal: the app tells you what to lift next and why. Deterministic, offline, explainable.

- [ ] **4.1 Progression rule per exercise** (M) *(schema: rule config on the template exercise or a user-exercise settings table)*
  - **None** (default).
  - **Linear:** +inc after N successes; 3 failures → −10%.
  - **Double progression `dp(inc, min, max)`:** all sets ≥ max → +inc and reset to min; else +1 rep. If inc > ~5% of the weight, require max+1.
  - **Reps-sum:** total reps ≥ threshold → +inc.
  - **RIR-based:** load = e1RM / (1 + (targetReps + targetRIR)/30), clamped ±5%.
- [ ] **4.2 "Next session" suggestions in the set table** (M)
  - Pre-fill KG/REPS from the rule, rounded to loadable weights (2.9). A small **"why"** chip explains the change.
  - The user can always override.
- [ ] **4.3 Auto-deload & stall handling** (S)
  - Configurable failure count and percentage. Shown as an insight before applying.
- [ ] **4.4 In-session autoregulation** (S)
  - If the logged RIR misses the target by ≥ 1, suggest −2–4% per RIR point for the next set (JuggernautAI-style).
- [ ] **4.5 Readiness check (optional)** (S)
  - 4 quick sliders (sleep, energy, soreness, motivation) before a workout. A low score suggests −5–10% for the day.
- **Exit criteria:** with a rule enabled, three consecutive sessions produce correct, explained suggestions offline.
  The rules are unit-tested against tables of example sessions.

### Training split & next workout
Spec: `docs/superpowers/specs/2026-10-09-training-split-design.md`.

- [ ] **Training split & next workout** (M)
  - Settings → Training plan: preset (Push / Pull / Cardio) then rename / add / remove / reorder days; runs as a rotation.
  - Routines link to a day (builder "Plan day" chips); Workout tab shows "Next: <day>", "Pick another day".
  - "Start empty workout" opens a draft editor; after finishing, "Save as routine?" keeps what was logged.

### Phase 5: Programs & periodisation
Goal: follow multi-week programs, not just single routines.

- [ ] **5.1 Program model** (L) *(new synced tables: `programs`, `program_weeks/days` or a JSON doc)*
  - Weeks → days → exercises. Sets as fixed values, % of Training Max, or an RIR target. AMRAP flags; a deload week.
- [ ] **5.2 Free classic program library** (L)
  - Bundled JSON: 5/3/1 (BBB, Beginners), nSuns LP, GZCLP, Reddit PPL, StrongLifts-style 5×5, Texas Method.
  - Training Max + AMRAP bump rules (0–1 reps: same; 2–3: +2.5 kg; 4–5: +5 kg; >5: +7.5 kg; upper body half).
- [ ] **5.3 Program builder & scheduling** (L)
  - Build or edit programs; "today's workout" on the Workout tab; skip or reschedule a day.
  - Builds on "Training split & next workout" (plan days, next-day card).
- [ ] **5.4 Mesocycles + volume feedback (RP-style, optional)** (M)
  - RIR ramps 3 → 0 across weeks.
  - Post-exercise pump/soreness/workload feedback adjusts next week's sets (+2 / +1 / 0 / −1), **with the reasoning shown**.
- **Exit criteria:** a user can run 5/3/1 for a full cycle with correct percentages, AMRAP-driven TM changes and a deload.

### Phase 6: Ecosystem & import/export (on-device)
Goal: switching to us is easy and data flows to the rest of the phone. No server needed.

- [ ] **6.1 Import from Strong / Hevy CSV** (M), plus CSV export (already started in 1.2).
- [ ] **6.2 Health Connect** (M): write workouts (and bodyweight) on-device; read bodyweight.
- [ ] **6.3 Home-screen widget** (M): start a workout or today's program day, and the weekly streak.
- [ ] **6.4 Share cards** (S): a workout summary image (PRs, volume) via the share sheet. No social network needed.
- **Exit criteria:** a Strong user can import their history and see it in charts, fully offline.

### Phase 7: Later / optional (evaluate after Phase 6)
- [ ] Muscle recovery heatmap (fatigue decays over about 6 days; primary 1.0 / secondary 0.5): needs 3.4.
- [ ] Strength Score (DOTS-normalised big lifts, 0–100).
- [ ] Equipment / gym profiles + exercise swap suggestions (same muscle and pattern, filtered by equipment).
- [ ] Time-boxed sessions (trim the workout to 30/45/60 min).
- [ ] Rule-based workout generator (fresh muscles + equipment + time), always showing why each exercise was picked.
- [ ] Unilateral L/R set tracking (none of the six logging apps document it, so it could set us apart).
- [ ] Tempo and partial reps fields.
- [ ] Cardio/GPS recording UI (the telemetry pipeline already exists).
- [ ] Wear OS companion.
- [ ] Licensed 3D anatomical illustrations with highlighted muscles (as in the reference image).
- [ ] iOS release.

### Phase 8: Backend, accounts & cloud sync  *(deferred: needs Docker or hosted databases)*
Goal: optional accounts, cloud backup and multi-device sync. The code already exists (🧪) but has never been run.
Start only when the offline app is solid and you want sync. Requires Docker Desktop **or** hosted Postgres (+ TimescaleDB) and Redis.

- [ ] **8.1 Backend up locally** (M)
  - `npm run infra:up` → `db:migrate` (commit the generated migrations) → `db:seed` → start the API and worker.
  - *Accept:* register from the app → push/pull succeeds → rows visible in Postgres → BullMQ jobs complete.
- [ ] **8.2 Turn on cloud sync** (S)
  - Flip `CLOUD_SYNC_ENABLED`; restore the sign-in UI.
  - First sign-in uploads the full local history (re-enqueue everything, or run a one-off bulk upload).
- [ ] **8.3 End-to-end sync test plan** (M), in `docs/sync-test.md`:
  - Offline → reconnect.
  - Two devices log sets in the same session (append-only sets survive).
  - Same routine edited on both (last write wins).
  - Delete propagates as a tombstone.
  - Kill the app mid-push (no duplicates).
- [ ] **8.4 Server tests** (M): vitest + test DB covering push ownership/ref checks, LWW, pull snapshot.
- [ ] **8.5 Production backend** (L)
  - Deploy (managed Postgres + Timescale, Redis), migrations in CI, refresh tokens.
  - `/sync/pull` pagination or snapshot bootstrap, rate limiting, backups, monitoring.
- [ ] **8.6 Account features** (S): password reset, delete account (GDPR), multi-device management.
- [ ] **8.7 Cloud extras** (later): progress-photo cloud sync, social feed / leaderboards (the fan-out worker stub exists), share links.
- **Exit criteria:** two phones on one account stay in sync through offline periods; the backend runs in production with backups.

---

## 5. Cross-cutting checklist (apply to every item)

- [ ] Works in airplane mode (or degrades with a clear message). Until Phase 8, nothing may *require* a server.
- [ ] Uses design tokens and bottom sheets (no `Alert.alert`, no hard-coded colours).
- [ ] Synced data goes through `mutate.ts`. Schema changes follow the four-places rule. Migrations are append-only.
- [ ] Weights stored in kg, displayed in the user's unit.
- [ ] Tests for any rule/maths logic (progression, PRs, conversions).
- [ ] Verified on the emulator (screenshot) before ticking.
- [ ] `CLAUDE.md` / this file updated if architecture or scope changed.

## 6. Data-model changes planned (summary)

| Phase | Change |
|---|---|
| 2.2 ✅ | `workout_templates.folder`; `template_exercises[]` + `rep_min`, `rep_max`, `sets[]` (superset_group → 2.5) |
| 2.3 ✅ | `exercise_definitions.archived_at` |
| 2.4 ✅ | `exercise_definitions.tracking_type`; `sets.duration_s`, `sets.distance_m` |
| 2.5 ✅ | `session_exercises.superset_group`; `template_exercises[].superset_group` |
| 2.6 ✅ | `sets.notes` |
| 3.4 | `exercise_definitions.secondary_muscles[]`, `movement_pattern` |
| 3.5 | new table `body_metrics` (date, type, value) |
| 4.1 | progression rule config (per template exercise / per user-exercise) |
| 5.1 | new `programs` model (weeks/days/sets with % TM, AMRAP, RIR) |

## 7. Open decisions

- Monetisation model, if any. Principle 3 says the basics stay free. A possible Pro tier: programs, advanced analytics, cloud photo sync.
- ~~Accounts required or optional?~~ **Decided 2026-10-07:** offline-only for now; accounts/sync optional and deferred to Phase 8.
- Illustration source for the missing and approximate exercises (licence or commission).
- Whether to support iOS, and when.

## 8. Research notes (condensed)

| App | Notable for | Main complaints | Price (approx.) |
|---|---|---|---|
| Strong | Fastest logging, warm-up/plate calcs (Pro), CSV export, watch + Live Activity | 3-routine cap, weak Android, data loss after updates, paid→subscription | $29.99/yr, $99.99 lifetime |
| Hevy | Set types, RPE toggle, supersets, measurements + photos, Strong CSV import, Health Connect, **Android lock-screen card**, Wear OS, social | 4 routines / 3-month charts free cap, sync bugs, weak AI trainer | $23.99/yr, $74.99 lifetime |
| JEFIT | 1,400+ exercises, community plans, tempo | Heavy ads, fake sales, editing behind a paywall | $69.99/yr |
| FitNotes | Fully offline, free, per-muscle volume, configurable plate calc, 1RM table | No cloud backup → data loss; dated UI | Free |
| Gravitus | Auto-progressing programs, strength score, interactive charts | Free features moved behind a paywall, weak Android | ~$60–80/yr |
| Setgraph | PRs at every rep range, superset/circuits, recovery map, illustrations | Feature creep, small UX bugs | $29.99/yr |
| Fitbod | Recovery heatmap, equipment profiles, time-boxed AI workouts | "Random" workouts, price rises | $95.99/yr |
| Alpha Progression | Per-set weight/rep/RIR recommendations (offline), mesocycles, warm-up calc | Restricted free tier, no import | $79.99/yr |
| Boostcamp | Free classic programs (5/3/1, nSuns, GZCLP…), program builder, TM/AMRAP | Surprise billing, support | ~$60/yr |
| Liftosaur | Scriptable progressions (`lp`, `dp`, `sum`), open source | Learning curve | Mostly free |
| StrongLifts | Linear progression + auto-deload (3 fails → −10%) | Warm-up/plates paywalled | $59.99/yr |
| RP Hypertrophy | Pump/soreness/workload-driven volume, mesocycles | $300/yr, needs internet, "black box" | $299.99/yr |
| JuggernautAI | Readiness check, RPE-driven back-off sets, meet peaking | Price, powerlifting-only | $349.99/yr |
