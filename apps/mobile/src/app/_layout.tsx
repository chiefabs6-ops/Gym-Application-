import '../../global.css';
import { useEffect, useState } from 'react';
import { ActivityIndicator, LogBox, View } from 'react-native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { initDatabase } from '../db/migrations';
import { ensureLocalUser } from '../db/repositories/user';
import { CLOUD_SYNC_ENABLED } from '../config';
import { clearOutbox, startSyncManager } from '../db/sync/syncManager';
import { configureNotifications } from '../services/notifications';
import { useActiveWorkoutStore } from '../state/activeWorkoutStore';
import { useIntervalRunCues } from '../state/intervalRunStore';
import { useRestTimerCues, useRestTimerStore } from '../state/restTimerStore';
import { useSettingsStore } from '../state/settingsStore';
import { initSounds } from '../services/sounds';
import { runAutoBackup } from '../services/backup';
import { installGlobalErrorLogging, recordCrash } from '../services/crashLog';
import { seedBuiltinFoods } from '../db/repositories/builtinFoods';
import { CrashScreen } from '../components/CrashScreen';
import { EffortSheet } from '../components/EffortSheet';
import { PlateCalculatorSheet } from '../components/PlateCalculatorSheet';
import { WorkoutNotificationSync } from '../components/WorkoutNotificationSync';
import { LockScreenMode } from '../components/LockScreenWorkout';
import { Toast } from '../components/Toast';
import { colors } from '../theme';

// Expo Go warns that *remote* push isn't supported. We only use local notifications (rest timer),
// which work fine, so keep the toast from covering the workout nav bar during development.
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  '`expo-notifications` functionality is not fully supported',
]);

installGlobalErrorLogging();

/**
 * Root error boundary (expo-router picks up this export): any render error in a screen shows the
 * friendly crash page instead of a blank/frozen app, and is written to the offline crash log.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <CrashScreen error={error} where="render" onRetry={() => void retry()} />;
}

/** Boot order matters: DB → local user → rehydrate stores → sync. */
async function bootstrap(): Promise<() => void> {
  await initDatabase();
  await ensureLocalUser();
  await useSettingsStore.getState().load();
  await Promise.all([useActiveWorkoutStore.persist.rehydrate(), useRestTimerStore.persist.rehydrate()]);
  await useActiveWorkoutStore.getState().restore();
  void configureNotifications().catch(() => undefined);
  void initSounds().catch(() => undefined);
  void runAutoBackup(); // weekly safety net even if no workout was finished
  // Built-in food list (ROADMAP 2.15): loaded after startup, never blocks or breaks opening the app.
  void seedBuiltinFoods().catch((e) => recordCrash(e, 'seedBuiltinFoods'));
  if (CLOUD_SYNC_ENABLED) return startSyncManager();
  await clearOutbox(); // offline-only: nothing will ever drain it
  return () => undefined;
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let dispose: (() => void) | undefined;
    bootstrap()
      .then((d) => {
        dispose = d;
        setReady(true);
      })
      .catch((e: unknown) => setError(e ?? new Error('Startup failed')));
    return () => dispose?.();
  }, [attempt]);

  if (error) {
    return (
      <CrashScreen
        error={error}
        where="startup"
        onRetry={() => {
          setError(null);
          setAttempt((a) => a + 1);
        }}
      />
    );
  }
  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-6">
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  // KeyboardProvider: with Android edge-to-edge the window no longer resizes for the keyboard, so
  // screens use KeyboardAwareScrollView (src/components/KeyboardAware.tsx) to keep inputs visible.
  return (
    <KeyboardProvider>
      <RestTimerCues />
      <IntervalRunCues />
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#121214' } }} />
      <EffortSheet />
      <PlateCalculatorSheet />
      <WorkoutNotificationSync />
      <LockScreenMode />
      <Toast />
    </KeyboardProvider>
  );
}

/** Owns rest-timer beeps/vibration/expiry app-wide, so they fire on every tab. */
function RestTimerCues() {
  useRestTimerCues();
  return null;
}

/** Owns interval-timer beeps and logs finished timed sets app-wide (see intervalRunStore). */
function IntervalRunCues() {
  useIntervalRunCues();
  return null;
}
