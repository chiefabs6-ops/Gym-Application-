import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { MEAL_LABELS, parseDecimal, type Meal } from '@gym/shared';
import { colors } from '../../theme';
import { BottomSheet } from '../BottomSheet';
import { SegmentedControl } from '../SegmentedControl';

export type RecipeLogChoice = { kind: 'oneoff' | 'batch'; cookedWeightG: number; portionG: number };

/**
 * Adding a recipe to a meal (spec §7.2): one-off (cooked weight + grams eaten, nothing tracked) or batch
 * (cooked weight + first portion; the rest becomes a leftover).
 */
export function RecipeLogSheet({
  visible,
  recipeName,
  meal,
  error,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  recipeName: string;
  meal: Meal;
  error: string | null;
  onSubmit: (choice: RecipeLogChoice) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<'oneoff' | 'batch'>('batch');
  const [cooked, setCooked] = useState('');
  const [portion, setPortion] = useState('');
  useEffect(() => {
    if (!visible) return;
    setCooked('');
    setPortion('');
  }, [visible]);

  const c = parseDecimal(cooked);
  const p = parseDecimal(portion);
  const tooMuch = c !== null && p !== null && p > c;
  const invalid = !c || !p || tooMuch;

  return (
    <BottomSheet visible={visible} onClose={onClose} avoidKeyboard className="px-5 pb-8 pt-3">
      <View className="mb-4 h-1 w-10 self-center rounded-full bg-surface-border" />
      <View className="gap-4">
        <Text className="text-xl font-bold text-ink" numberOfLines={2}>
          {recipeName}
        </Text>
        <SegmentedControl
          value={kind}
          options={[
            { value: 'oneoff', label: 'One-off' },
            { value: 'batch', label: 'Batch' },
          ]}
          onChange={setKind}
        />
        <Text className="text-xs text-ink-subtle">
          {kind === 'batch'
            ? 'Weigh the whole cooked dish. What you don’t eat now shows up as a leftover next time you add food.'
            : 'Weigh the whole cooked dish and your plate. Nothing is tracked afterwards.'}
        </Text>
        <View className="flex-row gap-3">
          <Field label="Cooked weight (g)" value={cooked} onChange={setCooked} />
          <Field label={kind === 'batch' ? 'Eating now (g)' : 'Eaten (g)'} value={portion} onChange={setPortion} />
        </View>
        {(tooMuch || error) && <Text className="text-xs text-settype-failure">{tooMuch ? 'You can’t eat more than the cooked weight.' : error}</Text>}
        <Pressable
          disabled={invalid}
          onPress={() => c && p && onSubmit({ kind, cookedWeightG: c, portionG: p })}
          className={`h-14 items-center justify-center rounded-xl bg-accent ${invalid ? 'opacity-40' : 'active:opacity-80'}`}
        >
          <Text className="text-base font-bold text-surface">Add to {MEAL_LABELS[meal]}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (t: string) => void }) {
  return (
    <View className="flex-1 gap-1">
      <Text className="text-xs text-ink-muted">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholderTextColor={colors.faint}
        className="rounded-xl bg-surface-elevated px-3 py-3 text-base tabular-nums text-ink"
        accessibilityLabel={label}
      />
    </View>
  );
}
