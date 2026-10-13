import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, ChevronDown, Pause, Play, Timer } from 'lucide-react-native';
import {
  TRACKING_FIELDS,
  formatDuration,
  formatEffort,
  formatSetSummary,
  parseDuration,
  weightSign,
  type PRKind,
  type SetField,
  type SetType,
  type TrackingType,
} from '@gym/shared';
import { updateSet } from '../db/repositories/workouts';
import type { PreviousSet } from '../db/usePreviousPerformance';
import { useSettingsStore, useUnits } from '../state/settingsStore';
import { useEffortSheet } from './EffortSheet';
import { usePlateSheet } from './PlateCalculatorSheet';
import { useIntervalRun, useIntervalRunStore } from '../state/intervalRunStore';
import { useStopwatchStore } from '../state/stopwatchStore';
import { colors } from '../theme';
import { PRBadge } from './PRBadge';

export interface SetViewRow {
  id: string;
  session_exercise_id: string;
  order_index: number;
  set_type: SetType;
  weight_kg: number | null;
  reps: number | null;
  duration_s: number | null;
  distance_m: number | null;
  /** Raw SQLite value (0/1). */
  is_completed: number;
  notes: string | null;
  rpe: number | null;
}

interface Props {
  set: SetViewRow;
  trackingType: TrackingType;
  /** 1-based number among non-warmup sets. */
  workingNumber: number;
  previous?: PreviousSet;
  prKinds?: PRKind[];
  /** false = no PREVIOUS column (editing a past workout in History). */
  showPrevious?: boolean;
  /** Reps placeholder when there's no previous value, e.g. the routine's range "8–12". */
  repsHint?: string | null;
  onToggleComplete: (setId: string, completed: boolean) => void;
  onOpenSetType: (set: SetViewRow) => void;
  /** Active workout only: start the interval countdown on a timed set that has a time. */
  onStartInterval?: (setId: string) => void;
}

export const SET_TYPE_STYLE: Record<SetType, { label: string; text: string; bg: string }> = {
  warmup: { label: 'W', text: 'text-settype-warmup', bg: 'bg-settype-warmup/15' },
  working: { label: '', text: 'text-ink', bg: 'bg-surface-elevated' },
  drop: { label: 'D', text: 'text-settype-drop', bg: 'bg-settype-drop/15' },
  failure: { label: 'F', text: 'text-settype-failure', bg: 'bg-settype-failure/15' },
};

const parseNum = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() === '' || !Number.isFinite(n) || n < 0 ? null : n;
};

/** Column widths shared with the table header (see SetTableHeader). */
export const COLS = { set: 'w-10', prev: 'flex-[1.3]', input: 'flex-1', wide: 'flex-[2]', effort: 'w-10', done: 'w-11' } as const;

/** Header label for a field in the user's units: "KG", "+KG" (added), "−KG" (assistance), "REPS", "TIME", "KM". */
export function fieldLabel(field: SetField, type: TrackingType, units: ReturnType<typeof useUnits>): string {
  if (field === 'weight') return `${weightSign(type)}${units.label}`.toUpperCase();
  if (field === 'reps') return 'REPS';
  if (field === 'duration') return 'TIME';
  return units.distanceLabel.toUpperCase();
}

/** A one-field type (reps only, time) gets one wide input; others split the space. */
export const fieldWidth = (type: TrackingType) => (TRACKING_FIELDS[type].length === 1 ? COLS.wide : COLS.input);

