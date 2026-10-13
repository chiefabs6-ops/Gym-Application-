import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Check,
  ChevronLeft,
  Clock,
  ListChecks,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Trophy,
  Weight,
} from 'lucide-react-native';
import { countsTowardVolume, epley1RM, formatEffort, formatPace, formatSetSummary, supersetLabels, type PRKind, type TrackingType } from '@gym/shared';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { ConfirmSheet, type ConfirmRequest } from '../components/ConfirmSheet';
import { ExerciseSelector } from '../components/ExerciseSelector';
import type { SessionExerciseView } from '../components/ExerciseFocusCard';
import { PRBadge } from '../components/PRBadge';
import { SET_TYPE_STYLE, SetRow, SetTableHeader, type SetViewRow } from '../components/SetRow';
import { SetTypeSheet } from '../components/SetTypeSheet';
import { WorkoutConflictSheet } from '../components/WorkoutConflictSheet';
import { WorkoutDetailsSheet, type WorkoutDetails } from '../components/WorkoutDetailsSheet';
import * as workouts from '../db/repositories/workouts';
import { useLiveQuery } from '../db/useLiveQuery';
import { SESSION_PR_SQL, sessionPRs, type SessionSetBests } from '../services/prEngine';
import { useActiveWorkoutStore } from '../state/activeWorkoutStore';
import { useSettingsStore, useUnits } from '../state/settingsStore';
import { cardShadow, colors } from '../theme';

interface SessionView extends WorkoutDetails {
  id: string;
  deleted_at: number | null;
}

const formatDuration = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(total / 60);
  return h > 0 ? `${h}h ${String(total % 60).padStart(2, '0')}m` : `${total}m`;
};

