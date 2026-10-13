# Interval timer (exercise-bound) — design

Date: 2026-10-09 · Status: draft for review

## 1. Goal

Run work/rest intervals inside a workout and log each round as a real set.

- **Battle rope (main use):** 15 sets × 60 s work / 30 s rest. One tap starts it, then it runs hands-free with the
  phone locked in a pocket. Each work phase completes a set (`duration_s = 60`); rest leads straight into the next set.
- **Plank / holds:** the same countdown, but after rest it waits for a tap (you need to get into position).

Success: on the phone, a 15 × 60/30 battle rope run finishes with the screen locked. A beep sounds at every phase
change, and history shows 15 completed sets with correct `duration_s` and `completed_at`.

**Out of scope (separate spec later):** the standalone interval screen (Tabata / EMOM / AMRAP / custom presets,
not logged). It will reuse `intervals.ts` and the run store from this spec.

## 2. Constraints

- Offline-only scope (CLAUDE.md, ROADMAP Phase 8 deferral): **no new synced columns or tables**, no Prisma/server
  changes.
- Rule 4: timers keep absolute deadlines from the wall clock; anything that must happen in background uses
  OS-scheduled `expo-notifications`. Android pauses JS when the phone is locked.
- All set writes go through `apps/mobile/src/db/mutate.ts` (via the existing set-completion path).
- One active timer at a time: the rest timer and an interval run are mutually exclusive.

## 3. Data

Interval setup reuses existing fields:

| Meaning | Routine (`templateExerciseSchema`) | Workout |
|---|---|---|
| Number of sets | `target_sets` / `sets` | rows in `sets` |
| Work time | `target_duration_s` | the set's target time |
| Rest time | `rest_seconds` | `resolveRestSeconds()` (existing) |
| Auto-start next set | **new** `auto_next` | **new** `resolveAutoNext()` |

### 3.1 `auto_next`

- `packages/shared/src/tables.ts`: add to `templateExerciseSchema`:
  `auto_next: z.boolean().nullable().default(null)`. This sits inside the `template_exercises` JSON column, so it
  needs no migration and no Prisma change. Older routines parse as `null`.
- `packages/shared/src/settings.ts`: add preference
  `exercise_auto_next: z.record(z.boolean()).catch({})` (mirrors `exercise_rest`).
- `resolveAutoNext({ templateValue, exerciseId }, settings)`, with precedence:
  1. the routine's `auto_next` (looked up via `workout_sessions.template_id`, then the template exercise with the same
     `exercise_id`), if not null;
  2. `settings.exercise_auto_next[exerciseId]`;
  3. `false`.

## 4. Engine

### 4.1 `packages/shared/src/intervals.ts` (pure, unit-tested)

- `buildTimeline({ setIds, workS, restS })` returns an ordered phase list
  `[{ kind: 'work' | 'rest', setIndex, offsetMs, durationMs }]`: work₁, rest₁, …, workₙ, with **no rest after the
  last set**. `restS = 0` means work phases back to back.
- `phaseAt(timeline, { startedAt, pausedTotalMs, pausedAt }, now)` returns
  `{ phase, setIndex, remainingMs, elapsedInPhaseMs, done }`. While paused, `now` is clamped to `pausedAt`.
- `transitionTimes(timeline, run)` returns the absolute epoch ms of every phase end, for notifications.
- `finishedWork(timeline, run, now)` returns `[{ setIndex, endedAt }]` for every work phase whose end is ≤ now.

### 4.2 `apps/mobile/src/state/intervalRunStore.ts` (Zustand, persisted; modelled on `restTimerStore.ts`)

State: `sessionExerciseId`, `exerciseName`, `setIds[]`, `workS`, `restS`, `startedAt`, `pausedAt | null`,
`pausedTotalMs`, `notificationIds[]`.

| Action | Behaviour |
|---|---|
| `start(params)` | Stop the rest timer. Save the run. Schedule one notification per phase end (15 × 60/30 = 29). |
| `pause()` | Set `pausedAt`, cancel all scheduled notifications. |
| `resume()` | Add the paused span to `pausedTotalMs`, reschedule the notifications that remain. |
| `skip()` | Shift the timeline so the current phase ends now, then reconcile and reschedule. A skipped work phase logs the elapsed seconds. |
| `stop()` | If in a work phase, complete that set with the elapsed whole seconds (min 1). Cancel notifications, clear the run. |

