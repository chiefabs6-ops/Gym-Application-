import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Pencil } from 'lucide-react-native';
import { colors } from '../theme';
import { BottomSheet } from './BottomSheet';

export interface WorkoutDetails {
  title: string | null;
  start_time: number;
  end_time: number;
  notes: string | null;
  rpe: number | null;
}

interface Props {
  /** null hides the sheet. */
  workout: WorkoutDetails | null;
  onClose: () => void;
  onSave: (fields: Pick<WorkoutDetails, 'title' | 'end_time' | 'notes' | 'rpe'>) => void;
}

const RPE_OPTIONS = [6, 7, 8, 9, 10] as const;
const MAX_MINUTES = 24 * 60;

/** History → edit a past workout's name, duration, session RPE and notes. */
export function WorkoutDetailsSheet({ workout, onClose, onSave }: Props) {
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState('');
  const [rpe, setRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  // Each opening starts from the saved values.
  useEffect(() => {
    if (!workout) return;
    setTitle(workout.title ?? '');
    setMinutes(String(Math.max(1, Math.round((workout.end_time - workout.start_time) / 60_000))));
    setRpe(workout.rpe);
    setNotes(workout.notes ?? '');
  }, [workout]);

  const parsedMinutes = Number(minutes);
  const minutesValid = Number.isInteger(parsedMinutes) && parsedMinutes >= 1 && parsedMinutes <= MAX_MINUTES;

  const save = () => {
    if (!workout || !minutesValid) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave({
      title: title.trim() || null,
      end_time: workout.start_time + parsedMinutes * 60_000,
      notes: notes.trim() || null,
      rpe,
    });
  };

  return (
    <BottomSheet visible={workout !== null} onClose={onClose} avoidKeyboard className="px-5 pb-8 pt-3">
      <View className="mb-4 h-1 w-10 self-center rounded-full bg-surface-border" />
      <View className="mb-4 flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-accent-soft">
          <Pencil size={18} color={colors.accent} />
        </View>
        <Text className="flex-1 text-xl font-bold text-ink">Workout details</Text>
      </View>

      <Label text="Name" />
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Workout"
        placeholderTextColor={colors.faint}
        className="mb-4 rounded-xl bg-surface-elevated px-3 py-3 text-base text-ink"
      />

      <Label text="Duration" hint="(minutes)" />
      <TextInput
        value={minutes}
        onChangeText={(t) => setMinutes(t.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        selectTextOnFocus
        className={`mb-1 rounded-xl bg-surface-elevated px-3 py-3 text-base text-ink ${minutesValid ? '' : 'border border-settype-failure'}`}
      />
      <Text className={`mb-4 text-xs ${minutesValid ? 'text-ink-faint' : 'text-settype-failure'}`}>
        {minutesValid ? 'Forgot to tap Finish? Fix the length here.' : `Enter 1 to ${MAX_MINUTES} minutes.`}
      </Text>

      <Label text="How hard was it?" hint="(RPE, optional)" />
      <View className="mb-4 flex-row gap-2">
        {RPE_OPTIONS.map((value) => {
          const active = rpe === value;
          return (
            <Pressable
              key={value}
              onPress={() => {
                void Haptics.selectionAsync();
                setRpe(active ? null : value);
              }}
              className={`h-11 flex-1 items-center justify-center rounded-xl border ${
                active ? 'border-accent bg-accent-soft' : 'border-surface-border bg-surface-elevated'
              }`}
            >
              <Text className={`font-bold ${active ? 'text-accent' : 'text-ink-muted'}`}>{value}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Workout notes (optional)"
        placeholderTextColor={colors.faint}
        multiline
        className="mb-5 max-h-28 rounded-xl bg-surface-elevated px-3 py-3 text-sm text-ink"
      />

      <Pressable
        onPress={save}
        disabled={!minutesValid}
        className={`mb-2 h-14 items-center justify-center rounded-xl bg-accent ${minutesValid ? 'active:opacity-80' : 'opacity-40'}`}
      >
        <Text className="text-base font-bold text-surface">Save</Text>
      </Pressable>
      <Pressable onPress={onClose} className="h-12 items-center justify-center rounded-xl bg-surface-elevated active:opacity-70">
        <Text className="font-semibold text-ink">Cancel</Text>
      </Pressable>
    </BottomSheet>
  );
}

function Label({ text, hint }: { text: string; hint?: string }) {
  return (
    <Text className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-subtle">
      {text} {hint && <Text className="normal-case tracking-normal text-ink-faint">{hint}</Text>}
    </Text>
  );
}
