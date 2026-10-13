import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { create } from 'zustand';
import { RIR_CHOICES, RPE_CHOICES, formatEffort, rirToRpe } from '@gym/shared';
import { updateSet } from '../db/repositories/workouts';
import { useSettingsStore } from '../state/settingsStore';
import { BottomSheet } from './BottomSheet';

/** Which set the effort picker is open for (one picker for the whole app, mounted in the root layout). */
export const useEffortSheet = create<{ setId: string | null; rpe: number | null; open: (setId: string, rpe: number | null) => void; close: () => void }>()(
  (set) => ({
    setId: null,
    rpe: null,
    open: (setId, rpe) => set({ setId, rpe }),
    close: () => set({ setId: null, rpe: null }),
  }),
);

const HINTS: Record<'rpe' | 'rir', string> = {
  rpe: 'Rate of perceived exertion: 10 = nothing left, 8 = 2 reps left.',
  rir: 'Reps in reserve: how many more you could have done. 0 = failure.',
};

/** Quick picker for one set's effort, shown as RPE or RIR per Settings; always saved as RPE. */
export function EffortSheet() {
  const { setId, rpe, close } = useEffortSheet();
  const mode = useSettingsStore((s) => s.effort_input);
  const kind = mode === 'rir' ? 'rir' : 'rpe';

  const choose = (value: number | null) => {
    if (setId) {
      void Haptics.selectionAsync();
      void updateSet(setId, { rpe: value });
    }
    close();
  };

  const choices: { label: string; rpe: number }[] =
    kind === 'rpe'
      ? RPE_CHOICES.map((v) => ({ label: String(v), rpe: v }))
      : RIR_CHOICES.map((r) => ({ label: r === 5 ? '5+' : String(r), rpe: rirToRpe(r) }));

  return (
    <BottomSheet visible={setId !== null} animationType="fade" onClose={close} className="p-4 pb-8">
      <View className="mb-3 h-1 w-10 self-center rounded-full bg-surface-border" />
      <Text className="px-1 text-xs font-semibold uppercase tracking-widest text-ink-subtle">
        {kind === 'rpe' ? 'RPE' : 'RIR'} for this set
      </Text>
      <Text className="mb-3 mt-1 px-1 text-xs text-ink-faint">{HINTS[kind]}</Text>
      <View className="flex-row flex-wrap gap-2">
        {choices.map((c) => {
          const active = formatEffort(rpe, kind) === c.label;
          return (
            <Pressable
              key={c.label}
              onPress={() => choose(c.rpe)}
              className={`h-12 min-w-14 items-center justify-center rounded-xl border px-3 ${
                active ? 'border-accent bg-accent-soft' : 'border-surface-border bg-surface-elevated'
              }`}
            >
              <Text className={`text-base font-bold ${active ? 'text-accent' : 'text-ink'}`}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {rpe !== null && (
        <Pressable onPress={() => choose(null)} className="mt-3 h-11 items-center justify-center rounded-xl active:opacity-70">
          <Text className="font-semibold text-ink-muted">Clear</Text>
        </Pressable>
      )}
    </BottomSheet>
  );
}
