import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AlertTriangle, Clock, Dumbbell, Flag, ListChecks, Trash2, Weight } from 'lucide-react-native';
import { colors } from '../theme';
import { BottomSheet } from './BottomSheet';
import { useUnits } from '../state/settingsStore';
import { countsTowardVolume, type TrackingType } from '@gym/shared';
import type { SetViewRow } from './SetRow';

interface Props {
  visible: boolean;
  elapsed: string;
  exerciseCount: number;
  sets: (SetViewRow & { tracking_type: TrackingType })[];
  onClose: () => void;
  onFinish: (fields: { notes: string | null; rpe: number | null }) => void;
  onDiscard: () => void;
}

const RPE_OPTIONS = [6, 7, 8, 9, 10] as const;

/** Bottom sheet replacing the system alert: summary, optional notes/RPE, finish or discard. */
export function FinishWorkoutSheet({ visible, elapsed, exerciseCount, sets, onClose, onFinish, onDiscard }: Props) {
  const [notes, setNotes] = useState('');
  const [rpe, setRpe] = useState<number | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Each opening starts from the summary, not a half-finished discard confirmation.
  useEffect(() => {
    if (visible) setConfirmDiscard(false);
  }, [visible]);

  const units = useUnits();
  const completed = sets.filter((s) => s.is_completed === 1);
  const remaining = sets.length - completed.length;
  const volume = completed
    .filter((s) => s.set_type !== 'warmup' && countsTowardVolume(s.tracking_type))
    .reduce((sum, s) => sum + (s.weight_kg ?? 0) * (s.reps ?? 0), 0);

  return (
    <BottomSheet visible={visible} onClose={onClose} avoidKeyboard className="px-5 pb-8 pt-3">
      <View className="mb-4 h-1 w-10 self-center rounded-full bg-surface-border" />

      {confirmDiscard ? (
        <DiscardConfirm
          completedSets={completed.length}
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            onDiscard();
          }}
        />
      ) : (
        <>
          <View className="mb-4 flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-accent-soft">
              <Flag size={20} color={colors.accent} />
            </View>
            <View className="flex-1">
              <Text className="text-xl font-bold text-ink">Finish workout?</Text>
              <Text className="text-sm text-ink-subtle">
                {sets.length === 0
                  ? 'Nothing logged yet.'
                  : remaining === 0
                    ? 'Nice work, every set is done.'
                    : 'Here’s how this session went.'}
              </Text>
            </View>
          </View>

          {/* Summary */}
          <View className="mb-4 flex-row gap-2">
            <Stat icon={<Clock size={14} color={colors.muted} />} label="Duration" value={elapsed} />
            <Stat icon={<Dumbbell size={14} color={colors.muted} />} label="Exercises" value={String(exerciseCount)} />
            <Stat
              icon={<ListChecks size={14} color={colors.muted} />}
              label="Sets"
              value={`${completed.length}/${sets.length}`}
            />
            <Stat
              icon={<Weight size={14} color={colors.muted} />}
              label="Volume"
              value={units.display(volume, 0) || '0'}
              unit={units.label}
            />
          </View>

          {remaining > 0 && (
            <View className="mb-4 flex-row items-center gap-3 rounded-xl border border-pr/30 bg-pr/10 px-3 py-2.5">
              <AlertTriangle size={16} color={colors.pr} />
              <Text className="flex-1 text-sm text-pr">
                {remaining} set{remaining === 1 ? ' isn’t' : 's aren’t'} ticked off and won’t count toward
                volume or PRs.
              </Text>
            </View>
          )}

          {/* Session RPE */}
          <Text className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-subtle">
            How hard was it? <Text className="normal-case tracking-normal text-ink-faint">(RPE, optional)</Text>
          </Text>
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
            onPress={() => {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onFinish({ notes: notes.trim() || null, rpe });
            }}
            className="mb-2 h-14 flex-row items-center justify-center gap-2 rounded-xl bg-accent active:opacity-80"
          >
            <Flag size={18} color={colors.bg} />
            <Text className="text-base font-bold text-surface">Finish & save</Text>
          </Pressable>
          <View className="flex-row gap-2">
            <Pressable
              onPress={onClose}
              className="h-12 flex-1 items-center justify-center rounded-xl bg-surface-elevated active:opacity-70"
            >
              <Text className="font-semibold text-ink">Keep going</Text>
            </Pressable>
            <Pressable
              onPress={() => setConfirmDiscard(true)}
              className="h-12 flex-row items-center justify-center gap-2 rounded-xl border border-settype-failure/30 px-4 active:opacity-70"
            >
              <Trash2 size={16} color={colors.danger} />
              <Text className="font-semibold text-settype-failure">Discard</Text>
            </Pressable>
          </View>
        </>
      )}
    </BottomSheet>
  );
}

function Stat({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string; unit?: string }) {
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
      <Text className="text-base font-bold tabular-nums text-ink" numberOfLines={1}>
        {value}
        {unit && <Text className="text-xs font-medium text-ink-subtle"> {unit}</Text>}
      </Text>
    </View>
  );
}

function DiscardConfirm({
  completedSets,
  onCancel,
  onConfirm,
}: {
  completedSets: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <View>
      <View className="mb-4 items-center gap-3">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-settype-failure/15">
          <Trash2 size={24} color={colors.danger} />
        </View>
        <Text className="text-xl font-bold text-ink">Discard this workout?</Text>
        <Text className="text-center text-sm text-ink-subtle">
          {completedSets > 0
            ? `${completedSets} completed set${completedSets === 1 ? '' : 's'} will be deleted. This can’t be undone.`
            : 'Nothing has been logged yet. This can’t be undone.'}
        </Text>
      </View>
      <Pressable
        onPress={onConfirm}
        className="mb-2 h-14 items-center justify-center rounded-xl bg-settype-failure active:opacity-80"
      >
        <Text className="text-base font-bold text-surface">Yes, discard workout</Text>
      </Pressable>
      <Pressable onPress={onCancel} className="h-12 items-center justify-center rounded-xl bg-surface-elevated active:opacity-70">
        <Text className="font-semibold text-ink">Go back</Text>
      </Pressable>
    </View>
  );
}
