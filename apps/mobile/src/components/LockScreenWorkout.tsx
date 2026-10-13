import { useEffect, useMemo, useState } from 'react';
import { AppState, Modal, Pressable, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Check, ChevronLeft, ChevronRight, Lock, Minus, Plus, Timer, Unlock } from 'lucide-react-native';
import {
  TRACKING_FIELDS,
  formatDuration,
  formatSetSummary,
  parseDuration,
  supersetLabels,
  supersetMembers,
  weightSign,
  type SetField,
  type SetType,
  type TrackingType,
} from '@gym/shared';
import { addLockListener, isDeviceLocked, requestUnlock, setShowWhenLocked } from '../../modules/lock-screen';
import { IntervalRunBanner } from './IntervalRunBanner';
import { updateSet } from '../db/repositories/workouts';
import { useLiveQuery } from '../db/useLiveQuery';
import { usePreviousPerformance } from '../db/usePreviousPerformance';
import { useActiveWorkoutStore } from '../state/activeWorkoutStore';
import { useRestTimer, useRestTimerStore } from '../state/restTimerStore';
import { useSettingsStore, useUnits } from '../state/settingsStore';
import { colors } from '../theme';

/** True while the keyguard is up (updates on screen on/off, unlock, and app foreground). */
export function useDeviceLocked() {
  const [locked, setLocked] = useState(isDeviceLocked());
  useEffect(() => {
    const sub = addLockListener(setLocked);
    const app = AppState.addEventListener('change', () => setLocked(isDeviceLocked()));
    return () => {
      sub.remove();
      app.remove();
    };
  }, []);
  return locked;
}

/**
 * Lock-screen workout mode (ROADMAP 2.11). While a workout runs (and the setting is on) the app may show over
 * the lock screen, like Maps navigation. When it does, only this screen is shown: the current exercise, its
 * set inputs, Done (same flow as the app: superset → next member, otherwise rest) and the rest timer. History,
 * settings, finishing or discarding all need an unlock. Rendered in a Modal so it sits above any sheet that was
 * open when the phone was locked.
 */
export function LockScreenMode() {
  const sessionId = useActiveWorkoutStore((s) => s.sessionId);
  const enabled = useSettingsStore((s) => s.lock_screen_mode);
  const active = !!sessionId && enabled;
  const locked = useDeviceLocked();

  useEffect(() => {
    setShowWhenLocked(active);
  }, [active]);

  if (!active || !locked || !sessionId) return null;
  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={() => undefined} statusBarTranslucent>
      <LockedWorkout sessionId={sessionId} />
    </Modal>
  );
}

interface ExerciseRow {
  id: string;
  exercise_id: string;
  name: string;
  tracking_type: TrackingType;
  rest_seconds: number | null;
  superset_group: string | null;
}
interface SetRowData {
  id: string;
  session_exercise_id: string;
  set_type: SetType;
  weight_kg: number | null;
  reps: number | null;
  duration_s: number | null;
  distance_m: number | null;
  is_completed: number;
}

type Values = Record<SetField, number | null>;
const column = { weight: 'weight_kg', reps: 'reps', duration: 'duration_s', distance: 'distance_m' } as const;

