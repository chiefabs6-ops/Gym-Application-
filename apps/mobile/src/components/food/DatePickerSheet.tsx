import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { toLocalDateKey } from '@gym/shared';
import { colors } from '../../theme';
import { BottomSheet } from '../BottomSheet';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Month calendar for picking a diary day. */
export function DatePickerSheet({
  visible,
  value,
  onPick,
  onClose,
}: {
  visible: boolean;
  value: string;
  onPick: (key: string) => void;
  onClose: () => void;
}) {
  const [month, setMonth] = useState(() => new Date());
  useEffect(() => {
    if (!visible) return;
    const [y, m] = value.split('-').map(Number) as [number, number];
    setMonth(new Date(y, m - 1, 1, 12));
  }, [visible, value]);

  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const today = toLocalDateKey(new Date());
  const cells: (string | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: days }, (_, i) => toLocalDateKey(new Date(month.getFullYear(), month.getMonth(), i + 1, 12))),
  ];
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1, 12));

  return (
    <BottomSheet visible={visible} onClose={onClose} className="px-5 pb-8 pt-3">
      <View className="mb-4 h-1 w-10 self-center rounded-full bg-surface-border" />
      <View className="mb-3 flex-row items-center justify-between">
        <Pressable onPress={() => shift(-1)} hitSlop={10} accessibilityLabel="Previous month">
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
        <Text className="text-lg font-bold text-ink">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
        <Pressable onPress={() => shift(1)} hitSlop={10} accessibilityLabel="Next month">
          <ChevronRight size={22} color={colors.ink} />
        </Pressable>
      </View>
      <View className="flex-row">
        {WEEKDAYS.map((d, i) => (
          <Text key={i} className="flex-1 text-center text-xs text-ink-subtle">
            {d}
          </Text>
        ))}
      </View>
      <View className="mt-1 flex-row flex-wrap">
        {cells.map((key, i) => (
          <View key={i} style={{ width: `${100 / 7}%` }} className="items-center py-1">
            {key && (
              <Pressable
                onPress={() => {
                  onPick(key);
                  onClose();
                }}
                className={`h-10 w-10 items-center justify-center rounded-full ${key === value ? 'bg-accent' : key === today ? 'border border-accent' : ''}`}
              >
                <Text className={`tabular-nums ${key === value ? 'font-bold text-surface' : 'text-ink'}`}>{Number(key.slice(8))}</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>
      <Pressable
        onPress={() => {
          onPick(today);
          onClose();
        }}
        className="mt-3 h-12 items-center justify-center rounded-xl bg-surface-elevated active:opacity-80"
      >
        <Text className="font-semibold text-ink">Today</Text>
      </Pressable>
    </BottomSheet>
  );
}