/** History → one finished workout: full set list, notes, RPE and PRs; edit, repeat or delete it. */
export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = id ?? '';
  const units = useUnits();

  const [editing, setEditing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [setTypeTarget, setSetTypeTarget] = useState<SetViewRow | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);

  const start = useActiveWorkoutStore((s) => s.start);
  const discardActive = useActiveWorkoutStore((s) => s.discard);
  const activeSession = useActiveWorkoutStore((s) => s.sessionId);
  const activeStartedAt = useActiveWorkoutStore((s) => s.startedAt);

  const { data: sessionRows, loading } = useLiveQuery<SessionView>(
    `SELECT id, title, start_time, end_time, notes, rpe, deleted_at FROM workout_sessions WHERE id = ?`,
    [sessionId],
    ['workout_sessions'],
  );
  const session = sessionRows[0];

  const { data: exercises } = useLiveQuery<SessionExerciseView>(
    `SELECT se.id, se.exercise_id, se.rest_seconds, se.notes, se.superset_group,
            e.name, e.primary_muscle, e.equipment, e.tracking_type
     FROM session_exercises se JOIN exercise_definitions e ON e.id = se.exercise_id
     WHERE se.session_id = ? AND se.deleted_at IS NULL ORDER BY se.order_index`,
    [sessionId],
    ['session_exercises', 'exercise_definitions'],
  );
  const { data: sets } = useLiveQuery<SetViewRow & { tracking_type: TrackingType }>(
    `SELECT s.id, s.session_exercise_id, s.order_index, s.set_type, s.weight_kg, s.reps, s.duration_s, s.distance_m,
            s.is_completed, s.notes, s.rpe, e.tracking_type
     FROM sets s JOIN session_exercises se ON se.id = s.session_exercise_id
     JOIN exercise_definitions e ON e.id = se.exercise_id
     WHERE se.session_id = ? AND s.deleted_at IS NULL AND se.deleted_at IS NULL ORDER BY s.order_index`,
    [sessionId],
    ['sets', 'session_exercises', 'exercise_definitions'],
  );
  // Recomputed from history whenever anything changes, so edits here (or to older workouts) update badges.
  const { data: prRows } = useLiveQuery<SessionSetBests>(SESSION_PR_SQL, [sessionId], [
    'sets',
    'session_exercises',
    'workout_sessions',
  ]);
  const prs = useMemo(() => sessionPRs(prRows), [prRows]);
  const labels = useMemo(() => supersetLabels(exercises.map((e) => e.superset_group)), [exercises]);

  const setsByExercise = useMemo(() => {
    const map = new Map<string, SetViewRow[]>();
    for (const s of sets) {
      const list = map.get(s.session_exercise_id) ?? [];
      list.push(s);
      map.set(s.session_exercise_id, list);
    }
    return map;
  }, [sets]);

  const completed = sets.filter((s) => s.is_completed === 1);
  const volume = completed
    .filter((s) => s.set_type !== 'warmup' && countsTowardVolume(s.tracking_type))
    .reduce((sum, s) => sum + (s.weight_kg ?? 0) * (s.reps ?? 0), 0);
  const prCount = Object.keys(prs).length;

  const toggleComplete = useCallback(
    (setId: string, done: boolean) => void workouts.setCompleted(setId, done),
    [],
  );

  // A deleted workout (here or via restore) leaves nothing to show: go back to the list.
  const gone = !loading && (!session || session.deleted_at !== null || session.end_time === null);
  useEffect(() => {
    if (gone && router.canGoBack()) router.back();
  }, [gone]);

  const launchRepeat = async () => {
    await start({ repeatOf: sessionId });
    router.navigate('/');
  };

  if (loading || gone || !session || session.end_time === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface">
        {loading ? <ActivityIndicator color={colors.accent} /> : <Text className="text-ink-subtle">Workout not found.</Text>}
      </SafeAreaView>
    );
  }

  const title = session.title ?? 'Workout';
  const startDate = new Date(session.start_time);
  const finishedSession: WorkoutDetails = { ...session, end_time: session.end_time };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-surface-border px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-xl bg-surface-raised active:opacity-70"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={20} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-ink" numberOfLines={1}>
            {title}
          </Text>
          <Text className="text-xs text-ink-subtle" numberOfLines={1}>
            {startDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            {' · '}
            {startDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        {editing ? (
          <Pressable
            onPress={() => setEditing(false)}
            className="flex-row items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 active:opacity-80"
          >
            <Check size={16} color={colors.bg} strokeWidth={3} />
            <Text className="font-bold text-surface">Done</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setEditing(true)}
            className="flex-row items-center gap-1.5 rounded-xl bg-surface-raised px-4 py-2.5 active:opacity-70"
            accessibilityLabel="Edit workout"
          >
            <Pencil size={15} color={colors.ink} />
            <Text className="font-semibold text-ink">Edit</Text>
          </Pressable>
        )}
      </View>

      <KeyboardAwareScrollView
        bottomOffset={16}
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Summary */}
        <View className="rounded-card border border-surface-border bg-surface-raised p-4" style={cardShadow}>
          <View className="flex-row gap-2">
            <Stat icon={<Clock size={14} color={colors.muted} />} label="Duration" value={formatDuration(session.end_time - session.start_time)} />
            <Stat icon={<Weight size={14} color={colors.muted} />} label="Volume" value={units.display(volume, 0) || '0'} unit={units.label} />
            <Stat icon={<ListChecks size={14} color={colors.muted} />} label="Sets" value={String(completed.length)} />
            <Stat icon={<Trophy size={14} color={prCount > 0 ? colors.pr : colors.muted} />} label="PRs" value={String(prCount)} highlight={prCount > 0} />
          </View>
          {(session.rpe !== null || session.notes) && (
            <View className="mt-3 gap-2">
              {session.rpe !== null && (
                <Text className="text-sm text-ink-muted">
                  Session RPE <Text className="font-bold text-ink">{session.rpe}</Text>
                </Text>
              )}
              {session.notes && <Text className="text-sm leading-5 text-ink-muted">{session.notes}</Text>}
            </View>
          )}
          {editing && (
            <Pressable
              onPress={() => setDetailsOpen(true)}
              className="mt-3 flex-row items-center justify-center gap-2 rounded-xl border border-surface-border py-2.5 active:opacity-70"
            >
              <Pencil size={14} color={colors.muted} />
              <Text className="text-sm font-medium text-ink-muted">Edit name, duration, RPE & notes</Text>
            </Pressable>
          )}
        </View>

        {exercises.length === 0 && (
          <Text className="py-6 text-center text-ink-subtle">No exercises in this workout.</Text>
        )}

        {exercises.map((exercise, i) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            supersetLabel={labels[i] ?? null}
            sets={setsByExercise.get(exercise.id) ?? []}
            prs={prs}
            editing={editing}
            onToggleComplete={toggleComplete}
            onOpenSetType={setSetTypeTarget}
            onRemove={() =>
              setConfirm({
                title: `Remove ${exercise.name}?`,
                message: 'Its sets will be deleted from this workout.',
                confirmLabel: 'Remove exercise',
                tone: 'destructive',
                onConfirm: () => void workouts.removeSessionExercise(exercise.id),
              })
            }
          />
        ))}

        {editing ? (
          <Pressable
            onPress={() => setSelectorOpen(true)}
            className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-surface-border py-4 active:opacity-70"
          >
            <Plus size={16} color={colors.ink} />
            <Text className="font-semibold text-ink">Add exercise</Text>
          </Pressable>
        ) : (
          <View className="mt-2 gap-2">
            <Pressable
              onPress={() => (activeSession ? setConflictOpen(true) : void launchRepeat())}
              className="h-14 flex-row items-center justify-center gap-2 rounded-xl bg-accent active:opacity-80"
            >
              <RotateCcw size={18} color={colors.bg} />
              <Text className="text-base font-bold text-surface">Repeat this workout</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                setConfirm({
                  title: 'Delete this workout?',
                  message: `“${title}” and its ${completed.length} logged set${completed.length === 1 ? '' : 's'} will be removed from History, charts and PRs. This can’t be undone.`,
                  confirmLabel: 'Delete workout',
                  tone: 'destructive',
                  onConfirm: () => void workouts.discardSession(sessionId),
                })
              }
              className="h-12 flex-row items-center justify-center gap-2 rounded-xl border border-settype-failure/30 active:opacity-70"
            >
              <Trash2 size={16} color={colors.danger} />
              <Text className="font-semibold text-settype-failure">Delete workout</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAwareScrollView>

      <WorkoutDetailsSheet
        workout={detailsOpen ? finishedSession : null}
        onClose={() => setDetailsOpen(false)}
        onSave={(fields) => {
          setDetailsOpen(false);
          void workouts.updateSessionDetails(sessionId, fields);
        }}
      />
      <ExerciseSelector
        visible={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelect={(e) => void workouts.addExerciseToSession(sessionId, e.id)}
      />
      <SetTypeSheet set={setTypeTarget} onClose={() => setSetTypeTarget(null)} />
      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
      <WorkoutConflictSheet
        routineTitle={conflictOpen ? title : null}
        startedAt={activeStartedAt}
        onClose={() => setConflictOpen(false)}
        onResume={() => {
          setConflictOpen(false);
          router.navigate('/');
        }}
        onDiscardAndStart={() => {
          setConflictOpen(false);
          void discardActive().then(launchRepeat);
        }}
      />
    </SafeAreaView>
  );
}

