import { Pressable, Text } from 'react-native';
import type { PlanDay } from '@gym/shared';
import { BottomSheet } from './BottomSheet';

/** "Not today? Pick another day": every day of the plan. */
export function PlanDaySheet({
  visible,
  days,
  onClose,
  onPick,
}: {
  visible: boolean;
  days: PlanDay[];
  onClose: () => void;
  onPick: (day: PlanDay) => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} className="gap-2 p-5">
      <Text className="mb-2 text-xl font-bold text-ink">Pick a day</Text>
      {days.map((d) => (
        <Pressable
          key={d.id}
          onPress={() => {
            onClose();
            onPick(d);
          }}
          className="rounded-card border border-surface-border bg-surface-raised p-4 active:opacity-80"
        >
          <Text className="text-base font-semibold text-ink">{d.name}</Text>
        </Pressable>
      ))}
    </BottomSheet>
  );
}