function LockedWorkout({ sessionId }: { sessionId: string }) {
  const currentIndex = useActiveWorkoutStore((s) => s.currentIndex);
  const setCurrentIndex = useActiveWorkoutStore((s) => s.setCurrentIndex);
  const completeSet = useActiveWorkoutStore((s) => s.completeSet);
  const startedAt = useActiveWorkoutStore((s) => s.startedAt);
  const units = useUnits();

  const { data: sessionRows } = useLiveQuery<{ template_id: string | null }>(
    'SELECT template_id FROM workout_sessions WHERE id = ?',
    [sessionId],
    ['workout_sessions'],
  );
  const { data: exercises } = useLiveQuery<ExerciseRow>(
    `SELECT se.id, se.exercise_id, se.rest_seconds, se.superset_group, e.name, e.tracking_type
     FROM session_exercises se JOIN exercise_definitions e ON e.id = se.exercise_id
     WHERE se.session_id = ? AND se.deleted_at IS NULL ORDER BY se.order_index`,
    [sessionId],
    ['session_exercises', 'exercise_definitions'],
  );
  const { data: sets } = useLiveQuery<SetRowData>(
    `SELECT s.id, s.session_exercise_id, s.set_type, s.weight_kg, s.reps, s.duration_s, s.distance_m, s.is_completed
     FROM sets s JOIN session_exercises se ON se.id = s.session_exercise_id
     WHERE se.session_id = ? AND s.deleted_at IS NULL AND se.deleted_at IS NULL ORDER BY s.order_index`,
    [sessionId],
    ['sets', 'session_exercises'],
  );

  const count = exercises.length;
  const index = Math.min(currentIndex, Math.max(0, count - 1));
  const exercise = exercises[index];
  const groups = useMemo(() => exercises.map((e) => e.superset_group), [exercises]);
  const labels = useMemo(() => supersetLabels(groups), [groups]);
  const exSets = useMemo(() => sets.filter((s) => s.session_exercise_id === exercise?.id), [sets, exercise?.id]);
  const target = exSets.find((s) => s.is_completed === 0);
  const targetPos = target ? exSets.indexOf(target) : -1;

  const previousSource = useSettingsStore((s) => s.previous_source);
  const previous = usePreviousPerformance(exercise?.exercise_id ?? '', sessionId, previousSource, sessionRows[0]?.template_id ?? null);
  const ghost = targetPos >= 0 ? previous[targetPos] : undefined;

  if (!exercise) {
    return (
      <Shell startedAt={startedAt}>
        <Text className="mt-10 text-center text-lg text-ink-muted">This workout has no exercises yet.</Text>
        <Text className="mt-2 text-center text-sm text-ink-subtle">Unlock to add some.</Text>
      </Shell>
    );
  }

  const members = labels[index] ? supersetMembers(groups, index) : [];
  const done = exSets.filter((s) => s.is_completed === 1).length;

  return (
    <Shell startedAt={startedAt}>
      {members.length > 1 && (
        <View className="mb-3 flex-row flex-wrap justify-center gap-1.5">
          {members.map((m) => (
            <Pressable
              key={m}
              onPress={() => setCurrentIndex(m)}
              className={`rounded-lg px-2.5 py-1 ${m === index ? 'bg-superset/25' : 'bg-surface-elevated'}`}
            >
              <Text className={`text-xs font-bold ${m === index ? 'text-superset' : 'text-ink-muted'}`}>
                {labels[m]} {exercises[m]!.name.split(' (')[0]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <Text className="text-center text-3xl font-bold text-ink" numberOfLines={2}>
        {labels[index] && <Text className="text-superset">{labels[index]} </Text>}
        {exercise.name}
      </Text>
      <Text className="mt-1 text-center text-base text-ink-subtle">
        {target ? `Set ${targetPos + 1} of ${exSets.length}` : `All ${exSets.length} sets done`}
        {target?.set_type === 'warmup' ? ' · warm-up' : ''}
      </Text>
      {ghost && target && (
        <Text className="mt-1 text-center text-sm text-ink-faint">
          Last time: {formatSetSummary(exercise.tracking_type, ghost, units.unit, true) || '—'}
        </Text>
      )}

      <RestCard />
      <View className="mt-5">
        <IntervalRunBanner />
      </View>

      {target ? (
        <SetEditor
          key={target.id}
          set={target}
          trackingType={exercise.tracking_type}
          ghost={ghost}
          onDone={async (values) => {
            const patch: Partial<Record<(typeof column)[SetField], number | null>> = {};
            for (const f of TRACKING_FIELDS[exercise.tracking_type]) patch[column[f]] = values[f];
            await updateSet(target.id, patch);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await completeSet(target.id, exercise.rest_seconds);
          }}
        />
      ) : (
        <View className="mt-6 items-center gap-3">
          <Text className="text-ink-muted">
            {done}/{exSets.length} sets ticked off.
          </Text>
          <Pressable
            onPress={() => void useActiveWorkoutStore.getState().addSet(exercise.id)}
            className="flex-row items-center gap-2 rounded-xl bg-surface-elevated px-5 py-3 active:opacity-70"
          >
            <Plus size={16} color={colors.ink} />
            <Text className="font-semibold text-ink">Add a set</Text>
          </Pressable>
        </View>
      )}

      {/* Exercise navigation */}
      <View className="mt-6 flex-row items-center gap-3">
        <NavButton disabled={index === 0} onPress={() => setCurrentIndex(index - 1)} label="Previous exercise">
          <ChevronLeft size={22} color={colors.ink} />
        </NavButton>
        <Text className="flex-1 text-center text-xs font-semibold uppercase tracking-widest text-ink-subtle">
          Exercise {index + 1} of {count}
        </Text>
        <NavButton disabled={index >= count - 1} onPress={() => setCurrentIndex(index + 1)} label="Next exercise">
          <ChevronRight size={22} color={colors.ink} />
        </NavButton>
      </View>
    </Shell>
  );
}

/** Frame: "locked" header with the workout clock and an Unlock button. */
function Shell({ startedAt, children }: { startedAt: number | null; children: React.ReactNode }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = startedAt ? formatDuration((now - startedAt) / 1000) : '';
  return (
    <View className="flex-1 bg-surface px-5 pb-6 pt-12">
      <View className="mb-6 flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-surface-raised">
          <Lock size={16} color={colors.muted} />
        </View>
        <View className="flex-1">
          <Text className="text-xs font-semibold uppercase tracking-widest text-ink-subtle">Workout · locked</Text>
          <Text className="text-lg font-bold tabular-nums text-ink">{elapsed}</Text>
        </View>
        <Pressable
          onPress={() => void requestUnlock()}
          className="flex-row items-center gap-1.5 rounded-xl bg-surface-raised px-3 py-2 active:opacity-70"
          accessibilityLabel="Unlock the phone to open the full app"
        >
          <Unlock size={15} color={colors.ink} />
          <Text className="font-semibold text-ink">Unlock</Text>
        </Pressable>
      </View>
      <KeyboardAwareScrollView bottomOffset={16} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
        {children}
      </KeyboardAwareScrollView>
    </View>
  );
}

/** Big rest countdown with +30s / Skip while resting. */
function RestCard() {
  const { remainingMs, isActive } = useRestTimer();
  const { adjust, stop } = useRestTimerStore();
  if (!isActive) return null;
  return (
    <View className="mt-5 flex-row items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-4">
      <Timer size={22} color={colors.accent} />
      <View className="flex-1">
        <Text className="text-xs font-semibold uppercase tracking-widest text-accent">Rest</Text>
        <Text className="text-3xl font-bold tabular-nums text-ink">{formatDuration(Math.ceil(remainingMs / 1000))}</Text>
      </View>
      <Pressable onPress={() => void adjust(30)} className="rounded-xl bg-surface-raised px-3 py-2.5 active:opacity-70">
        <Text className="font-semibold text-ink">+30s</Text>
      </Pressable>
      <Pressable onPress={() => void stop()} className="rounded-xl bg-accent px-3 py-2.5 active:opacity-80">
        <Text className="font-bold text-surface">Skip</Text>
      </Pressable>
    </View>
  );
}

/** −/+ steppers (tap the number to type) for each field this exercise logs, then Done. */
function SetEditor({
  set,
  trackingType,
  ghost,
  onDone,
}: {
  set: SetRowData;
  trackingType: TrackingType;
  ghost?: { weight_kg: number | null; reps: number | null; duration_s: number | null; distance_m: number | null };
  onDone: (values: Values) => Promise<void>;
}) {
  const units = useUnits();
  const fields = TRACKING_FIELDS[trackingType];
  const [values, setValues] = useState<Values>(() => ({
    weight: set.weight_kg ?? ghost?.weight_kg ?? null,
    reps: set.reps ?? ghost?.reps ?? null,
    duration: set.duration_s ?? ghost?.duration_s ?? null,
    distance: set.distance_m ?? ghost?.distance_m ?? null,
  }));
  const [saving, setSaving] = useState(false);

  const weightStep = units.toKg(units.unit === 'imperial' ? 5 : 2.5);
  const distanceStep = units.toMeters(0.1);
  const step: Record<SetField, number> = { weight: weightStep, reps: 1, duration: 5, distance: distanceStep };
  const bump = (f: SetField, dir: 1 | -1) => {
    void Haptics.selectionAsync();
    setValues((v) => {
      const next = Math.max(0, (v[f] ?? 0) + dir * step[f]);
      return { ...v, [f]: f === 'reps' || f === 'duration' ? Math.round(next) : Number(next.toFixed(4)) };
    });
  };

  const label = (f: SetField) =>
    f === 'weight'
      ? `${weightSign(trackingType)}${units.label}`
      : f === 'reps'
        ? 'reps'
        : f === 'duration'
          ? 'time'
          : units.distanceLabel;
  const display = (f: SetField) => {
    const v = values[f];
    if (v === null) return '';
    if (f === 'weight') return units.display(v);
    if (f === 'duration') return formatDuration(v);
    if (f === 'distance') return units.displayDistance(v);
    return String(v);
  };
  const parse = (f: SetField, text: string): number | null | undefined => {
    if (f === 'duration') return parseDuration(text);
    const n = Number(text.replace(',', '.'));
    if (text.trim() === '') return null;
    if (!Number.isFinite(n) || n < 0) return undefined;
    if (f === 'weight') return units.toKg(n);
    if (f === 'distance') return units.toMeters(n);
    return Math.round(n);
  };

  return (
    <View className="mt-6 gap-4">
      {fields.map((f) => (
        <View key={f} className="flex-row items-center gap-3">
          <StepButton onPress={() => bump(f, -1)} label={`Less ${label(f)}`}>
            <Minus size={26} color={colors.ink} />
          </StepButton>
          <View className="flex-1 items-center rounded-2xl bg-surface-raised py-2">
            <NumberField
              value={display(f)}
              placeholder={f === 'weight' && trackingType === 'weighted_bodyweight' ? 'BW' : '—'}
              keyboard={f === 'reps' || f === 'duration' ? 'number-pad' : 'decimal-pad'}
              onCommit={(text) => {
                const v = parse(f, text);
                if (v !== undefined) setValues((cur) => ({ ...cur, [f]: v }));
              }}
            />
            <Text className="text-xs uppercase tracking-widest text-ink-subtle">{label(f)}</Text>
          </View>
          <StepButton onPress={() => bump(f, 1)} label={`More ${label(f)}`}>
            <Plus size={26} color={colors.ink} />
          </StepButton>
        </View>
      ))}

      <Pressable
        disabled={saving}
        onPress={() => {
          setSaving(true);
          void onDone(values).finally(() => setSaving(false));
        }}
        className={`mt-2 h-16 flex-row items-center justify-center gap-2 rounded-2xl bg-accent ${saving ? 'opacity-60' : 'active:opacity-80'}`}
        accessibilityLabel="Mark this set as done"
      >
        <Check size={24} color={colors.bg} strokeWidth={3} />
        <Text className="text-xl font-bold text-surface">Done</Text>
      </Pressable>
    </View>
  );
}

/** Big number you can tap to type; commits when typing ends. */
function NumberField({
  value,
  placeholder,
  keyboard,
  onCommit,
}: {
  value: string;
  placeholder: string;
  keyboard: 'number-pad' | 'decimal-pad';
  onCommit: (text: string) => void;
}) {
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value);
  }, [value, focused]);
  return (
    <TextInput
      value={text}
      onChangeText={setText}
      onFocus={() => setFocused(true)}
      onEndEditing={() => {
        setFocused(false);
        onCommit(text);
      }}
      keyboardType={keyboard}
      selectTextOnFocus
      placeholder={placeholder}
      placeholderTextColor={colors.faint}
      className="min-w-24 text-center text-4xl font-bold tabular-nums text-ink"
    />
  );
}

function StepButton({ onPress, label, children }: { onPress: () => void; label: string; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-16 w-16 items-center justify-center rounded-2xl bg-surface-elevated active:opacity-70"
      accessibilityLabel={label}
    >
      {children}
    </Pressable>
  );
}

function NavButton({ disabled, onPress, label, children }: { disabled: boolean; onPress: () => void; label: string; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`h-14 w-14 items-center justify-center rounded-2xl bg-surface-raised ${disabled ? 'opacity-30' : 'active:opacity-70'}`}
      accessibilityLabel={label}
    >
      {children}
    </Pressable>
  );
}
