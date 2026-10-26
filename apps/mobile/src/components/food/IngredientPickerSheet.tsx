import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X } from 'lucide-react-native';
import type { RecipeIngredient } from '@gym/shared';
import { searchLocalFoods, type LocalFoodHit } from '../../db/repositories/builtinFoods';
import { colors } from '../../theme';
import { FoodSearchRow } from './FoodSearchRow';
import { PortionSheet } from './PortionSheet';

const n0 = (v: number | null) => (v === null ? '–' : String(Math.round(v)));

/** Pick a recipe ingredient from your foods and the built-in list, then its raw amount. */
export function IngredientPickerSheet({ visible, onPick, onClose }: { visible: boolean; onPick: (ing: RecipeIngredient) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<LocalFoodHit[]>([]);
  const [chosen, setChosen] = useState<LocalFoodHit | null>(null);

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);
  useEffect(() => {
    if (query.trim() === '') setHits([]);
    else void searchLocalFoods(query).then(setHits);
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-row items-center gap-3 px-4 pt-3">
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <X size={24} color={colors.ink} />
          </Pressable>
          <Text className="text-xl font-bold text-ink">Add ingredient</Text>
        </View>
        <View className="mx-4 mt-3 flex-row items-center gap-2 rounded-xl bg-surface-elevated px-3">
          <Search size={18} color={colors.muted} />
          <TextInput value={query} onChangeText={setQuery} autoFocus placeholder="Search foods" placeholderTextColor={colors.faint} className="flex-1 py-3 text-base text-ink" />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 8, paddingBottom: 48 }}>
          {hits.map((h) => (
            <FoodSearchRow
              key={`${h.ref.kind}:${h.ref.id}`}
              title={h.brand ? `${h.name} (${h.brand})` : h.name}
              detail={`${n0(h.per100.kcal)} kcal · ${n0(h.per100.protein_g)} g protein per 100 ${h.basis}`}
              onPress={() => setChosen(h)}
            />
          ))}
        </ScrollView>
        <PortionSheet
          visible={chosen !== null}
          food={chosen ? { name: chosen.name, per100: chosen.per100, servings: chosen.servings, basis: chosen.basis } : null}
          defaultMeal="breakfast"
          mode="add"
          ingredient
          onSubmit={({ serving, servings }) => {
            if (!chosen) return;
            onPick({
              name: chosen.name,
              food_id: chosen.ref.kind === 'food' ? chosen.ref.id : null,
              builtin_food_id: chosen.ref.kind === 'builtin' ? chosen.ref.id : null,
              grams: serving.grams * servings,
              per100: chosen.per100,
            });
            onClose();
          }}
          onClose={() => setChosen(null)}
        />
      </SafeAreaView>
    </Modal>
  );
}
