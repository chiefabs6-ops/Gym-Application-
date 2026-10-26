import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { colors } from '../../theme';

/** Field that opens an inline list of options (serving size, meal). */
export function Dropdown<T>({
  label,
  value,
  options,
  format,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  format: (v: T) => string;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View className="gap-1">
      <Text className="text-xs text-ink-muted">{label}</Text>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        className="flex-row items-center justify-between rounded-xl bg-surface-elevated px-3 py-3 active:opacity-80"
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${format(value)}`}
      >
        <Text className="flex-1 text-base text-ink" numberOfLines={1}>
          {format(value)}
        </Text>
        <ChevronDown size={18} color={colors.muted} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Pressable>
      {open && (
        <View className="overflow-hidden rounded-xl border border-surface-border bg-surface-elevated">
          {options.map((o, i) => {
            const selected = format(o) === format(value);
            return (
              <Pressable
                key={`${format(o)}-${i}`}
                onPress={() => {
                  onChange(o);
                  setOpen(false);
                }}
                className={`px-3 py-3 active:bg-surface-border ${i > 0 ? 'border-t border-surface-border' : ''}`}
              >
                <Text className={selected ? 'font-semibold text-accent' : 'text-ink'}>{format(o)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
