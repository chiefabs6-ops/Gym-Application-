import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Pause, Play, SkipForward, Square } from 'lucide-react-native';
import { useIntervalRun, useIntervalRunStore } from '../state/intervalRunStore';
import { cardShadow, colors } from '../theme';
import { ConfirmSheet, type ConfirmRequest } from './ConfirmSheet';

const fmt = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * Interval timer for timed sets: WORK / REST, the countdown, which set, and pause / skip / stop.
 * Shown in place of the rest banner while a run is active (the two never run together).
 */
export function IntervalRunBanner() {
  const view = useIntervalRun();
  const { pause, resume, skip, stop } = useIntervalRunStore();
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  if (!view || view.state.done || !view.state.phase) return null;

  const { run, state } = view;
  const phase = state.phase!;
  const work = phase.kind === 'work';
  const paused = run.pausedAt !== null;
  const tint = work ? colors.accent : colors.superset;
  const progress = phase.durationMs > 0 ? Math.min(1, state.remainingMs / phase.durationMs) : 0;

  const askStop = () => {
    if (!work) return void stop();
    setConfirm({
      title: 'Stop the interval timer?',
      message: `Set ${phase.setIndex + 1} is logged with the time done so far. Later sets stay unticked.`,
      confirmLabel: 'Stop',
      onConfirm: () => void stop(),
    });
  };

  return (
    <>
      <View className="mx-4 mb-2 overflow-hidden rounded-2xl border border-surface-border bg-surface-raised" style={cardShadow}>
        <View className="flex-row items-center gap-3 px-4 py-3">
          <View className="flex-1">
            <Text className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: tint }}>
              {work ? 'Work' : 'Rest'}
              {paused ? ' · paused' : ''} · set {phase.setIndex + 1}/{run.setIds.length}
            </Text>
            <Text className="text-3xl font-bold tabular-nums text-ink">{fmt(state.remainingMs)}</Text>
            <Text className="text-xs text-ink-subtle" numberOfLines={1}>
              {run.exerciseName}
            </Text>
          </View>
          <RoundButton
            label={paused ? 'Resume' : 'Pause'}
            onPress={() => void (paused ? resume() : pause())}
            icon={paused ? <Play size={18} color={colors.ink} /> : <Pause size={18} color={colors.ink} />}
          />
          <RoundButton label="Skip" onPress={() => void skip()} icon={<SkipForward size={18} color={colors.ink} />} />
          <RoundButton label="Stop" onPress={askStop} icon={<Square size={16} color={colors.danger} />} />
        </View>
        <View className="h-1 bg-surface-elevated">
          <View className="h-full" style={{ width: `${progress * 100}%`, backgroundColor: tint }} />
        </View>
      </View>
      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}

function RoundButton({ label, icon, onPress }: { label: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      hitSlop={4}
      accessibilityLabel={label}
      className="h-11 w-11 items-center justify-center rounded-full bg-surface-elevated active:opacity-70"
    >
      {icon}
    </Pressable>
  );
}
