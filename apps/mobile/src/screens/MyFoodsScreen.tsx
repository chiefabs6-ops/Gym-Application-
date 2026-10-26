import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Check, ChevronLeft, Plus, Trash2 } from 'lucide-react-native';
import { getRecord } from '../db/mutate';
import { useLiveQuery } from '../db/useLiveQuery';
import { archiveFood, deleteSavedMeal, updateSavedMeal } from '../db/repositories/food';
import { archiveRecipe } from '../db/repositories/recipes';
import { colors } from '../theme';
import { BottomSheet } from '../components/BottomSheet';
import { ConfirmSheet, type ConfirmRequest } from '../components/ConfirmSheet';
import { SegmentedControl } from '../components/SegmentedControl';

type Tab = 'foods' | 'meals' | 'recipes';
const n0 = (v: number | null) => (v === null ? '–' : String(Math.round(v)));

/** My foods (spec §5.5b): view, edit and delete your own foods, saved meals and recipes. */
export default function MyFoodsScreen() {
  const [tab, setTab] = useState<Tab>('foods');
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [editingMeal, setEditingMeal] = useState<string | null>(null);

  const { data: foods } = useLiveQuery<{ id: string; name: string; brand: string | null; kcal: number; protein_g: number | null; basis: string }>(
    `SELECT id, name, brand, kcal, protein_g, basis FROM foods WHERE deleted_at IS NULL AND archived_at IS NULL ORDER BY name COLLATE NOCASE`,
    [],
    ['foods'],
  );
  const { data: meals } = useLiveQuery<{ id: string; name: string; items: string }>(
    `SELECT id, name, items FROM saved_meals WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE`,
    [],
    ['saved_meals'],
  );
  const { data: recipes } = useLiveQuery<{ id: string; name: string; ingredients: string }>(
    `SELECT id, name, ingredients FROM recipes WHERE deleted_at IS NULL AND archived_at IS NULL ORDER BY name COLLATE NOCASE`,
    [],
    ['recipes'],
  );

  const ask = (title: string, onConfirm: () => void) =>
    setConfirm({ title, message: 'Days you already logged keep their entries.', confirmLabel: 'Delete', tone: 'destructive', onConfirm });

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 pt-3">
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
          <ChevronLeft size={24} color={colors.ink} />
        </Pressable>
        <Text className="text-xl font-bold text-ink">My foods</Text>
      </View>
      <SegmentedControl
        value={tab}
        options={[
          { value: 'foods', label: 'Foods' },
          { value: 'meals', label: 'Meals' },
          { value: 'recipes', label: 'Recipes' },
        ]}
        onChange={setTab}
        className="mx-4 my-3"
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        {tab === 'foods' &&
          (foods.length === 0 ? (
            <Empty text="Foods you create, scan or save from search show up here." />
          ) : (
            foods.map((f) => (
              <Row
                key={f.id}
                title={f.brand ? `${f.name} (${f.brand})` : f.name}
                detail={`${n0(f.kcal)} kcal · ${n0(f.protein_g)} g protein per 100 ${f.basis}`}
                onPress={() => router.push({ pathname: '/food/edit', params: { mode: 'edit', foodId: f.id } })}
                onDelete={() => ask(`Delete ${f.name}?`, () => void archiveFood(f.id))}
              />
            ))
          ))}
        {tab === 'meals' &&
          (meals.length === 0 ? (
            <Empty text="Save a logged meal from its ⋯ menu in the diary." />
          ) : (
            meals.map((m) => (
              <Row
                key={m.id}
                title={m.name}
                detail={`${(JSON.parse(m.items) as unknown[]).length} foods`}
                onPress={() => setEditingMeal(m.id)}
                onDelete={() => ask(`Delete ${m.name}?`, () => void deleteSavedMeal(m.id))}
              />
            ))
          ))}
        {tab === 'recipes' && (
          <>
            <Pressable onPress={() => router.push('/food/recipe/new')} className="mx-4 mb-2 h-12 flex-row items-center justify-center gap-2 rounded-xl bg-accent active:opacity-80">
              <Plus size={18} color={colors.bg} />
              <Text className="font-bold text-surface">New recipe</Text>
            </Pressable>
            {recipes.length === 0 && <Empty text="Recipes you create show up here." />}
            {recipes.map((r) => (
              <Row
                key={r.id}
                title={r.name}
                detail={`${(JSON.parse(r.ingredients) as unknown[]).length} ingredients`}
                onPress={() => router.push(`/food/recipe/${r.id}`)}
                onDelete={() => ask(`Delete ${r.name}?`, () => void archiveRecipe(r.id))}
              />
            ))}
          </>
        )}
      </ScrollView>
      <MealEditSheet mealId={editingMeal} onClose={() => setEditingMeal(null)} />
      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
    </SafeAreaView>
  );
}

