import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { MEAL_LABELS, MEALS, parseDecimal, type Meal } from '@gym/shared';
import { colors } from '../../theme';
import { BottomSheet } from '../BottomSheet';
import { Dropdown } from './Dropdown';

export interface QuickAddValues {
  kcal: number;
  protein_g: number;
  name: string | null;
  meal: Meal;
}

/** Quick add (spec §5.4): calories and protein required, name optional. Not saved as a reusable food. */
export function QuickAddSheet({
  visible,
  initial,
  defaultMeal,
  onSubmit,
  onDelete,
  onClose,
}: {
  visible: boolean;
  initial?: QuickAddValues;
  defaultMeal: Meal;
  onSubmit: (v: QuickAddValues) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [name, setName] = useState('');
  const [meal, setMeal] = useState<Meal>(defaultMeal);

  useEffect(() => {
    if (!visible) return;
    setKcal(initial ? String(initial.kcal) : '');
    setProtein(initial ? String(initial.protein_g) : '');
    setName(initial?.name && initial.name !== 'Quick add' ? initial.name : '');
    setMeal(initial?.meal ?? defaultMeal);
  }, [visible, initial, defaultMeal]);

  const k = parseDecimal(kcal);
  const p = parseDecimal(protein);
  const invalid = k === null || p === null || k > 10_000 || p > 1000;

  return (
    <BottomSheet visible={visible} onClose={onClose} avoidKeyboard className="px-5 pb-8 pt-3">
      <View className="mb-4 h-1 w-10 self-center rounded-full bg-surface-border" />
      <View className="gap-4">
        <Text className="text-xl font-bold text-ink">{initial ? 'Edit quick add' : 'Quick add'}</Text>
        <View className="flex-row gap-3">
          <Field label="Calories (kcal)" value={kcal} onChange={setKcal} numeric />
          <Field label="Protein (g)" value={protein} onChange={setProtein} numeric />
        </View>
        <Field label="Name (optional)" value={name} onChange={setName} placeholder="e.g. Restaurant burrito" />
        <Dropdown label="Meal" value={meal} options={MEALS} format={(m) => MEAL_LABELS[m]} onChange={setMeal} />
        <Pressable
          disabled={invalid}
          onPress={() => {
            if (k === null || p === null) return;
            onSubmit({ kcal: k, protein_g: p, name: name.trim() || null, meal });
            onClose();
          }}
          className={`h-14 items-center justify-center rounded-xl bg-accent ${invalid ? 'opacity-40' : 'active:opacity-80'}`}
        >
          <Text className="text-base font-bold text-surface">{initial ? 'Save' : `Add to ${MEAL_LABELS[meal]}`}</Text>
        </Pressable>
        {initial && onDelete && (
          <Pressable onPress={onDelete} className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-surface-elevated active:opacity-80">
            <Trash2 size={16} color={colors.danger} />
            <Text className="font-semibold text-settype-failure">Delete</Text>
          </Pressable>
        )}
      </View>
    </BottomSheet>
  );
}

function Field({ label, value, onChange, numeric, placeholder }: { label: string; value: string; onChange: (t: string) => void; numeric?: boolean; placeholder?: string }) {
  return (
    <View className="flex-1 gap-1">
      <Text className="text-xs text-ink-muted">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        maxLength={numeric ? 8 : 120}
        className="rounded-xl bg-surface-elevated px-3 py-3 text-base text-ink"
        accessibilityLabel={label}
      />
    </View>
  );
}
