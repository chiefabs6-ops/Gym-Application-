import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Dumbbell, Info, Ruler, Timer, WifiOff } from 'lucide-react-native';
import { REST_SECONDS_MAX, REST_SECONDS_MIN } from '@gym/shared';
import { BackupSection } from '../components/BackupSection';
import { DurationInputSheet } from '../components/DurationInputSheet';
import { CloudAccountSection } from '../components/CloudAccountSection';
import { SegmentedRow, SettingsCard, StepperRow, ToggleRow } from '../components/SettingsControls';
import { TrainingPlanSection } from '../components/TrainingPlanSection';
import { CLOUD_SYNC_ENABLED } from '../config';
import { clearCrashLog, readCrashLog, shareCrashLog } from '../services/crashLog';
import { useSettingsStore } from '../state/settingsStore';
import { colors } from '../theme';

const formatRest = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * Settings tab (ROADMAP 1.3 / 1.4). Every change is saved immediately to the local user row,
 * so it persists across restarts and is included in backups.
 */
export default function SettingsScreen() {
  const settings = useSettingsStore();
  const update = settings.update;
  const [editingRest, setEditingRest] = useState(false);
  const [editingWarmupRest, setEditingWarmupRest] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <KeyboardAwareScrollView bottomOffset={16} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text className="text-3xl font-bold text-ink">Settings</Text>

        <SettingsCard title="Units" icon={<Ruler size={18} color={colors.accent} />}>
          <SegmentedRow
            label="Weight"
            hint="Workouts are stored in kg, so switching never changes your data."
            value={settings.unit}
            options={[
              { value: 'metric', label: 'kg' },
              { value: 'imperial', label: 'lb' },
            ]}
            onChange={(unit) => void update({ unit })}
          />
        </SettingsCard>

        <TrainingPlanSection />

        <SettingsCard title="Rest timer" icon={<Timer size={18} color={colors.accent} />}>
          <StepperRow
            label="Default rest"
            hint="Used when a routine doesn’t set its own rest time. Tap the time to type it."
            value={settings.default_rest_seconds}
            format={formatRest}
            step={15}
            min={REST_SECONDS_MIN}
            max={REST_SECONDS_MAX}
            onChange={(default_rest_seconds) => void update({ default_rest_seconds })}
            onPressValue={() => setEditingRest(true)}
          />
          <StepperRow
            label="Warm-up rest"
            hint={settings.warmup_rest_seconds === null ? 'Same as working sets. Tap + to set a shorter one' : 'After warm-up (W) sets'}
            value={settings.warmup_rest_seconds ?? 0}
            format={(v) => (settings.warmup_rest_seconds === null ? 'Same' : formatRest(v))}
            step={15}
            min={0}
            max={REST_SECONDS_MAX}
            onChange={(v) => void update({ warmup_rest_seconds: v === 0 ? null : v })}
            onPressValue={() => setEditingWarmupRest(true)}
          />
          <ToggleRow
            label="Start rest timer on ✓"
            hint="Off: tick sets without a timer (start rest yourself when you want)"
            value={settings.rest_auto_start}
            onChange={(rest_auto_start) => void update({ rest_auto_start })}
          />
          <ToggleRow
            label="Sound"
            hint="3·2·1 countdown and a finish beep. When locked, plays at your alarm volume."
            value={settings.rest_sound}
            onChange={(rest_sound) => void update({ rest_sound })}
          />
          <ToggleRow
            label="Vibration"
            hint="Buzz when rest is over, in the app and on the lock screen"
            value={settings.rest_vibration}
            onChange={(rest_vibration) => void update({ rest_vibration })}
          />
        </SettingsCard>

        <SettingsCard title="Workout" icon={<Dumbbell size={18} color={colors.accent} />}>
          <ToggleRow
            label="Keep screen awake"
            hint="Stops the screen sleeping while a workout is open"
            value={settings.keep_awake}
            onChange={(keep_awake) => void update({ keep_awake })}
          />
          <SegmentedRow
            label="Previous values from"
            hint="What the PREVIOUS column and the faded hints show"
            value={settings.previous_source}
            options={[
              { value: 'last_session', label: 'Last session' },
              { value: 'same_routine', label: 'Same routine' },
            ]}
            onChange={(previous_source) => void update({ previous_source })}
          />
          <ToggleRow
            label="Workout on lock screen"
            hint="Like Maps: if the workout is open when you lock the phone, it shows over the lock screen so you can log sets. Swipe up for your normal lock screen"
            value={settings.lock_screen_mode}
            onChange={(lock_screen_mode) => void update({ lock_screen_mode })}
          />
          <ToggleRow
            label="Lock-screen workout card"
            hint="Shows the next set with a Complete set button, so you can log without unlocking"
            value={settings.workout_notification}
            onChange={(workout_notification) => void update({ workout_notification })}
          />
          <SegmentedRow
            label="Effort per set"
            hint="Adds a column to rate each set. RIR 2 = RPE 8 (2 reps left)"
            value={settings.effort_input}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'rpe', label: 'RPE' },
              { value: 'rir', label: 'RIR' },
            ]}
            onChange={(effort_input) => void update({ effort_input })}
          />
        </SettingsCard>

        {CLOUD_SYNC_ENABLED && <CloudAccountSection />}

        <SettingsCard title="About" icon={<Info size={18} color={colors.accent} />}>
          <View className="gap-2">
            {!CLOUD_SYNC_ENABLED && (
              <View className="flex-row items-center gap-2">
                <WifiOff size={14} color={colors.accent} />
                <Text className="flex-1 text-sm text-ink-muted">
                  Works offline. No account needed; your data stays on this phone. Online food search and barcode
                  lookups use Open Food Facts.
                </Text>
              </View>
            )}
            <Text className="text-sm text-ink-muted">Gym Log {Constants.expoConfig?.version ?? ''}</Text>
            <ErrorReportsRow />
            <Text className="text-[11px] leading-4 text-ink-faint">
              Exercise illustrations: exercise data by RepDB (repdb.co), recoloured.
            </Text>
            <Text className="text-[11px] leading-4 text-ink-faint">
              Built-in foods: UK CoFID (McCance and Widdowson's Composition of Foods Integrated Dataset 2021), contains
              public sector information licensed under the Open Government Licence v3.0; and USDA FoodData Central
              (public domain).
            </Text>
            <Text className="text-[11px] leading-4 text-ink-faint">
              Online products contain data from Open Food Facts (openfoodfacts.org), available under the Open Database
              License (ODbL).
            </Text>
          </View>
        </SettingsCard>

        <BackupSection />
      </KeyboardAwareScrollView>

      <DurationInputSheet
        visible={editingRest}
        title="Default rest"
        value={settings.default_rest_seconds}
        min={REST_SECONDS_MIN}
        max={REST_SECONDS_MAX}
        onClose={() => setEditingRest(false)}
        onSave={(default_rest_seconds) => void update({ default_rest_seconds })}
      />
      <DurationInputSheet
        visible={editingWarmupRest}
        title="Warm-up rest"
        value={settings.warmup_rest_seconds ?? 60}
        min={0}
        max={REST_SECONDS_MAX}
        onClose={() => setEditingWarmupRest(false)}
        onSave={(s) => void update({ warmup_rest_seconds: s === 0 ? null : s })}
      />
    </SafeAreaView>
  );
}

/** Shown only when the offline crash log has entries (ROADMAP 1.6). */
function ErrorReportsRow() {
  const [count, setCount] = useState(0);
  const refresh = useCallback(() => {
    void readCrashLog().then((l) => setCount(l.length));
  }, []);
  useFocusEffect(refresh);
  if (count === 0) return null;
  return (
    <View className="mt-1 flex-row items-center gap-2 rounded-xl bg-surface-elevated p-3">
      <Text className="flex-1 text-sm text-ink-muted">
        {count} saved error report{count === 1 ? '' : 's'}
      </Text>
      <Pressable onPress={() => void shareCrashLog()} className="rounded-lg border border-surface-border px-3 py-1.5">
        <Text className="text-xs font-semibold text-ink">Share</Text>
      </Pressable>
      <Pressable onPress={() => void clearCrashLog().then(refresh)} className="rounded-lg border border-surface-border px-3 py-1.5">
        <Text className="text-xs font-semibold text-ink-subtle">Clear</Text>
      </Pressable>
    </View>
  );
}
