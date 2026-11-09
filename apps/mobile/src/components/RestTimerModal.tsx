import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Pause, Play, SkipForward, Volume2, VolumeX } from 'lucide-react-native';
import { useRestTimer, useRestTimerStore } from '../state/restTimerStore';
import { useSettingsStore } from '../state/settingsStore';
import { colors } from '../theme';
import { BottomSheet } from './BottomSheet';

const fmt = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * Floating rest countdown shown after a set is completed.
 * Compact banner with +30s / Skip; tap the banner for the full timer modal.
 */
export function RestTimerBanner({ next = null }: { /** What follows the rest, e.g. "set 3". */ next?: string | null }) {
  const { remainingMs, totalMs, isActive, isPaused } = useRestTimer();
  const endsAt = useRestTimerStore((s) => s.endsAt);
  const { adjust, pause, resume, stop } = useRestTimerStore();
  const soundEnabled = useSettingsStore((s) => s.rest_sound);
  const updateSettings = useSettingsStore((s) => s.update);
  const toggleSound = () => void updateSettings({ rest_sound: !soundEnabled });
  const [expanded, setExpanded] = useState(false);

  // The banner is the timer: a green fill that drains right to left. It is driven by one native animation from
  // the wall clock (endsAt), restarted whenever the deadline changes (+30s, pause, resume), so it never drifts.
  const drain = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (totalMs <= 0) return;
    const left = isPaused ? remainingMs : endsAt === null ? 0 : Math.max(0, endsAt - Date.now());
    drain.setValue(Math.min(1, left / totalMs));
    if (isPaused || endsAt === null) return;
    const anim = Animated.timing(drain, { toValue: 0, duration: left, easing: Easing.linear, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [endsAt, totalMs, isPaused]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isActive) return null;
  const progress = totalMs > 0 ? Math.min(1, remainingMs / totalMs) : 0;
  const skip = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void stop();
    setExpanded(false);
  };
  // The last 10 seconds turn the remaining fill brighter: get ready.
  const fill = remainingMs <= 10_000 ? '#0F9F6E' : '#0E6B4F';

  return (
    <>
      <Pressable
        onPress={() => setExpanded(true)}
        className="mx-4 mb-2 h-[76px] overflow-hidden rounded-[20px] bg-surface-raised"
        accessibilityLabel={`Rest ${fmt(remainingMs)} left. Tap for the full timer`}
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: fill, transformOrigin: 'left', transform: [{ scaleX: drain }] }]}
        />
        <View className="h-full flex-row items-center gap-2.5 pl-[18px] pr-3">
          <View className="flex-1">
            <Text className="text-[28px] font-bold leading-8 tabular-nums text-ink">{fmt(remainingMs)}</Text>
            <View className="flex-row items-center gap-1">
              <Text className="text-[13px] text-zinc-200" numberOfLines={1}>
                {isPaused ? 'Rest paused' : next ? `Rest, then ${next}` : 'Rest'}
              </Text>
              {!soundEnabled && <VolumeX size={12} color="#E4E4E7" />}
            </View>
          </View>
          <Pressable onPress={() => void adjust(30)} className="h-11 justify-center rounded-full bg-black/30 px-3.5" hitSlop={4}>
            <Text className="font-semibold text-ink">+30s</Text>
          </Pressable>
          <Pressable onPress={skip} className="h-11 justify-center rounded-full bg-ink px-[18px]" hitSlop={4}>
            <Text className="font-bold text-surface">Skip</Text>
          </Pressable>
        </View>
      </Pressable>

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
