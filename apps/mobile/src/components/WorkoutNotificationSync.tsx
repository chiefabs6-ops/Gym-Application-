import { useEffect, useMemo } from 'react';
import * as Notifications from 'expo-notifications';
import { formatSetSummary, type TrackingType } from '@gym/shared';
import { useLiveQuery } from '../db/useLiveQuery';
import {
  COMPLETE_SET_ACTION,
  dismissWorkoutNotification,
  showWorkoutNotification,
} from '../services/workoutNotification';
import { useActiveWorkoutStore } from '../state/activeWorkoutStore';
import { useIntervalRun } from '../state/intervalRunStore';
import { useRestTimerStore } from '../state/restTimerStore';
import { useSettingsStore } from '../state/settingsStore';

interface Row {
  se_id: string;
  name: string;
  tracking_type: TrackingType;
  set_id: string | null;
  is_completed: number | null;
  weight_kg: number | null;
  reps: number | null;
  duration_s: number | null;
  distance_m: number | null;
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/**
 * Keeps the lock-screen workout card (ROADMAP 2.11) in step with the active workout, and handles its
 * "Complete set" button. Renders nothing; mounted once at the app root.
 */
export function WorkoutNotificationSync() {
  const sessionId = useActiveWorkoutStore((s) => s.sessionId);
  const enabled = useSettingsStore((s) => s.workout_notification);

  // "Complete set" pressed (app running, possibly in the background or with the screen locked).
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.actionIdentifier === COMPLETE_SET_ACTION) void useActiveWorkoutStore.getState().completeNextSet();
    });
    // Pressed while the app process was dead: Android relaunches us with the response waiting.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.actionIdentifier !== COMPLETE_SET_ACTION) return;
      const age = Date.now() - response.notification.date;
      if (age < 60_000) void useActiveWorkoutStore.getState().completeNextSet();
      void Notifications.clearLastNotificationResponseAsync?.().catch(() => undefined);
    });
    return () => sub.remove();
  }, []);

  if (!sessionId || !enabled) return <Dismiss />;
  return <ActiveCard sessionId={sessionId} />;
}

function Dismiss() {
  useEffect(() => {
    void dismissWorkoutNotification();
  }, []);
  return null;
}

function ActiveCard({ sessionId }: { sessionId: string }) {
  const currentIndex = useActiveWorkoutStore((s) => s.currentIndex);
  const restEndsAt = useRestTimerStore((s) => s.endsAt);
  // Interval timer: re-post the card at each phase change (not every second).
  const interval = useIntervalRun(1000);
  const runPhase = interval?.state.phase ?? null;
  const runText = interval && runPhase
    ? `${runPhase.kind === 'work' ? 'Work' : 'Rest'} · set ${runPhase.setIndex + 1}/${interval.run.setIds.length}${interval.run.pausedAt !== null ? ' · paused' : ''} · `
    : '';
  const unit = useSettingsStore((s) => s.unit);
  const { data: rows } = useLiveQuery<Row>(
    `SELECT se.id AS se_id, e.name, e.tracking_type, s.id AS set_id, s.is_completed,
            s.weight_kg, s.reps, s.duration_s, s.distance_m
     FROM session_exercises se
     JOIN exercise_definitions e ON e.id = se.exercise_id
     LEFT JOIN sets s ON s.session_exercise_id = se.id AND s.deleted_at IS NULL
     WHERE se.session_id = ? AND se.deleted_at IS NULL
     ORDER BY se.order_index, s.order_index`,
    [sessionId],
    ['sets', 'session_exercises', 'exercise_definitions'],
  );

  const card = useMemo(() => {
    const exercises = [...new Set(rows.map((r) => r.se_id))];
    const total = rows.filter((r) => r.set_id).length;
    const done = rows.filter((r) => r.is_completed === 1).length;
    if (exercises.length === 0) return { title: 'Workout in progress', body: 'Add an exercise to start logging', canComplete: false };

    // Same search order as "Complete set": the exercise on screen first, then the ones after it, then before.
    const from = Math.min(currentIndex, exercises.length - 1);
    const search = [...exercises.slice(from), ...exercises.slice(0, from)];
    let next: Row | undefined;
    for (const se of search) {
      next = rows.find((r) => r.se_id === se && r.set_id && r.is_completed === 0);
      if (next) break;
    }
    const rest = runText || (restEndsAt && restEndsAt > Date.now() ? `Rest until ${clock(restEndsAt)} · ` : '');
    if (!next) return { title: 'All sets done 🎉', body: `${rest}${done}/${total} sets · open the app to finish`, canComplete: false };

    const sets = rows.filter((r) => r.se_id === next!.se_id && r.set_id);
    const n = sets.findIndex((r) => r.set_id === next!.set_id) + 1;
    const target = formatSetSummary(next.tracking_type, next, unit, true);
    return {
      title: `${next.name} · set ${n} of ${sets.length}`,
      body: `${rest}${target ? `Next: ${target}` : 'Next set: same as last time'} · ${done}/${total} done`,
      canComplete: true,
    };
  }, [rows, currentIndex, restEndsAt, unit, runText]);

  useEffect(() => {
    void showWorkoutNotification(card);
  }, [card]);
  useEffect(() => () => void dismissWorkoutNotification(), []);
  return null;
}
