import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ChevronDown, Minus, Plus } from 'lucide-react-native';
import { colors } from '../theme';

/** Titled card grouping related settings. Collapsed by default: tap the title to open it. */
export function SettingsCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="rounded-card border border-surface-border bg-surface-raised px-4">
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          setOpen((v) => !v);
        }}
        className="flex-row items-center gap-3 py-4"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-accent-soft">{icon}</View>
        <Text className="flex-1 text-base font-bold text-ink">{title}</Text>
        <ChevronDown size={18} color={colors.subtle} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Pressable>
      {open && <View className="-mt-2 pb-3">{children}</View>}
    </View>
  );
}

/** `inline` = beside a control in a row (takes the remaining width); otherwise stacked above it. */
function RowText({ label, hint, inline = true }: { label: string; hint?: string; inline?: boolean }) {
  return (
    <View className={inline ? 'flex-1 pr-3' : ''}>
      <Text className="text-base font-medium text-ink">{label}</Text>
      {hint && <Text className="mt-0.5 text-xs leading-4 text-ink-subtle">{hint}</Text>}
    </View>
  );
}

export function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onChange(!value);
      }}
      className="flex-row items-center py-3"
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
    >
      <RowText label={label} hint={hint} />
      <View className={`h-8 w-14 justify-center rounded-full px-1 ${value ? 'bg-accent' : 'bg-surface-border'}`}>
        <View className={`h-6 w-6 rounded-full bg-ink ${value ? 'self-end' : 'self-start'}`} />
      </View>
    </Pressable>
  );
}

export function SegmentedRow<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View className="gap-2 py-3">
      <RowText label={label} hint={hint} inline={false} />
      <View className="flex-row rounded-xl bg-surface-elevated p-1">
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
              className={`flex-1 items-center rounded-lg py-2 ${active ? 'bg-accent' : ''}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Text className={`font-semibold ${active ? 'text-surface' : 'text-ink-muted'}`}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function StepperRow({
  label,
  hint,
  value,
  format,
  step,
  min,
  max,
  onChange,
  onPressValue,
}: {
  label: string;
  hint?: string;
  value: number;
  format: (v: number) => string;
  /** Makes the value tappable (e.g. to type an exact value). */
  onPressValue?: () => void;
  step: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const change = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    if (clamped === value) return;
    void Haptics.selectionAsync();
    onChange(clamped);
  };
  return (
    <View className="flex-row items-center py-3">
      <RowText label={label} hint={hint} />
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={() => change(value - step)}
          disabled={value <= min}
          className={`h-9 w-9 items-center justify-center rounded-lg bg-surface-elevated ${value <= min ? 'opacity-40' : ''}`}
          accessibilityLabel={`Decrease ${label}`}
        >
          <Minus size={16} color={colors.ink} />
        </Pressable>
        <Pressable
          onPress={onPressValue}
          disabled={!onPressValue}
          hitSlop={6}
          className={`min-w-16 items-center rounded-lg px-1 py-1.5 ${onPressValue ? 'border border-dashed border-surface-border active:bg-surface-elevated' : ''}`}
          accessibilityLabel={onPressValue ? `${label}: ${format(value)}. Tap to type a value` : undefined}
        >
          <Text className="text-base font-bold tabular-nums text-ink">{format(value)}</Text>
        </Pressable>
        <Pressable
          onPress={() => change(value + step)}
          disabled={value >= max}
          className={`h-9 w-9 items-center justify-center rounded-lg bg-surface-elevated ${value >= max ? 'opacity-40' : ''}`}
          accessibilityLabel={`Increase ${label}`}
        >
          <Plus size={16} color={colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}