/* ───────────────────────────── Exercise card ───────────────────────────── */

interface CardProps {
  exercise: SessionExerciseView;
  supersetLabel: string | null;
  sets: SetViewRow[];
  prs: Record<string, PRKind[]>;
  editing: boolean;
  onToggleComplete: (setId: string, completed: boolean) => void;
  onOpenSetType: (set: SetViewRow) => void;
  onRemove: () => void;
}

function ExerciseCard({ exercise, supersetLabel, sets, prs, editing, onToggleComplete, onOpenSetType, onRemove }: CardProps) {
  const units = useUnits();
  const effort = useSettingsStore((s) => s.effort_input);
  const [notes, setNotes] = useState(exercise.notes ?? '');
  useEffect(() => setNotes(exercise.notes ?? ''), [exercise.notes]);

  // Read-only view lists what was actually done; edit mode shows every set so unticked ones can be fixed.
  const visible = editing ? sets : sets.filter((s) => s.is_completed === 1);
  const skipped = sets.length - sets.filter((s) => s.is_completed === 1).length;
  let working = 0;

  return (
    <View className={`rounded-card border bg-surface-raised p-4 ${supersetLabel ? 'border-superset/40' : 'border-surface-border'}`}>
      <View className="mb-3 flex-row items-start gap-3">
        <View className="flex-1">
          <Text className="text-lg font-bold text-ink">
            {supersetLabel && <Text className="text-superset">{supersetLabel} </Text>}
            {exercise.name}
          </Text>
          <Text className="text-xs capitalize text-ink-subtle">
            {exercise.primary_muscle.replace('_', ' ')} · {exercise.equipment}
          </Text>
        </View>
        {editing && (
          <Pressable
            onPress={onRemove}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-lg bg-settype-failure/15 active:opacity-70"
            accessibilityLabel={`Remove ${exercise.name}`}
          >
            <Trash2 size={16} color={colors.danger} />
          </Pressable>
        )}
      </View>

      {editing ? (
        <TextInput
          value={notes}
          onChangeText={setNotes}
          onEndEditing={() => {
            if ((notes.trim() || null) !== exercise.notes) void workouts.updateSessionExerciseNotes(exercise.id, notes);
          }}
          placeholder="Notes for this exercise"
          placeholderTextColor={colors.faint}
          multiline
          className="mb-3 rounded-xl bg-surface-elevated px-3 py-2.5 text-sm text-ink"
        />
      ) : (
        exercise.notes && <Text className="mb-3 text-sm italic text-ink-muted">{exercise.notes}</Text>
      )}

      {editing ? (
        <>
          <SetTableHeader trackingType={exercise.tracking_type} showPrevious={false} />
          <View className="gap-1">
            {visible.map((s) => (
              <SetRow
                key={s.id}
                set={s}
                trackingType={exercise.tracking_type}
                workingNumber={s.set_type === 'warmup' ? 0 : ++working}
                prKinds={prs[s.id]}
                showPrevious={false}
                onToggleComplete={onToggleComplete}
                onOpenSetType={onOpenSetType}
              />
            ))}
          </View>
          <Pressable
            onPress={() => void workouts.addSet(exercise.id)}
            className="mt-3 flex-row items-center justify-center gap-2 rounded-xl bg-surface-elevated py-3 active:opacity-70"
          >
            <Plus size={16} color={colors.ink} />
            <Text className="font-semibold text-ink">Add Set</Text>
          </Pressable>
        </>
      ) : visible.length === 0 ? (
        <Text className="text-sm text-ink-faint">No sets ticked off.</Text>
      ) : (
        <View className="gap-1">
          {visible.map((s) => {
            const type = SET_TYPE_STYLE[s.set_type];
            const number = s.set_type === 'warmup' ? 0 : ++working;
            const e1rm =
              exercise.tracking_type === 'weight_reps' && s.set_type !== 'warmup' && s.weight_kg && s.reps
                ? epley1RM(s.weight_kg, s.reps)
                : 0;
            return (
              <View key={s.id}>
                <View className="flex-row items-center gap-3 py-1">
                  <View className={`h-7 w-8 items-center justify-center rounded-lg ${type.bg}`}>
                    <Text className={`text-sm font-bold ${type.text}`}>{type.label || number}</Text>
                  </View>
                  <Text className="flex-1 text-base font-semibold tabular-nums text-ink">
                    {formatSetSummary(exercise.tracking_type, s, units.unit, true) || '—'}
                    {s.rpe !== null && (
                      <Text className="text-sm font-normal text-ink-subtle">
                        {'  '}
                        {effort === 'rir' ? `RIR ${formatEffort(s.rpe, 'rir')}` : `@${s.rpe}`}
                      </Text>
                    )}
                  </Text>
                  {e1rm > 0 && (
                    <Text className="text-xs tabular-nums text-ink-faint">e1RM {units.display(e1rm, 0)}</Text>
                  )}
                  {exercise.tracking_type === 'distance_duration' && s.distance_m && s.duration_s ? (
                    <Text className="text-xs tabular-nums text-ink-faint">
                      {formatPace((s.duration_s * 1000) / s.distance_m, units.unit)}
                    </Text>
                  ) : null}
                </View>
                {s.notes && <Text className="pb-1 pl-11 text-xs italic text-ink-muted">{s.notes}</Text>}
                {prs[s.id] && <PRBadge kinds={prs[s.id]!} />}
              </View>
            );
          })}
        </View>
      )}

      {!editing && skipped > 0 && (
        <Text className="mt-2 text-xs text-ink-faint">
          {skipped} unticked set{skipped === 1 ? '' : 's'} hidden. Tap Edit to see or fix them.
        </Text>
      )}
    </View>
  );
}

function Stat({
  icon,
  label,
  value,
  unit,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  highlight?: boolean;
}) {
  return (
    <View className="flex-1 rounded-xl bg-surface-elevated px-2.5 py-3">
      <View className="mb-1 flex-row items-center gap-1">
        {icon}
        <Text
          className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-ink-subtle"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {label}
        </Text>
      </View>
      <Text className={`text-base font-bold tabular-nums ${highlight ? 'text-pr' : 'text-ink'}`} numberOfLines={1}>
        {value}
        {unit && <Text className="text-xs font-medium text-ink-subtle"> {unit}</Text>}
      </Text>
    </View>
  );
}