Starting the rest timer (`restTimerStore.start`) stops any active run, and the reverse.

### 4.3 Reconciler

Runs on app foreground (`AppState` change to `active`), on store hydration, and on each display tick while a run is
active. For each entry in `finishedWork()` whose set is not yet completed and not deleted, it completes the set via
the existing completion path with:

- `duration_s = workS`
- `completed_at = endedAt` (the phase's real end time, not the time the app woke)
- `{ startRest: false }`: a new option on the completion path, because the run owns rest

The PR engine still runs per set. Sets already completed or deleted by hand are skipped. When `done`, the run clears
itself.

### 4.4 Feedback

- **Foreground:** a 3·2·1 tick before each phase change and a finish beep at each change. This reuses
  `services/restCues.ts` `nextCue()` (pointed at the next transition) and `services/sounds.ts`.
- **Background:** each phase change is a notification on the existing `rest-timer-v2` ALARM channel. Titles say
  "Work: set 4/15" or "Rest 0:30" and respect `rest_sound` / `rest_vibration`.
- **Ongoing / lock screen:** `WorkoutNotificationSync.tsx` and `LockScreenWorkout.tsx` show
  "Battle Rope · WORK 0:42 · 3/15" while a run is active, otherwise the rest countdown as today.

## 5. UI

1. **Set-row timer button** (`components/SetRow.tsx`, the current stopwatch button):
   - If the set has a target time (the routine's `target_duration_s`), tapping it starts a run. With auto-start on,
     the run covers this set and every later unfinished set of the exercise; with it off, only this set.
   - If the set has no target time, the button is the stopwatch, unchanged.
   - The run's `workS` is the target time of the set the run starts from.
2. **`components/IntervalRunBanner.tsx`** takes the `RestTimerBanner` slot in `ActiveWorkoutScreen.tsx`. It shows:
   - the phase label (WORK in the accent colour, REST muted), a large countdown and `Set 3 / 15`;
   - a progress bar for the current phase;
   - pause/resume, skip and stop buttons (lucide icons). Stop asks for confirmation during work.
3. **Set table:** the current set row is highlighted. Completed sets tick off through the normal `useLiveQuery`
   refresh.
4. **Auto-start toggle "Auto-start next set"**, shown only for `duration` / `distance_duration` exercises:
   - in `RoutineBuilderScreen.tsx` next to the per-exercise rest editor, writing `auto_next`;
   - in `ExerciseFocusCard.tsx` next to the rest setting, writing `exercise_auto_next[exerciseId]`.

## 6. Error handling and edge cases

- Notification permission denied: the run still works in the foreground. The banner shows a one-line warning that
  background beeps are off.
- App killed mid-run: the persisted store rehydrates and the reconciler catches up from the timeline.
- Workout finished or discarded during a run: stop the run without logging a partial set.
- A set in the run deleted by hand: the reconciler skips it, and the timeline is not rebuilt.
- Weight-unit display is not affected (no weights involved).

## 7. Testing

- **Unit (vitest, `packages/shared`):** `buildTimeline` (n = 1, no rest, rest = 0), `phaseAt` across boundaries and
  pauses, `transitionTimes`, `finishedWork`, `resolveAutoNext` precedence, parsing old templates without `auto_next`.
- **Mobile (real SQL on node:sqlite, `apps/mobile/test/`):** the reconciler completes the correct sets with the
  right `duration_s` / `completed_at`, skips completed or deleted sets, does not start the rest timer, and a stop
  during work logs the partial seconds.
- **On the phone:** 3 × 20 s / 10 s, once with the screen on and once locked in a pocket. Check beep timing (expect
  at most ~1 s late), the logged values, and pause/resume while locked.

## 8. ROADMAP

Add an "Interval timer for timed sets" item (and a later "Standalone interval timer" item). Tick it only after the
phone test passes.
