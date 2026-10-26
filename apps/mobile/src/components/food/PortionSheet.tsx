import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { MEAL_LABELS, MEALS, parseDecimal, scaleNutrients, servingOptions, type Meal, type Serving } from '@gym/shared';
import { useSettingsStore } from '../../state/settingsStore';
import { colors } from '../../theme';
import type { PortionFood } from '../../db/repositories/food';
import { BottomSheet } from '../BottomSheet';
import { Dropdown } from './Dropdown';

interface Props {
  visible: boolean;
  food: PortionFood | null;
  initial?: { serving: Serving; servings: number; meal: Meal };
  defaultMeal: Meal;
  mode: 'add' | 'edit';
  /** Batch leftovers: amounts above this many grams are refused. */
  maxGrams?: number;
  /** Batch / recipe entries are logged in grams only. */
  gramsOnly?: boolean;
  /** Recipe ingredients: no meal to choose, button says "Add ingredient". */
  ingredient?: boolean;
  onSubmit: (p: { serving: Serving; servings: number; meal: Meal }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const fmt = (n: number | null, decimals = 0) => (n === null ? '–' : n.toFixed(decimals).replace(/\.0+$/, ''));
const servingText = (s: Serving) => (s.grams === 1 || s.label === 'oz' ? s.label : `${s.label} (${fmt(s.grams, 1)} g)`);

/**
 * MyFitnessPal-style portion screen (spec §5.3): serving size dropdown, number of servings, meal, live calories
 * and macros. Also the edit screen for a logged entry (with Delete).
 */
export function PortionSheet({ visible, food, initial, defaultMeal, mode, maxGrams, gramsOnly, ingredient, onSubmit, onDelete, onClose }: Props) {
  const unit = useSettingsStore((s) => s.unit);
  const options = useMemo(
    () => (food ? (gramsOnly ? [{ label: food.basis, grams: 1 }] : servingOptions(food.servings, food.basis, unit)) : []),
    [food, gramsOnly, unit],
  );
  const [serving, setServing] = useState<Serving>({ label: 'g', grams: 1 });
  const [amount, setAmount] = useState('1');
  const [meal, setMeal] = useState<Meal>(defaultMeal);

  // Each opening starts from the entry's amount, else the food's first serving, else 100 g. Only on opening: the
  // parent re-rendering (e.g. online results arriving) must not reset what the user typed.
  const wasOpen = useRef(false);
  useEffect(() => {
    const open = visible && food !== null;
    const opening = open && !wasOpen.current;
    wasOpen.current = open;
    if (!opening || !food) return;
    const first = options[0] ?? { label: food.basis, grams: 1 };
    const start = initial?.serving ?? first;
    const match = options.find((o) => o.label === start.label && Math.abs(o.grams - start.grams) < 0.01);
    setServing(match ?? start);
    setAmount(initial ? String(Number(initial.servings.toFixed(2))) : start.grams === 1 ? '100' : '1');
    setMeal(initial?.meal ?? defaultMeal);
  }, [visible, food, initial, options, defaultMeal]);

  const servings = parseDecimal(amount);
  const grams = servings !== null ? servings * serving.grams : 0;
  const values = food ? scaleNutrients(food.per100, grams) : null;
  const overdrawn = maxGrams !== undefined && grams > maxGrams + 1e-6;
  const invalid = servings === null || servings <= 0 || grams > 50_000 || overdrawn;
  const allOptions = options.some((o) => o.label === serving.label && o.grams === serving.grams) ? options : [serving, ...options];

  return (
    <BottomSheet visible={visible} onClose={onClose} avoidKeyboard className="px-5 pb-8 pt-3">
      <View className="mb-4 h-1 w-10 self-center rounded-full bg-surface-border" />
      {food && values && (
        <View className="gap-4">
          <Text className="text-xl font-bold text-ink" numberOfLines={2}>
            {food.name}
          </Text>
          <View className="items-center rounded-card bg-surface-elevated p-4">
            <Text className="text-3xl font-bold tabular-nums text-ink">{fmt(values.kcal)} kcal</Text>
            <View className="mt-1 flex-row gap-5">
              <Text className="text-sm tabular-nums text-macro-protein">P {fmt(values.protein_g, 1)} g</Text>
              <Text className="text-sm tabular-nums text-macro-carbs">C {fmt(values.carbs_g, 1)} g</Text>
              <Text className="text-sm tabular-nums text-macro-fat">F {fmt(values.fat_g, 1)} g</Text>
            </View>
          </View>

          <Dropdown label="Serving size" value={serving} options={allOptions} format={servingText} onChange={setServing} />

          <View className="gap-1">
            <Text className="text-xs text-ink-muted">{serving.grams === 1 || serving.label === 'oz' ? `Amount (${serving.label})` : 'Number of servings'}</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              selectTextOnFocus
              className={`rounded-xl bg-surface-elevated px-3 py-3 text-base tabular-nums text-ink ${invalid && amount !== '' ? 'border border-settype-failure' : ''}`}
              placeholderTextColor={colors.faint}
              accessibilityLabel="Amount"
            />
            {overdrawn && <Text className="text-xs text-settype-failure">Only {fmt(maxGrams ?? 0)} g left in this batch</Text>}
          </View>

          {!ingredient && <Dropdown label="Meal" value={meal} options={MEALS} format={(m) => MEAL_LABELS[m]} onChange={setMeal} />}

          <Pressable
            disabled={invalid}
            onPress={() => {
              if (servings === null) return;
              onSubmit({ serving, servings, meal });
              onClose();
            }}
            className={`h-14 items-center justify-center rounded-xl bg-accent ${invalid ? 'opacity-40' : 'active:opacity-80'}`}
          >
            <Text className="text-base font-bold text-surface">{ingredient ? (mode === 'add' ? 'Add ingredient' : 'Save') : mode === 'add' ? `Add to ${MEAL_LABELS[meal]}` : 'Save'}</Text>
          </Pressable>
          {mode === 'edit' && onDelete && (
            <Pressable onPress={onDelete} className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-surface-elevated active:opacity-80">
              <Trash2 size={16} color={colors.danger} />
              <Text className="font-semibold text-settype-failure">Delete</Text>
            </Pressable>
          )}
        </View>
      )}
    </BottomSheet>
  );
}
