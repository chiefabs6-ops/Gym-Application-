import { useCallback, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ShieldAlert } from 'lucide-react-native';
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
      className="min-h-12 flex-row items-center gap-2.5 rounded-2xl bg-pr/10 px-3.5 py-2 active:opacity-80"
      accessibilityLabel="Back up your workouts"
    >
      <ShieldAlert size={16} color={colors.pr} />
      <Text className="flex-1 text-sm text-ink">Only on this phone. No recent backup.</Text>
      <Text className="text-sm font-semibold text-pr">Back up</Text>
    </Pressable>
  );
}
