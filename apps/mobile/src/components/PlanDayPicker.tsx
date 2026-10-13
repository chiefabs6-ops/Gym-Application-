import { Pressable, ScrollView, Text } from 'react-native';
import { CalendarDays } from 'lucide-react-native';
import { useSettingsStore } from '../state/settingsStore';
import { colors } from '../theme';

/** "Which plan day is this?" chips: No day + one per day of the training plan. Hidden with no plan. */
export function PlanDayPicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const plan = useSettingsStore((s) => s.training_plan);
  if (!plan) return null;
  const options = [{ id: null as string | null, name: 'No day' }, ...plan.days];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: 8, alignItems: 'center' }}
    >
      <CalendarDays size={16} color={colors.subtle} />
      {options.map((d) => {
        const active = value === d.id;
        return (
          <Pressable
            key={d.id ?? 'none'}
            onPress={() => onChange(d.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={`rounded-full border px-3 py-1.5 ${active ? 'border-accent bg-accent-soft' : 'border-surface-border bg-surface-raised'}`}
          >
            <Text className={`text-sm ${active ? 'font-semibold text-accent' : 'text-ink-muted'}`}>{d.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