/** Column headers matching SetRow for this tracking type. */
export function SetTableHeader({ trackingType, showPrevious = true }: { trackingType: TrackingType; showPrevious?: boolean }) {
  const units = useUnits();
  const effort = useSettingsStore((s) => s.effort_input);
  const cls = 'text-center text-[11px] font-semibold tracking-wider text-ink-faint';
  return (
    <View className="mb-1 flex-row items-center gap-2 px-2">
      <Text className={`${COLS.set} ${cls}`}>SET</Text>
      {showPrevious && <Text className={`${COLS.prev} ${cls}`}>PREVIOUS</Text>}
      {TRACKING_FIELDS[trackingType].map((f) => (
        <Text key={f} className={`${fieldWidth(trackingType)} ${cls}`}>
          {fieldLabel(f, trackingType, units)}
        </Text>
      ))}
      {effort !== 'off' && <Text className={`${COLS.effort} ${cls}`}>{effort.toUpperCase()}</Text>}
      <View className={COLS.done} />
    </View>
  );
}

type Texts = Record<SetField, string>;

/**
 * One set in the table. Inputs keep local text while typing and autosave (0.6 s after the last keystroke,
 * on blur, and on unmount), so keystrokes don't each produce a DB write. Empty inputs show last session's
 * numbers as ghost placeholders; completing a set with empty inputs adopts those numbers.
 * Which inputs appear depends on the exercise's tracking type (weight/reps, reps, time, distance + time).
 */
