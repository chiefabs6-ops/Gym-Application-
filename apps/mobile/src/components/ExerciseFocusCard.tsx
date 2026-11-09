import { memo, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Check, ChevronDown, ChevronUp, Disc3, Flame, NotebookPen, PersonStanding, Plus, Repeat, Timer } from 'lucide-react-native';
import {
  REST_SECONDS_MAX,
  formatDuration,
  formatSetSummary,
  generateWarmups,
  resolveAutoNext,
  resolveRestSeconds,
  type Equipment,
  type UnitSystem,
  type PRKind,
  type TrackingType,
} from '@gym/shared';
import { insertWarmupSets, updateSessionExerciseNotes, updateSessionExerciseRest } from '../db/repositories/workouts';
import { usePlateProfiles, usePlateSheet } from './PlateCalculatorSheet';
import { ConfirmSheet, type ConfirmRequest } from './ConfirmSheet';
import { DurationInputSheet } from './DurationInputSheet';
import { usePreviousPerformance } from '../db/usePreviousPerformance';
import { useActiveWorkoutStore } from '../state/activeWorkoutStore';
import { useSettingsStore, useUnits } from '../state/settingsStore';
import { cardShadow, colors } from '../theme';
import { FormGuideSheet } from './FormGuideSheet';
import { SetRow, SetTableHeader, type SetViewRow } from './SetRow';
import { SupersetStrip, type SupersetMember } from './SupersetStrip';

export interface SessionExerciseView {
  id: string;
  exercise_id: string;
  name: string;
  primary_muscle: string;
  equipment: string;
  notes: string | null;
  rest_seconds: number | null;
  tracking_type: TrackingType;
  superset_group: string | null;
}

interface Props {
  exercise: SessionExerciseView;
  sets: SetViewRow[];
  sessionId: string;
  /** Routine this workout was started from (for 'same routine' previous values). */
  templateId: string | null;
  /** Routine rep range for this exercise, e.g. "8–12" (null when fixed reps / no routine). */
  repRange?: string | null;
  /** Routine's interval "auto-start next set" for this exercise (null = not set / no routine). */
  routineAutoNext?: boolean | null;
  /** This exercise's position, superset label (A1…) and its superset's members (empty when not in one). */
  index: number;
  supersetLabel?: string | null;
  supersetMembers?: SupersetMember[];
  onJump?: (index: number) => void;
  width: number;
  prHits: Record<string, PRKind[]>;
  onToggleComplete: (setId: string, completed: boolean, restSeconds: number | null) => void;
  onOpenSetType: (set: SetViewRow) => void;
  onStartInterval: (sessionExerciseId: string, setId: string) => void;
}

