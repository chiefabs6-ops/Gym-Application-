import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Dumbbell, Play, Trash2 } from 'lucide-react-native';
import { colors } from '../theme';
import { BottomSheet } from './BottomSheet';

interface Props {
  /** Routine the user tried to start; null hides the sheet. */
  routineTitle: string | null;
  startedAt: number | null;
  onClose: () => void;
  onResume: () => void;
  onDiscardAndStart: () => void;
}

const minutesAgo = (t: number | null) => (t ? Math.max(0, Math.round((Date.now() - t) / 60_000)) : 0);

/** Shown when starting a routine while another workout is still in progress. */
export function WorkoutConflictSheet({ routineTitle, startedAt, onClose, onResume, onDiscardAndStart }: Props) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (routineTitle) setConfirming(false);
  }, [routineTitle]);

  const mins = minutesAgo(startedAt);

  return (
    <BottomSheet visible={routineTitle !== null} animationType="slide" onClose={onClose} className="px-5 pb-8 pt-3">
      <View className="mb-4 h-1 w-10 self-center rounded-full bg-surface-border" />

      {confirming ? (
        <>
          <View className="mb-4 items-center gap-3">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-settype-failure/15">
              <Trash2 size={24} color={colors.danger} />
            </View>
            <Text className="text-xl font-bold text-ink">Discard current workout?</Text>
            <Text className="text-center text-sm text-ink-subtle">
              Everything logged in it will be deleted, then “{routineTitle}” starts. This can’t be undone.
            </Text>
          </View>
          <Pressable
            onPress={() => {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              onDiscardAndStart();
            }}
            className="mb-2 h-14 items-center justify-center rounded-xl bg-settype-failure active:opacity-80"
          >
            <Text className="text-base font-bold text-surface">Discard & start {routineTitle}</Text>
          </Pressable>
          <Pressable
            onPress={() => setConfirming(false)}
            className="h-12 items-center justify-center rounded-xl bg-surface-elevated active:opacity-70"
          >
            <Text className="font-semibold text-ink">Go back</Text>
          </Pressable>
        </>
      ) : (
        <>
          <View className="mb-5 flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-accent-soft">
              <Dumbbell size={20} color={colors.accent} />
            </View>
            <View className="flex-1">
              <Text className="text-xl font-bold text-ink">Workout in progress</Text>
              <Text className="text-sm text-ink-subtle">
                Started {mins === 0 ? 'just now' : `${mins} min ago`}. Finish or discard it before starting “
                {routineTitle}”.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={onResume}
            className="mb-2 h-14 flex-row items-center justify-center gap-2 rounded-xl bg-accent active:opacity-80"
          >
            <Play size={18} color={colors.bg} fill={colors.bg} />
            <Text className="text-base font-bold text-surface">Resume current workout</Text>
          </Pressable>
          <View className="flex-row gap-2">
            <Pressable
              onPress={onClose}
              className="h-12 flex-1 items-center justify-center rounded-xl bg-surface-elevated active:opacity-70"
            >
              <Text className="font-semibold text-ink">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => setConfirming(true)}
              className="h-12 flex-row items-center justify-center gap-2 rounded-xl border border-settype-failure/30 px-4 active:opacity-70"
            >
              <Trash2 size={16} color={colors.danger} />
              <Text className="font-semibold text-settype-failure">Discard & start new</Text>
            </Pressable>
          </View>
        </>
      )}
    </BottomSheet>
  );
}
