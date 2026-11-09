import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Archive, ArchiveRestore, Dumbbell } from 'lucide-react-native';
import {
  EQUIPMENT,
  MUSCLE_GROUPS,
  TRACKING_LABELS,
  TRACKING_TYPES,
  type Equipment,
  type ExerciseDefinitionRow,
  type MuscleGroup,
  type TrackingType,
} from '@gym/shared';
import {
  cleanExerciseName,
  createExercise,
  findNameClash,
  setExerciseArchived,
  updateExercise,
} from '../db/repositories/exercises';
import { useUnits } from '../state/settingsStore';
import { colors } from '../theme';
import { BottomSheet } from './BottomSheet';

export type EditableExercise = Pick<
  ExerciseDefinitionRow,
  'id' | 'name' | 'primary_muscle' | 'equipment' | 'tracking_type' | 'archived_at'
>;

/** What to edit: an existing custom exercise, or a new one (optionally with a name typed in search). */
export type ExerciseEditorTarget = { mode: 'edit'; exercise: EditableExercise } | { mode: 'new'; name?: string };

interface Props {
  target: ExerciseEditorTarget | null;
  onClose: () => void;
  /** Called after a create or edit is saved, with the exercise's id and name. */
  onSaved?: (exercise: {
    id: string;
    name: string;
    primary_muscle: MuscleGroup;
    equipment: Equipment;
    tracking_type: TrackingType;
  }) => void;
}

const label = (s: string) => s.replace('_', ' ');
/** One example per type, shown on its tile so the choice is obvious (weights in the user's unit). */
const trackingExample = (t: TrackingType, kg: string, km: string): string =>
  ({
    weight_reps: `60 ${kg} × 10`,
    reps_only: '15 reps',
    weighted_bodyweight: `Pull-up +10 ${kg} × 8`,
    assisted_bodyweight: `Pull-up −20 ${kg} × 8`,
    duration: 'Plank 1:30',
    distance_duration: `Run 5 ${km} in 25:00`,
  })[t];