/** One page of the workout pager: a single exercise in focus. */
export const ExerciseFocusCard = memo(function ExerciseFocusCard({
  exercise,
  sets,
  sessionId,
  templateId,
  repRange = null,
  routineAutoNext = null,
  index,
  supersetLabel = null,
  supersetMembers = [],
  onJump,
  width,
  prHits,
  onToggleComplete,
  onOpenSetType,
  onStartInterval,
}: Props) {
  const previousSource = useSettingsStore((s) => s.previous_source);
  const units = useUnits();
  const previous = usePreviousPerformance(exercise.exercise_id, sessionId, previousSource, templateId);
  const [notesOpen, setNotesOpen] = useState(!!exercise.notes);
  const [notes, setNotes] = useState(exercise.notes ?? '');
  const [guideOpen, setGuideOpen] = useState(false);
  const [restOpen, setRestOpen] = useState(false);
  const [notice, setNotice] = useState<ConfirmRequest | null>(null);
  const { active: plates } = usePlateProfiles();

  /** Warm-ups from the first working set's weight (typed, or last time's as a fallback). */
  const addWarmups = () => {
    const i = sets.findIndex((s) => s.set_type !== 'warmup');
    const workingKg = i >= 0 ? (sets[i]!.weight_kg ?? previous[i]?.weight_kg ?? null) : null;
    const warmups = generateWarmups({
      workingKg,
      exerciseId: exercise.exercise_id,
      equipment: exercise.equipment as Equipment,
      unit: units.unit,
      plates,
    });
    if (warmups.length === 0) {
      setNotice({
        title: 'Enter a working weight first',
        message: 'Warm-ups are worked out from your first working set’s weight.',
        confirmLabel: 'OK',
        notice: true,
      });
      return;
    }
    void insertWarmupSets(exercise.id, warmups);
  };

  /** Plate calculator for the next unticked working set (or the last set when all are done). */
  const openPlates = () => {
    const i = sets.findIndex((s) => s.set_type !== 'warmup' && s.is_completed === 0);
    const at = i >= 0 ? i : sets.length - 1;
    const target = sets[at];
    if (target) usePlateSheet.getState().open(target.id, target.weight_kg ?? previous[at]?.weight_kg ?? null);
  };
  const settings = useSettingsStore();
  /** Rest used after this exercise's working sets (this workout's value, else remembered, else default). */
  const restNow = resolveRestSeconds(settings, { exerciseId: exercise.exercise_id, sessionRest: exercise.rest_seconds, isWarmup: false });
  const sessionAutoNext = useActiveWorkoutStore((s) => s.autoNext[exercise.id]);
  const autoNext = resolveAutoNext(settings, { exerciseId: exercise.exercise_id, sessionOverride: sessionAutoNext, routineValue: routineAutoNext });
  useEffect(() => setNotes(exercise.notes ?? ''), [exercise.notes]);

  const done = sets.filter((s) => s.is_completed === 1).length;
  // Quick actions: 4 → a 2 × 2 grid (labels like "Auto-next on" need the room), otherwise rows of 3.
  const actionCount =
    2 +
    (exercise.tracking_type === 'weight_reps' ? 1 : 0) +
    (exercise.tracking_type === 'weight_reps' && exercise.equipment === 'barbell' ? 1 : 0) +
    (exercise.tracking_type === 'duration' ? 1 : 0);
  const actionBasis = actionCount === 4 ? '48%' : '31%';
  const workingNumbers = (() => {
    let n = 0;
    return sets.map((s) => (s.set_type === 'warmup' ? 0 : ++n));
  })();
  const fold = foldSets(sets, exercise.tracking_type, units.unit);
  const [showDone, setShowDone] = useState(false);
  const [showLater, setShowLater] = useState(false);
  const hidden = (i: number) =>
    fold !== null && ((!showDone && i < fold.doneCount) || (!showLater && fold.laterFrom !== null && i >= fold.laterFrom));

  return (
    <View style={{ width }}>
      <KeyboardAwareScrollView
        bottomOffset={16}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View className="rounded-card border border-surface-border bg-surface-raised p-4" style={cardShadow}>
          {supersetMembers.length > 1 && onJump && (
            <SupersetStrip members={supersetMembers} currentIndex={index} onJump={onJump} />
          )}
          {/* Header */}
          <View className="mb-4 flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-2xl font-bold text-ink">
                {supersetLabel && <Text className="text-superset">{supersetLabel} </Text>}
                {exercise.name}
              </Text>
              <Text className="mt-0.5 text-sm capitalize text-ink-subtle">
                {exercise.primary_muscle.replace('_', ' ')} · {exercise.equipment}
              </Text>
              <View className="mt-1.5 flex-row flex-wrap items-center gap-2">
                <View className={`rounded-full px-3 py-1 ${done === sets.length && sets.length > 0 ? 'bg-accent-soft' : 'bg-surface-elevated'}`}>
                  <Text className={`text-xs font-bold ${done === sets.length && sets.length > 0 ? 'text-accent' : 'text-ink-muted'}`}>
                    {done}/{sets.length} sets
                  </Text>
                </View>
                {repRange && <Text className="text-sm font-semibold text-accent">Target {repRange} reps</Text>}
              </View>
            </View>
            <FormButton onPress={() => setGuideOpen(true)} />
          </View>

          {notesOpen && (
            <TextInput
              value={notes}
              onChangeText={setNotes}
              onEndEditing={() => {
                if ((notes.trim() || null) !== exercise.notes) void updateSessionExerciseNotes(exercise.id, notes);
              }}
              placeholder="Notes for this exercise (seat height, grip, cues…)"
              placeholderTextColor={colors.faint}
              multiline
              className="mb-4 rounded-xl bg-surface-elevated px-3 py-2.5 text-sm text-ink"
            />
          )}

          {/* Table header */}
          <SetTableHeader trackingType={exercise.tracking_type} />

          {fold && fold.doneCount > 0 && (
            <FoldRow
              done
              label={fold.doneCount === sets.length ? `All ${fold.doneCount} sets done` : `${fold.doneCount} sets done`}
              each={fold.doneEach}
              open={showDone}
              onPress={() => setShowDone((v) => !v)}
            />
          )}
          <View className="gap-1">
            {sets.map((s, i) => hidden(i) ? null : (
              <SetRow
                key={s.id}
                set={s}
                trackingType={exercise.tracking_type}
                workingNumber={workingNumbers[i]!}
                previous={previous[i]}
                prKinds={prHits[s.id]}
                repsHint={repRange}
                onToggleComplete={(id, completed) => onToggleComplete(id, completed, exercise.rest_seconds)}
                onOpenSetType={onOpenSetType}
                onStartInterval={(setId) => onStartInterval(exercise.id, setId)}
              />
            ))}
          </View>
          {fold && fold.laterFrom !== null && (
            <FoldRow
              label={`${sets.length - fold.laterFrom} more sets`}
              each={fold.laterEach}
              open={showLater}
              onPress={() => setShowLater((v) => !v)}
            />
          )}

          <Pressable
            onPress={() => void useActiveWorkoutStore.getState().addSet(exercise.id)}
            className="mt-3 flex-row items-center justify-center gap-2 rounded-xl bg-surface-elevated py-3 active:opacity-70"
          >
            <Plus size={16} color={colors.ink} />
            <Text className="font-semibold text-ink">Add Set</Text>
          </Pressable>

          {/* Quick actions */}
          <View className="mt-3 flex-row flex-wrap gap-2">
            <QuickAction
              basis={actionBasis}
              icon={<NotebookPen size={15} color={notesOpen ? colors.accent : colors.muted} />}
              label="Notes"
              active={notesOpen}
              onPress={() => setNotesOpen((v) => !v)}
            />
            {exercise.tracking_type === 'weight_reps' && (
              <QuickAction basis={actionBasis} icon={<Flame size={15} color={colors.warmup} />} label="Warm-up" onPress={addWarmups} />
            )}
            {exercise.tracking_type === 'weight_reps' && exercise.equipment === 'barbell' && (
              <QuickAction basis={actionBasis} icon={<Disc3 size={15} color={colors.muted} />} label="Plates" onPress={openPlates} />
            )}
            <QuickAction
              basis={actionBasis}
              icon={<Timer size={15} color={colors.muted} />}
              label={`Rest ${formatDuration(restNow)}`}
              onPress={() => setRestOpen(true)}
            />
            {exercise.tracking_type === 'duration' && (
              <QuickAction
                basis={actionBasis}
                icon={<Repeat size={15} color={autoNext ? colors.accent : colors.muted} />}
                label={autoNext ? 'Auto-next on' : 'Auto-next off'}
                active={autoNext}
                onPress={() => void useActiveWorkoutStore.getState().setAutoNext(exercise.id, exercise.exercise_id, !autoNext)}
              />
            )}
          </View>
        </View>

      </KeyboardAwareScrollView>

      <ConfirmSheet request={notice} onClose={() => setNotice(null)} />
      <DurationInputSheet
        visible={restOpen}
        title={`Rest: ${exercise.name}`}
        value={restNow}
        min={0}
        max={REST_SECONDS_MAX}
        onClose={() => setRestOpen(false)}
        onSave={(seconds) => {
          void updateSessionExerciseRest(exercise.id, seconds);
          // Remembered for this exercise next time (Settings → default applies to everything else).
          void settings.update({ exercise_rest: { ...settings.exercise_rest, [exercise.exercise_id]: seconds } });
        }}
      />
      <FormGuideSheet
        target={
          guideOpen
            ? {
                exerciseId: exercise.exercise_id,
                name: exercise.name,
                primaryMuscle: exercise.primary_muscle,
                equipment: exercise.equipment,
              }
            : null
        }
        onClose={() => setGuideOpen(false)}
      />
    </View>
  );
});

