import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ChevronRight, ShieldAlert } from 'lucide-react-native';
import { needsBackupReminder } from '../services/backup';
import { colors } from '../theme';

/** Nudge shown on the Workout tab when there's logged data but no recent backup. */
export function BackupReminder() {
  const [show, setShow] = useState(false);
  useFocusEffect(
    useCallback(() => {
      void needsBackupReminder().then(setShow);
    }, []),
  );
  if (!show) return null;

  return (
    <Pressable
      onPress={() => router.navigate('/settings')}
      className="flex-row items-center gap-3 rounded-card border border-pr/30 bg-pr/10 p-4 active:opacity-80"
      accessibilityLabel="Back up your workouts"
    >
      <ShieldAlert size={20} color={colors.pr} />
      <View className="flex-1">
        <Text className="font-semibold text-ink">Back up your workouts</Text>
        <Text className="text-xs text-ink-muted">They’re only stored on this phone. Turn on automatic backups.</Text>
      </View>
      <ChevronRight size={18} color={colors.pr} />
    </Pressable>
  );
}
