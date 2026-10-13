# Interval Timer (exercise-bound) Implementation Plan

> Executed natively in-session (user asked to build it all, then phone-test).

**Goal:** Hands-free work/rest countdown for timed sets that logs each round as a completed set.
**Architecture:** Pure timeline math in `packages/shared/src/intervals.ts`; a persisted Zustand run store that
schedules one OS notification per phase change and a reconciler that completes sets whose work phase has ended.
**Spec:** `docs/superpowers/specs/2026-10-09-interval-timer-design.md`

## Global Constraints
- No new synced columns/tables; no Prisma/server changes.
- Writes to synced tables only via `db/mutate.ts` / repositories.
- Deadlines from the wall clock; OS-scheduled notifications for background.
- Only `duration` tracking type gets the countdown (it is the type with the inline stopwatch).

## Decisions made while planning (refine the spec)
- **Target time = the set's own `duration_s`.** Routines already pre-fill `target_duration_s` into each set's
  `duration_s` (`expandTemplateSets`), and a typed time works the same. A set with a time shows ▶ (countdown);
  an empty one shows ⏱ (stopwatch, unchanged). Each set's own time is its work length.
- **In-workout toggle precedence:** session override (in `activeWorkoutStore.autoNext`, local, per
  session_exercise) → routine `auto_next` → remembered `exercise_auto_next` → false. Without the session
  override, toggling off in a workout could not beat a routine's "on".
- **While a run is active, manual set ticks don't start the rest timer** (the run owns timing).
- **After the run's last set**, the normal rest timer starts for the rest still left
  (`restS − time since the last work ended`), if `rest_auto_start` is on.
- Ongoing notification shows `Intervals · set 3/15 · work/rest` (updated at each phase change), not a live
  seconds countdown: the card is only re-posted on change.

## Review Focus
1. App killed mid-run, relaunched minutes later → all elapsed sets logged with their real end times, no rest timer
   for long-past rests.
2. Pause, then lock the phone → no beeps fire while paused.
3. Set ticked or deleted by hand mid-run → the reconciler doesn't overwrite or resurrect it.
4. Workout finished/discarded mid-run → run cancelled, notifications cancelled, nothing logged.
5. Stop at 0:00.4 into work → logs 1 s (min 1), not 0.

## Tasks
1. **Shared engine + settings** (`intervals.ts`, `settings.ts` `exercise_auto_next` + `resolveAutoNext`,
   `tables.ts` `auto_next`) with vitest: timeline shape, `phaseAt` across boundaries/pauses, `skipClock`,
   `finishedWork`, `transitionTimes`, `resolveAutoNext` precedence, old template parses with `auto_next: null`.
2. **Notifications:** `scheduleAlertAt(at, title, body, style)` (DATE trigger) in `services/notifications.ts`.
3. **Run store** `state/intervalRunStore.ts`: `loadRunPlan`, `start`, `pause`, `resume`, `skip`, `stop`, `cancel`,
   `reconcile`; `activeWorkoutStore`: `autoNext` overrides, `logTimedSet`, rest suppressed during a run,
   finish/discard cancel the run. Mobile tests on node:sqlite cover the Review Focus items.
4. **Cues hook** `useIntervalRunCues()` mounted in `_layout.tsx`: 3·2·1 ticks + beep per phase change, reconcile
   on change and on foreground.
5. **UI:** `IntervalRunBanner`, SetRow ▶/live countdown, ExerciseFocusCard "Auto next" quick action, routine
   builder switch, lock-screen card, ongoing notification text.
6. `npm run typecheck`, `npm test`, ROADMAP item; then phone test (3 × 20 s / 10 s; screen on and locked).