/** Exercises with this many sets or more fold the finished ones and the far-off ones (battle ropes: 15 sets). */
const FOLD_AT = 6;
/** Sets left open after the next unticked one. */
const OPEN_AHEAD = 2;

/**
 * Which sets fold away on a long exercise: the finished run at the start, and everything more than two sets after
 * the next unticked one. `…Each` is the shared value of a folded group ("0:30") when every set in it matches.
 */
function foldSets(sets: SetViewRow[], type: TrackingType, unit: UnitSystem) {
  if (sets.length < FOLD_AT) return null;
  const next = sets.findIndex((s) => s.is_completed === 0);
  const doneCount = next === -1 ? sets.length : next;
  const laterFrom = next === -1 || next + OPEN_AHEAD + 1 >= sets.length ? null : next + OPEN_AHEAD + 1;
  const each = (list: SetViewRow[]) => {
    const values = [...new Set(list.map((s) => formatSetSummary(type, s, unit)))];
    return values.length === 1 && values[0] ? values[0] : null;
  };
  return {
    doneCount,
    laterFrom,
    doneEach: each(sets.slice(0, doneCount)),
    laterEach: laterFrom === null ? null : each(sets.slice(laterFrom)),
  };
}

function FoldRow({ label, each, open, done, onPress }: { label: string; each: string | null; open: boolean; done?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`my-1 min-h-12 flex-row items-center gap-2.5 rounded-xl px-3 active:opacity-80 ${done ? 'bg-accent/10' : 'bg-surface-elevated'}`}
      accessibilityLabel={`${label}. Tap to ${open ? 'hide' : 'show'} them`}
    >
      {done && (
        <View className="h-6 w-6 items-center justify-center rounded-full bg-accent">
          <Check size={14} strokeWidth={3} color={colors.bg} />
        </View>
      )}
      <Text className="flex-1 text-sm" numberOfLines={1}>
        <Text className={`font-semibold ${done ? 'text-accent' : 'text-ink'}`}>{label}</Text>
        {each && <Text className="text-ink-muted"> · {each} each</Text>}
      </Text>
      <Text className="text-[13px] text-ink-muted">{open ? 'Hide' : 'Show'}</Text>
      {open ? <ChevronUp size={14} color={colors.muted} /> : <ChevronDown size={14} color={colors.muted} />}
    </Pressable>
  );
}

/** Opens the form guide (illustration and tips). One icon for every exercise: the illustrations are too wide to fit. */
function FormButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-16 w-20 items-center justify-center gap-1 rounded-2xl bg-surface-elevated active:opacity-70"
      accessibilityLabel="Open form guide"
    >
      <PersonStanding size={26} color={colors.muted} />
      <Text className="text-[11px] text-ink-muted">Form</Text>
    </Pressable>
  );
}

function QuickAction({
  icon,
  label,
  active,
  onPress,
  basis,
}: {
  icon: React.ReactNode;
  label: string;
  /** Share of the row: '48%' = 2 per row, '31%' = 3 per row. */
  basis: '48%' | '31%';
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flexBasis: basis, flexGrow: 1 }}
      className={`flex-row items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 ${
        active ? 'border-accent/40 bg-accent-soft' : 'border-surface-border'
      }`}
    >
      {icon}
      <Text className={`text-sm font-medium ${active ? 'text-accent' : 'text-ink-muted'}`}>{label}</Text>
    </Pressable>
  );
}
