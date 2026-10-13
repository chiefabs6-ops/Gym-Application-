import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Pause, Play, SkipForward, Timer, Volume2, VolumeX } from 'lucide-react-native';
import { useRestTimer, useRestTimerStore } from '../state/restTimerStore';
import { useSettingsStore } from '../state/settingsStore';
import { cardShadow, colors } from '../theme';
import { BottomSheet } from './BottomSheet';

const fmt = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * Floating rest countdown shown after a set is completed.
 * Compact banner with +30s / Skip; tap the banner for the full timer modal.
 */
export function RestTimerBanner() {
  const { remainingMs, totalMs, isActive, isPaused } = useRestTimer();
  const { adjust, pause, resume, stop } = useRestTimerStore();
  const soundEnabled = useSettingsStore((s) => s.rest_sound);
  const updateSettings = useSettingsStore((s) => s.update);
  const toggleSound = () => void updateSettings({ rest_sound: !soundEnabled });
  const [expanded, setExpanded] = useState(false);

  if (!isActive) return null;
  const progress = totalMs > 0 ? Math.min(1, remainingMs / totalMs) : 0;
  const skip = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void stop();
    setExpanded(false);
  };

  return (
    <>
      <View className="mx-4 mb-2 overflow-hidden rounded-2xl border border-surface-border bg-surface-raised" style={cardShadow}>
        <Pressable onPress={() => setExpanded(true)} className="flex-row items-center gap-3 px-4 py-3">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-accent-soft">
            <Timer size={18} color={colors.accent} />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-1">
              <Text className="text-[11px] font-semibold uppercase tracking-widest text-ink-subtle">
                {isPaused ? 'Rest paused' : 'Rest'}
              </Text>
              {!soundEnabled && <VolumeX size={11} color={colors.subtle} />}
            </View>
            <Text className="text-xl font-bold tabular-nums text-ink">{fmt(remainingMs)}</Text>
          </View>
          <Pressable onPress={() => void adjust(30)} className="rounded-lg bg-surface-elevated px-3 py-2" hitSlop={4}>
            <Text className="font-semibold text-ink">+30s</Text>
          </Pressable>
          <Pressable onPress={skip} className="flex-row items-center gap-1 rounded-lg bg-accent px-3 py-2" hitSlop={4}>
            <Text className="font-bold text-surface">Skip</Text>
            <SkipForward size={14} color={colors.bg} />
          </Pressable>
        </Pressable>
        <View className="h-1 bg-surface-elevated">
          <View className="h-full bg-accent" style={{ width: `${progress * 100}%` }} />
        </View>
      </View>

      <BottomSheet visible={expanded} animationType="fade" onClose={() => setExpanded(false)} className="items-center gap-6 px-6 pb-10 pt-4">
        <View className="h-1 w-10 rounded-full bg-surface-border" />
        <View className="w-full flex-row items-center justify-between">
          <Text className="text-xs font-semibold uppercase tracking-widest text-ink-subtle">Rest timer</Text>
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              toggleSound();
            }}
            className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${
              soundEnabled ? 'border-accent/40 bg-accent-soft' : 'border-surface-border'
            }`}
            accessibilityLabel={soundEnabled ? 'Mute rest timer beeps' : 'Unmute rest timer beeps'}
          >
            {soundEnabled ? <Volume2 size={14} color={colors.accent} /> : <VolumeX size={14} color={colors.subtle} />}
            <Text className={`text-xs font-semibold ${soundEnabled ? 'text-accent' : 'text-ink-subtle'}`}>
              {soundEnabled ? 'Sound on' : 'Muted'}
            </Text>
          </Pressable>
        </View>
        <Text className="text-7xl font-bold tabular-nums text-ink">{fmt(remainingMs)}</Text>
        <View className="h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
          <View className="h-full rounded-full bg-accent" style={{ width: `${progress * 100}%` }} />
        </View>
        <View className="w-full flex-row gap-3">
          <TimerButton label="−15s" onPress={() => void adjust(-15)} />
          <TimerButton
            label={isPaused ? 'Resume' : 'Pause'}
            icon={isPaused ? <Play size={16} color={colors.ink} /> : <Pause size={16} color={colors.ink} />}
            onPress={() => void (isPaused ? resume() : pause())}
          />
          <TimerButton label="+30s" onPress={() => void adjust(30)} />
        </View>
        <Pressable onPress={skip} className="w-full flex-row items-center justify-center gap-2 rounded-xl bg-accent py-4">
          <Text className="text-base font-bold text-surface">Skip rest</Text>
          <SkipForward size={16} color={colors.bg} />
        </Pressable>
      </BottomSheet>
    </>
  );
}

function TimerButton({ label, icon, onPress }: { label: string; icon?: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-surface-elevated py-3">
      {icon}
      <Text className="font-semibold text-ink">{label}</Text>
    </Pressable>
  );
}
