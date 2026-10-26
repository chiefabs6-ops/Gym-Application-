import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { router, useLocalSearchParams } from 'expo-router';
import { Plus, Trash2, X } from 'lucide-react-native';
import { scaleNutrients, sumNutrients, type RecipeIngredient } from '@gym/shared';
import { getRecord } from '../db/mutate';
import { createRecipe, updateRecipe } from '../db/repositories/recipes';
import { colors } from '../theme';
import { IngredientPickerSheet } from '../components/food/IngredientPickerSheet';

const n0 = (v: number) => String(Math.round(v));

/**
 * Create / edit a recipe (spec §7.2): a name and raw ingredients with amounts. The cooked weight is asked each time
 * the recipe is cooked ("one-off or batch"), so it isn't stored here. Edits never change past diary entries.
 */
export default function RecipeEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (isNew) return;
    void getRecord('recipes', id).then((r) => {
      if (!r) return;
      setName(r.name);
      setIngredients(r.ingredients);
    });
  }, [id, isNew]);

  const totals = sumNutrients(ingredients.map((i) => scaleNutrients(i.per100, i.grams)));
  const rawWeight = ingredients.reduce((s, i) => s + i.grams, 0);
  const invalid = name.trim() === '' || ingredients.length === 0;

  const save = async () => {
    if (isNew) await createRecipe(name, ingredients);
    else await updateRecipe(id, { name: name.trim().slice(0, 120), ingredients });
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 pt-3">
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Close">
          <X size={24} color={colors.ink} />
        </Pressable>
        <Text className="text-xl font-bold text-ink">{isNew ? 'New recipe' : 'Edit recipe'}</Text>
      </View>
      <KeyboardAwareScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 48 }} bottomOffset={24}>
        <View className="gap-1">
          <Text className="text-xs text-ink-muted">Name</Text>
          <TextInput value={name} onChangeText={setName} maxLength={120} placeholder="e.g. Chilli" placeholderTextColor={colors.faint} className="rounded-xl bg-surface-elevated px-3 py-3 text-base text-ink" />
        </View>

        <View className="rounded-card bg-surface-raised">
          <Text className="px-4 pb-2 pt-3 font-semibold text-ink">Ingredients (raw)</Text>
          {ingredients.map((ing, i) => {
            const n = scaleNutrients(ing.per100, ing.grams);
            return (
              <View key={i} className="flex-row items-center gap-3 border-t border-surface-border px-4 py-3">
                <View className="flex-1">
                  <Text className="text-ink" numberOfLines={1}>
                    {ing.name}
                  </Text>
                  <Text className="text-xs text-ink-subtle">
                    {n0(ing.grams)} g · {n0(n.kcal)} kcal · {n0(n.protein_g ?? 0)} g protein
                  </Text>
                </View>
                <Pressable onPress={() => setIngredients((list) => list.filter((_, j) => j !== i))} hitSlop={10} accessibilityLabel={`Remove ${ing.name}`}>
                  <Trash2 size={18} color={colors.subtle} />
                </Pressable>
              </View>
            );
          })}
          <Pressable onPress={() => setPicking(true)} className="flex-row items-center gap-2 border-t border-surface-border px-4 py-3 active:bg-surface-elevated">
            <Plus size={16} color={colors.accent} />
            <Text className="font-semibold text-accent">Add ingredient</Text>
          </Pressable>
        </View>

        {ingredients.length > 0 && (
          <View className="gap-1 rounded-card bg-surface-raised p-4">
            <Text className="text-xs text-ink-muted">Whole recipe ({n0(rawWeight)} g raw)</Text>
            <Text className="text-lg font-bold tabular-nums text-ink">{n0(totals.kcal)} kcal</Text>
            <Text className="text-sm tabular-nums text-ink-subtle">
              P {n0(totals.protein_g)} g · C {n0(totals.carbs_g)} g · F {n0(totals.fat_g)} g
            </Text>
            <Text className="mt-1 text-xs text-ink-subtle">When you cook it, you’ll enter the cooked weight so each gram is counted right.</Text>
          </View>
        )}

        <Pressable disabled={invalid} onPress={() => void save()} className={`h-14 items-center justify-center rounded-xl bg-accent ${invalid ? 'opacity-40' : 'active:opacity-80'}`}>
          <Text className="text-base font-bold text-surface">Save recipe</Text>
        </Pressable>
      </KeyboardAwareScrollView>
      <IngredientPickerSheet visible={picking} onPick={(ing) => setIngredients((list) => [...list, ing])} onClose={() => setPicking(false)} />
    </SafeAreaView>
  );
}