export const SetRow = memo(function SetRow({
  set,
  trackingType,
  workingNumber,
  previous,
  prKinds,
  showPrevious = true,
  repsHint = null,
  onToggleComplete,
  onOpenSetType,
  onStartInterval,
}: Props) {
  const completed = set.is_completed === 1;
  const units = useUnits();
  const effort = useSettingsStore((s) => s.effort_input);
  const fields = TRACKING_FIELDS[trackingType];

  /** DB value → the text shown for each field, in the user's units. */
  const textOf = (s: Pick<SetViewRow, 'weight_kg' | 'reps' | 'duration_s' | 'distance_m'>): Texts => ({
    weight: units.display(s.weight_kg),
    reps: s.reps?.toString() ?? '',
    duration: formatDuration(s.duration_s),
    distance: units.displayDistance(s.distance_m),
  });
  /** Typed text → DB value (undefined = invalid / can't parse). */
  const valueOf = (field: SetField, text: string): number | null | undefined => {
    if (field === 'duration') return parseDuration(text);
    const n = parseNum(text);
    if (n === null) return text.trim() === '' ? null : undefined;
    if (field === 'weight') return units.toKg(n);
    if (field === 'distance') return units.toMeters(n);
    return Math.round(n);
  };
  const column = { weight: 'weight_kg', reps: 'reps', duration: 'duration_s', distance: 'distance_m' } as const;

  const [texts, setTexts] = useState<Texts>(() => textOf(set));
  const scale = useRef(new Animated.Value(1)).current;
  const fill = useRef(new Animated.Value(completed ? 1 : 0)).current;

  // Sync from the DB, but never clobber what's being typed when it already means the same value
  // (e.g. "62." while 62 was just auto-saved).
  useEffect(() => {
    const fresh = textOf(set);
    setTexts((prev) => {
      const next = { ...prev };
      for (const f of fields) {
        const typed = valueOf(f, prev[f]);
        const same = typed !== undefined && textOf({ ...set, [column[f]]: typed })[f] === fresh[f];
        if (!same) next[f] = fresh[f];
      }
      return next;
    });
  }, [set.weight_kg, set.reps, set.duration_s, set.distance_m, units.unit]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    Animated.timing(fill, { toValue: completed ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [completed, fill]);

  /**
   * Autosave: typed values are saved ~0.6 s after the last keystroke, on blur, and if the row unmounts with a
   * pending edit. (On Android, hiding the keyboard with Back doesn't blur the input, so relying on blur alone
   * could silently drop an edit.) Refs hold the latest values for timers.
   */
  const latest = useRef({ texts, set, units });
  latest.current = { texts, set, units };
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
  };
  /** Changed, valid fields as a DB patch (unchanged display text is skipped to avoid kg↔lb rounding churn). */
  const typedPatch = () => {
    const { texts: t, set: current } = latest.current;
    const shown = textOf(current);
    const patch: Partial<Record<(typeof column)[SetField], number | null>> = {};
    for (const f of fields) {
      if (t[f].trim() === shown[f]) continue;
      const v = valueOf(f, t[f]);
      if (v !== undefined) patch[column[f]] = v;
    }
    return patch;
  };
  const commitTyped = () => {
    cancelPendingSave();
    const patch = typedPatch();
    if (Object.keys(patch).length > 0) void updateSet(latest.current.set.id, patch);
  };
  const scheduleSave = () => {
    cancelPendingSave();
    saveTimer.current = setTimeout(commitTyped, 600);
  };
  useEffect(
    () => () => {
      if (saveTimer.current) commitTyped(); // flush on unmount (e.g. leaving the workout screen)
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const prevValues = previous
    ? {
        weight_kg: previous.weight_kg,
        reps: previous.reps,
        duration_s: previous.duration_s,
        distance_m: previous.distance_m,
      }
    : null;
  const hasPrevious = !!prevValues && formatSetSummary(trackingType, prevValues, units.unit) !== '';

  const copyPrevious = () => {
    if (!prevValues || !hasPrevious || completed) return;
    cancelPendingSave();
    void Haptics.selectionAsync();
    setTexts(textOf(prevValues));
    const patch: Partial<Record<(typeof column)[SetField], number | null>> = {};
    for (const f of fields) patch[column[f]] = prevValues[column[f]] ?? null;
    void updateSet(set.id, patch);
  };

  const toggle = () => {
    cancelPendingSave();
    if (!completed) {
      // Adopt ghost values for anything left blank, then persist before completing.
      const patch = typedPatch();
      const adopted: Partial<Record<(typeof column)[SetField], number | null>> = {};
      for (const f of fields) {
        const col = column[f];
        const value = col in patch ? patch[col]! : set[col];
        adopted[col] = value ?? prevValues?.[col] ?? null;
      }
      setTexts((t) => ({ ...t, ...textOf({ ...set, ...adopted }) }));
      const changed = fields.some((f) => adopted[column[f]] !== set[column[f]]);
      if (changed) void updateSet(set.id, adopted);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.18, useNativeDriver: true, speed: 40 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }),
      ]).start();
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onToggleComplete(set.id, !completed);
  };

  /** Press-and-hold (0.5 s) on the weight box opens the plate calculator with the typed / ghost weight. */
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const plateLongPress = {
    onPressIn: () => {
      holdTimer.current = setTimeout(() => {
        holdTimer.current = null;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        commitTyped();
        const typed = valueOf('weight', latest.current.texts.weight);
        usePlateSheet.getState().open(set.id, typed ?? set.weight_kg ?? prevValues?.weight_kg ?? null);
      }, 500);
    },
    onPressOut: () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      holdTimer.current = null;
    },
  };

  const placeholder = (f: SetField): string => {
    const ghost = prevValues ? textOf(prevValues)[f] : '';
    if (ghost) return ghost;
    if (f === 'reps') return repsHint ?? 'reps';
    if (f === 'duration') return 'm:ss';
    if (f === 'distance') return units.distanceLabel;
    return trackingType === 'weighted_bodyweight' ? 'BW' : units.label;
  };

  const type = SET_TYPE_STYLE[set.set_type];
  const rowBg = fill.interpolate({ inputRange: [0, 1], outputRange: ['#10B98100', '#10B9811F'] });
  const inputClass = `rounded-lg px-2 py-2 text-center text-base font-semibold ${
    completed ? 'bg-transparent text-accent' : 'bg-surface-elevated text-ink'
  }`;

  return (
    <View>
      <Animated.View style={{ backgroundColor: rowBg, borderRadius: 12 }}>
        <View className="flex-row items-center gap-2 px-2 py-1.5">
          <View className={COLS.set}>
            <Pressable
              onPress={() => onOpenSetType(set)}
              onLongPress={() => onOpenSetType(set)}
              hitSlop={6}
              className={`h-8 w-9 flex-row items-center justify-center gap-0.5 rounded-lg ${type.bg}`}
              accessibilityLabel={`Set ${workingNumber}, ${set.set_type}. Tap to mark warm-up, drop set or failure`}
            >
              <Text className={`font-bold ${type.text}`}>{type.label || workingNumber}</Text>
              {/* ▾ affordance: the badge opens the set-type menu */}
              <ChevronDown size={10} strokeWidth={3} color={colors.subtle} />
            </Pressable>
          </View>

          {showPrevious && (
            <Pressable onPress={copyPrevious} className={COLS.prev} hitSlop={4} accessibilityLabel="Copy previous">
              <Text className="text-center text-sm text-ink-subtle" numberOfLines={1}>
                {(prevValues && formatSetSummary(trackingType, prevValues, units.unit)) || '—'}
              </Text>
            </Pressable>
          )}

          {fields.map((f) => (
            <View key={f} className={`${fieldWidth(trackingType)} flex-row items-center gap-1`}>
              {f === 'duration' && trackingType === 'duration' && !completed ? (
                <TimedInput
                  setId={set.id}
                  text={texts.duration}
                  placeholder={placeholder('duration')}
                  inputClass={inputClass}
                  onChangeText={(t) => {
                    setTexts((p) => ({ ...p, duration: t }));
                    scheduleSave();
                  }}
                  onEndEditing={commitTyped}
                  onStartCountdown={
                    onStartInterval && set.duration_s
                      ? () => {
                          commitTyped();
                          onStartInterval(set.id);
                        }
                      : undefined
                  }
                  onStopped={(seconds) => {
                    cancelPendingSave();
                    setTexts((p) => ({ ...p, duration: formatDuration(seconds) }));
                    void updateSet(set.id, { duration_s: seconds }).then(() => onToggleComplete(set.id, true));
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }}
                />
              ) : (
                <TextInput
                  value={texts[f]}
                  onChangeText={(t) => {
                    setTexts((p) => ({ ...p, [f]: t }));
                    scheduleSave();
                  }}
                  onEndEditing={commitTyped}
                  // Long-press a weight box → plate calculator (TextInput has no onLongPress, so time the press).
                  {...(f === 'weight' && trackingType === 'weight_reps' ? plateLongPress : {})}
                  keyboardType={f === 'reps' || f === 'duration' ? 'number-pad' : 'decimal-pad'}
                  placeholder={placeholder(f)}
                  placeholderTextColor={colors.faint}
                  selectTextOnFocus
                  className={`flex-1 ${inputClass}`}
                />
              )}
            </View>
          ))}

          {effort !== 'off' && (
            <Pressable
              onPress={() => useEffortSheet.getState().open(set.id, set.rpe)}
              hitSlop={4}
              className={`${COLS.effort} h-9 items-center justify-center rounded-lg ${set.rpe !== null ? 'bg-surface-elevated' : 'border border-dashed border-surface-border'}`}
              accessibilityLabel={`${effort.toUpperCase()} ${formatEffort(set.rpe, effort) || 'not set'}. Tap to set`}
            >
              <Text className={`text-sm font-semibold ${set.rpe !== null ? 'text-ink' : 'text-ink-faint'}`}>
                {formatEffort(set.rpe, effort) || '–'}
              </Text>
            </Pressable>
          )}

          <View className={`${COLS.done} items-center`}>
            <Animated.View style={{ transform: [{ scale }] }}>
              <Pressable
                onPress={toggle}
                hitSlop={6}
                className={`h-9 w-9 items-center justify-center rounded-lg ${
                  completed ? 'bg-accent' : 'border-2 border-surface-border'
                }`}
                accessibilityLabel={completed ? 'Mark set incomplete' : 'Complete set'}
              >
                <Check size={18} strokeWidth={3} color={completed ? colors.bg : colors.faint} />
              </Pressable>
            </Animated.View>
          </View>
        </View>
      </Animated.View>
      {set.notes && (
        <Pressable onPress={() => onOpenSetType(set)} className="pb-1 pl-12 pr-2">
          <Text className="text-xs italic text-ink-muted" numberOfLines={2}>
            {set.notes}
          </Text>
        </Pressable>
      )}
      {prKinds && <PRBadge kinds={prKinds} />}
    </View>
  );
});