/** Create or edit a custom exercise: name, primary muscle, equipment, type; archive / restore. */
export function ExerciseEditorSheet({ target, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup>('chest');
  const [equipment, setEquipment] = useState<Equipment>('dumbbell');
  const [tracking, setTracking] = useState<TrackingType>('weight_reps');
  const [clash, setClash] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const existing = target?.mode === 'edit' ? target.exercise : null;

  useEffect(() => {
    if (!target) return;
    setClash(null);
    setSaving(false);
    if (target.mode === 'edit') {
      setName(target.exercise.name);
      setMuscle(target.exercise.primary_muscle);
      setEquipment(target.exercise.equipment);
      setTracking(target.exercise.tracking_type);
    } else {
      setName(target.name ?? '');
      setMuscle('chest');
      setEquipment('dumbbell');
      setTracking('weight_reps');
    }
  }, [target]);

  const cleaned = cleanExerciseName(name);

  const save = async () => {
    if (!cleaned || saving) return;
    setSaving(true);
    try {
      const taken = await findNameClash(cleaned, existing?.id ?? null);
      if (taken) {
        setClash(taken);
        return;
      }
      const fields = { name: cleaned, primary_muscle: muscle, equipment, tracking_type: tracking };
      let id = existing?.id;
      if (existing) await updateExercise(existing.id, fields);
      else id = (await createExercise(fields)).id;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved?.({ id: id!, name: cleaned, primary_muscle: muscle, equipment, tracking_type: tracking });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async () => {
    if (!existing) return;
    await setExerciseArchived(existing.id, existing.archived_at === null);
    onClose();
  };

  return (
    <BottomSheet visible={target !== null} onClose={onClose} avoidKeyboard className="max-h-[90%] pt-3">
      <View className="mb-3 h-1 w-10 self-center rounded-full bg-surface-border" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View className="mb-4 flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-accent-soft">
            <Dumbbell size={20} color={colors.accent} />
          </View>
          <Text className="flex-1 text-xl font-bold text-ink">{existing ? 'Edit exercise' : 'New exercise'}</Text>
        </View>

        <SectionLabel text="Name" />
        <TextInput
          value={name}
          onChangeText={(t) => {
            setName(t);
            setClash(null);
          }}
          maxLength={120}
          autoFocus={!existing}
          placeholder="e.g. Cable Crunch"
          placeholderTextColor={colors.faint}
          className={`rounded-xl bg-surface-elevated px-3 py-3 text-base text-ink ${clash ? 'border border-settype-failure' : ''}`}
        />
        <Text className={`mb-4 mt-1 text-xs ${clash ? 'text-settype-failure' : 'text-ink-faint'}`}>
          {clash ? `“${clash}” already exists. Pick another name.` : 'Tip: add the equipment, e.g. “Row (T-Bar)”.'}
        </Text>

        <SectionLabel text="How it's logged" />
        <TrackingTiles value={tracking} onChange={setTracking} />

        <SectionLabel text="Primary muscle" />
        <Chips options={MUSCLE_GROUPS} value={muscle} format={label} onChange={setMuscle} />

        <SectionLabel text="Equipment" />
        <Chips options={EQUIPMENT} value={equipment} format={label} onChange={setEquipment} />


        <Pressable
          onPress={() => void save()}
          disabled={!cleaned || saving}
          className={`mb-2 mt-2 h-14 items-center justify-center rounded-xl bg-accent ${cleaned && !saving ? 'active:opacity-80' : 'opacity-40'}`}
        >
          <Text className="text-base font-bold text-surface">{existing ? 'Save' : 'Create exercise'}</Text>
        </Pressable>
        <View className="flex-row gap-2">
          <Pressable onPress={onClose} className="h-12 flex-1 items-center justify-center rounded-xl bg-surface-elevated active:opacity-70">
            <Text className="font-semibold text-ink">Cancel</Text>
          </Pressable>
          {existing && (
            <Pressable
              onPress={() => void toggleArchive()}
              className="h-12 flex-row items-center justify-center gap-2 rounded-xl border border-surface-border px-4 active:opacity-70"
            >
              {existing.archived_at === null ? (
                <Archive size={16} color={colors.muted} />
              ) : (
                <ArchiveRestore size={16} color={colors.accent} />
              )}
              <Text className={`font-semibold ${existing.archived_at === null ? 'text-ink-muted' : 'text-accent'}`}>
                {existing.archived_at === null ? 'Archive' : 'Restore'}
              </Text>
            </Pressable>
          )}
        </View>
        {existing && existing.archived_at === null && (
          <Text className="mt-3 text-center text-xs text-ink-faint">
            Archiving hides it from the list. Past workouts and routines keep it.
          </Text>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

/** The logging types as a 2-column grid of tiles, each with an example of what a set looks like. */
function TrackingTiles({ value, onChange }: { value: TrackingType; onChange: (t: TrackingType) => void }) {
  const units = useUnits();
  return (
    <View className="mb-4 flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
      {TRACKING_TYPES.map((t) => {
        const active = t === value;
        return (
          <Pressable
            key={t}
            onPress={() => onChange(t)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            style={{ flexBasis: '47%', flexGrow: 1 }}
            className={`gap-0.5 rounded-[14px] border px-3 py-2.5 ${active ? 'border-accent bg-accent-soft' : 'border-surface-border bg-surface-elevated'}`}
          >
            <Text className={`text-sm font-semibold ${active ? 'text-accent' : 'text-ink'}`}>{TRACKING_LABELS[t]}</Text>
            <Text className={`text-xs ${active ? 'text-emerald-300' : 'text-ink-muted'}`}>
              {trackingExample(t, units.label, units.distanceLabel)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <Text className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-subtle">{text}</Text>;
}

function Chips<T extends string>({
  options,
  value,
  format,
  onChange,
}: {
  options: readonly T[];
  value: T;
  format: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <View className="mb-4 flex-row flex-wrap gap-2">
      {options.map((o) => {
        const active = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            className={`rounded-full border px-3 py-1.5 ${active ? 'border-accent bg-accent-soft' : 'border-surface-border bg-surface-elevated'}`}
          >
            <Text className={`text-sm capitalize ${active ? 'font-semibold text-accent' : 'text-ink-muted'}`}>{format(o)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
