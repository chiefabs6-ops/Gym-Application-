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
    <View className={`flex-row rounded-full bg-surface-raised p-1 ${className}`}>
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
            className={`min-h-10 flex-1 items-center justify-center rounded-full py-2 ${active ? 'bg-ink' : ''}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text className={`text-sm ${active ? 'font-semibold text-surface' : 'text-ink-muted'}`}>{o.label}</Text>
            {o.detail !== undefined && (
              <Text className={`text-[11px] tabular-nums ${active ? 'text-surface/70' : 'text-ink-subtle'}`}>{o.detail}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