function Row({ title, detail, onPress, onDelete }: { title: string; detail: string; onPress: () => void; onDelete: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 border-t border-surface-border px-4 py-3 active:bg-surface-elevated">
      <View className="flex-1">
        <Text className="text-ink" numberOfLines={2}>
          {title}
        </Text>
        <Text className="text-xs text-ink-subtle">{detail}</Text>
      </View>
      <Pressable onPress={onDelete} hitSlop={10} accessibilityLabel={`Delete ${title}`}>
        <Trash2 size={18} color={colors.subtle} />
      </Pressable>
    </Pressable>
  );
}

function Empty({ text }: { text: string }) {
  return <Text className="px-4 pt-6 text-center text-ink-subtle">{text}</Text>;
}

/** Rename a saved meal and untick foods to remove. */
function MealEditSheet({ mealId, onClose }: { mealId: string | null; onClose: () => void }) {
  const [name, setName] = useState('');
  const [items, setItems] = useState<string[]>([]);
  const [keep, setKeep] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (!mealId) return;
    void getRecord('saved_meals', mealId).then((m) => {
      if (!m || m.deleted_at !== null) return;
      setName(m.name);
      setItems(m.items.map((i) => `${i.name} · ${i.servings === 1 ? i.serving_label : `${i.servings} × ${i.serving_label}`}`));
      setKeep(new Set(m.items.map((_, i) => i)));
    });
  }, [mealId]);
  const invalid = name.trim() === '' || keep.size === 0;
  return (
    <BottomSheet visible={mealId !== null} onClose={onClose} avoidKeyboard className="px-5 pb-8 pt-3">
      <View className="mb-4 h-1 w-10 self-center rounded-full bg-surface-border" />
      <View className="gap-4">
        <Text className="text-xl font-bold text-ink">Edit meal</Text>
        <TextInput value={name} onChangeText={setName} maxLength={120} className="rounded-xl bg-surface-elevated px-3 py-3 text-base text-ink" accessibilityLabel="Meal name" />
        <View className="overflow-hidden rounded-xl bg-surface-elevated">
          {items.map((label, i) => {
            const on = keep.has(i);
            return (
              <Pressable
                key={i}
                onPress={() =>
                  setKeep((s) => {
                    const next = new Set(s);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    return next;
                  })
                }
                className={`flex-row items-center gap-3 px-3 py-3 ${i > 0 ? 'border-t border-surface-border' : ''}`}
              >
                <View className={`h-5 w-5 items-center justify-center rounded ${on ? 'bg-accent' : 'border border-ink-faint'}`}>{on && <Check size={14} color={colors.bg} />}</View>
                <Text className="flex-1 text-ink" numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          disabled={invalid}
          onPress={() => {
            if (mealId) void updateSavedMeal(mealId, { name, keepItems: [...keep] });
            onClose();
          }}
          className={`h-14 items-center justify-center rounded-xl bg-accent ${invalid ? 'opacity-40' : 'active:opacity-80'}`}
        >
          <Text className="text-base font-bold text-surface">Save</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