/**
 * Time input with an inline stopwatch: tap ⏱ to start (the box counts up live), tap again to stop. Stopping
 * saves the time and ticks the set off. Typing a time (e.g. 130 = 1:30) still works.
 * In a workout, a set that already has a time shows ▶ instead: the interval countdown (intervalRunStore).
 */
function TimedInput({
  setId,
  text,
  placeholder,
  inputClass,
  onChangeText,
  onEndEditing,
  onStartCountdown,
  onStopped,
}: {
  setId: string;
  text: string;
  placeholder: string;
  inputClass: string;
  onChangeText: (t: string) => void;
  onEndEditing: () => void;
  onStartCountdown?: () => void;
  onStopped: (seconds: number) => void;
}) {
  const inRun = useIntervalRunStore((s) => !!s.run?.setIds.includes(setId));
  const running = useStopwatchStore((s) => s.setId === setId);
  const startedAt = useStopwatchStore((s) => (s.setId === setId ? s.startedAt : null));
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  const toggle = () => {
    const store = useStopwatchStore.getState();
    if (running) onStopped(store.stop(setId));
    else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      store.start(setId);
      setNow(Date.now());
    }
  };

  if (inRun) return <RunCountdown setId={setId} />;

  return (
    <>
      {running && startedAt ? (
        <View className="flex-1 items-center rounded-lg bg-accent-soft py-2">
          <Text className="text-base font-bold tabular-nums text-accent">
            {formatDuration(Math.max(0, (now - startedAt) / 1000))}
          </Text>
        </View>
      ) : (
        <TextInput
          value={text}
          onChangeText={onChangeText}
          onEndEditing={onEndEditing}
          keyboardType="number-pad"
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          selectTextOnFocus
          className={`flex-1 ${inputClass}`}
        />
      )}
      {onStartCountdown && !running ? (
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onStartCountdown();
          }}
          hitSlop={6}
          className="h-9 w-9 items-center justify-center rounded-lg bg-accent"
          accessibilityLabel="Start countdown"
        >
          <Play size={16} color={colors.bg} fill={colors.bg} />
        </Pressable>
      ) : (
        <Pressable
          onPress={toggle}
          hitSlop={6}
          className={`h-9 w-9 items-center justify-center rounded-lg ${running ? 'bg-accent' : 'bg-surface-elevated'}`}
          accessibilityLabel={running ? 'Stop timer and save' : 'Start timer'}
        >
          {running ? <Pause size={16} color={colors.bg} fill={colors.bg} /> : <Timer size={16} color={colors.accent} />}
        </Pressable>
      )}
    </>
  );
}

/** A timed set inside the interval run: its live countdown while working on it, else "next" / its time. */
function RunCountdown({ setId }: { setId: string }) {
  const view = useIntervalRun();
  if (!view) return null;
  const { run, state } = view;
  const i = run.setIds.indexOf(setId);
  const working = state.phase?.kind === 'work' && state.phase.setIndex === i;
  // A rest phase belongs to the set before it: this set is up next.
  const upNext = state.phase?.kind === 'rest' && state.phase.setIndex === i - 1;
  const left = formatDuration(Math.ceil(state.remainingMs / 1000));
  const label = working ? left : upNext ? `in ${left}` : formatDuration(run.workS[i] ?? 0);
  return (
    <View className={`flex-1 items-center rounded-lg py-2 ${working ? 'bg-accent' : 'bg-accent-soft'}`}>
      <Text className={`text-base font-bold tabular-nums ${working ? 'text-surface' : 'text-accent'}`}>{label}</Text>
    </View>
  );
}
