import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

/** Pill switch for 2–4 options (History Workouts / Stats / Body, My foods tabs). */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T;
  options: readonly { value: T; label: string; detail?: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <View className={`flex-row rounded-xl bg-surface-raised p-1 ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (active) return;
              void Haptics.selectionAsync();
              onChange(o.value);
            }}
            className={`flex-1 items-center rounded-lg py-2 ${active ? 'bg-surface-elevated' : ''}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text className={`text-sm ${active ? 'font-semibold text-ink' : 'text-ink-muted'}`}>{o.label}</Text>
            {o.detail !== undefined && <Text className="text-[11px] tabular-nums text-ink-subtle">{o.detail}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}
