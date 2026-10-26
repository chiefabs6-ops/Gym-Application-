import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { PlusCircle, ScanBarcode, Search, X, Zap } from 'lucide-react-native';
import { MEAL_LABELS, MEALS, toLocalDateKey, type Meal, type Serving } from '@gym/shared';
import { searchLocalFoods, type LocalFoodHit } from '../db/repositories/builtinFoods';
import {
  deleteEntry,
  frequentFoods,
  lastServing,
  logFood,
  logSavedMeal,
  quickAdd,
  recentFoodHit,
  recentFoods,
  savedMeals,
  type PortionFood,
  type RecentFood,
  type SavedMealSummary,
} from '../db/repositories/food';
import {
  BatchOverdrawError,
  deleteBatchEntry,
  finishBatch,
  logFromBatch,
  logRecipeOneOff,
  openBatches,
  searchRecipes,
  startBatch,
  undoStartBatch,
  type Leftover,
} from '../db/repositories/recipes';
import { searchProducts, type OffProduct } from '../services/openFoodFacts';
import { useFoodFormDraftStore } from '../state/foodFormDraftStore';
import { saveFailed, showToast } from '../state/toastStore';
import { colors } from '../theme';
import { ConfirmSheet, type ConfirmRequest } from '../components/ConfirmSheet';
import { Dropdown } from '../components/food/Dropdown';
import { FoodSearchRow, SectionTitle } from '../components/food/FoodSearchRow';
import { PortionSheet } from '../components/food/PortionSheet';
import { QuickAddSheet } from '../components/food/QuickAddSheet';
import { RecipeLogSheet, type RecipeLogChoice } from '../components/food/RecipeLogSheet';

const ONLINE_DELAY_MS = 1000;
const n0 = (v: number | null) => (v === null ? '–' : String(Math.round(v)));
const isMeal = (m: unknown): m is Meal => typeof m === 'string' && (MEALS as readonly string[]).includes(m);

type Portion =
  | { kind: 'food'; hit: LocalFoodHit; initial?: { serving: Serving; servings: number } }
  | { kind: 'leftover'; leftover: Leftover };

/** Add food (spec §5.2): recent / saved / leftovers / frequent before typing, then local + Open Food Facts search. */
export default function AddFoodScreen() {
  const params = useLocalSearchParams<{ meal?: string; date?: string }>();
  const [meal, setMeal] = useState<Meal>(isMeal(params.meal) ? params.meal : 'breakfast');
  const date = typeof params.date === 'string' ? params.date : toLocalDateKey(new Date());

  const [query, setQuery] = useState('');
  const [local, setLocal] = useState<LocalFoodHit[]>([]);
  const [recipes, setRecipes] = useState<{ id: string; name: string }[]>([]);
  const [online, setOnline] = useState<OffProduct[] | 'offline' | 'loading' | null>(null);
  const [recent, setRecent] = useState<RecentFood[]>([]);
  const [frequent, setFrequent] = useState<RecentFood[]>([]);
  const [saved, setSaved] = useState<SavedMealSummary[]>([]);
  const [leftovers, setLeftovers] = useState<Leftover[]>([]);
  const [portion, setPortion] = useState<Portion | null>(null);
  const [quick, setQuick] = useState(false);
  const [recipe, setRecipe] = useState<{ id: string; name: string } | null>(null);
  const [recipeError, setRecipeError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const onlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshLists = useCallback(() => {
    void recentFoods(meal, date).then(setRecent);
    void frequentFoods(date).then(setFrequent);
    void savedMeals().then(setSaved);
    void openBatches().then(setLeftovers);
  }, [meal, date]);
  useFocusEffect(refreshLists);

  // Local results on every keystroke; Open Food Facts after a 1-second pause or on submit (spec §5.2).
  useEffect(() => {
    const q = query.trim();
    if (onlineTimer.current) clearTimeout(onlineTimer.current);
    setOnline(null);
    if (q === '') {
      setLocal([]);
      setRecipes([]);
      return;
    }
    void searchLocalFoods(q).then(setLocal);
    void searchRecipes(q).then(setRecipes);
    if (q.length >= 2) onlineTimer.current = setTimeout(() => void runOnline(q), ONLINE_DELAY_MS);
    return () => {
      if (onlineTimer.current) clearTimeout(onlineTimer.current);
    };
  }, [query]);

  const runOnline = async (q: string) => {
    setOnline('loading');
    const r = await searchProducts(q);
    setOnline(r);
  };

  /** Toast with Undo. Batch portions undo through deleteBatchEntry so a finished batch reopens. */
  const added = (name: string, ids: string[], remove: (id: string) => Promise<void> = deleteEntry) => {
    refreshLists();
    showToast({ message: `Added ${name}`, actionLabel: 'Undo', onAction: () => void Promise.all(ids.map(remove)).then(refreshLists) });
  };

  const quickLog = async (ref: LocalFoodHit['ref'], name: string, per100: LocalFoodHit['per100'], servings: Serving[], basis: 'g' | 'ml') => {
    const last = await lastServing(ref);
    const amount = last ?? (servings[0] ? { serving: servings[0], servings: 1 } : { serving: { label: basis, grams: 1 }, servings: 100 });
    const id = await logFood({ ref, name, per100, serving: amount.serving, servings: amount.servings, meal, localDate: date });
    added(name, [id]);
  };

  const openOnline = (p: OffProduct) => {
    useFoodFormDraftStore.getState().set(
      { name: p.name, brand: p.brand, barcode: p.barcode || null, basis: p.basis, per100: p.per100, kcalKnown: p.kcalKnown, servings: p.serving ? [p.serving] : [], source: 'open_food_facts' },
      { meal, date },
    );
    router.push({ pathname: '/food/edit', params: { mode: 'check' } });
  };

  const logRecipe = async (choice: RecipeLogChoice) => {
    if (!recipe) return;
    try {
      if (choice.kind === 'oneoff') {
        const id = await logRecipeOneOff({ recipeId: recipe.id, cookedWeightG: choice.cookedWeightG, gramsEaten: choice.portionG, meal, localDate: date });
        added(recipe.name, [id]);
      } else {
        const { batchId, entryId } = await startBatch({ recipeId: recipe.id, cookedWeightG: choice.cookedWeightG, firstPortionG: choice.portionG, meal, localDate: date });
        added(recipe.name, [entryId], () => undoStartBatch(batchId, entryId));
      }
      setRecipe(null);
    } catch (e) {
      setRecipeError(e instanceof BatchOverdrawError ? e.message : 'Couldn’t save. Try again.');
    }
  };

  const portionFood: PortionFood | null =
    portion?.kind === 'food'
      ? { name: portion.hit.name, per100: portion.hit.per100, servings: portion.hit.servings, basis: portion.hit.basis }
      : portion?.kind === 'leftover'
        ? { name: portion.leftover.recipeName, per100: portion.leftover.per100, servings: [], basis: 'g' }
        : null;

  const typing = query.trim() !== '';

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 pt-3">
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Close">
          <X size={24} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Dropdown label="Meal" value={meal} options={MEALS} format={(m) => MEAL_LABELS[m]} onChange={setMeal} />
        </View>
      </View>

      <View className="mx-4 mt-3 flex-row items-center gap-2 rounded-xl bg-surface-elevated px-3">
        <Search size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => query.trim().length >= 1 && void runOnline(query.trim())}
          placeholder="Search foods or brands"
          placeholderTextColor={colors.faint}
          returnKeyType="search"
          className="flex-1 py-3 text-base text-ink"
          autoCorrect={false}
        />
        {typing && (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
            <X size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>

      <View className="mx-4 mt-3 flex-row gap-2">
        <Action icon={<ScanBarcode size={16} color={colors.ink} />} label="Scan barcode" onPress={() => router.push({ pathname: '/food/scan', params: { meal, date } })} />
        <Action icon={<Zap size={16} color={colors.ink} />} label="Quick add" onPress={() => setQuick(true)} />
        <Action
          icon={<PlusCircle size={16} color={colors.ink} />}
          label="Create food"
          onPress={() => {
            useFoodFormDraftStore.getState().set(null, { meal, date });
            router.push({ pathname: '/food/edit', params: { mode: 'new', name: query.trim() } });
          }}
        />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 140 }}>
        {!typing && (
          <>
            {leftovers.length > 0 && <SectionTitle title="Leftovers" />}
            {leftovers.map((l) => (
              <FoodSearchRow
                key={l.batchId}
                title={l.recipeName}
                detail={`${n0(l.remainingG)} g left · ${n0(((l.per100.protein_g ?? 0) * l.remainingG) / 100)} g protein`}
                onPress={() => setPortion({ kind: 'leftover', leftover: l })}
                onLongPress={() =>
                  setConfirm({
                    title: 'Mark batch finished?',
                    message: `${l.recipeName} (${n0(l.remainingG)} g left) will no longer show as a leftover.`,
                    confirmLabel: 'Mark finished',
                    onConfirm: () => void finishBatch(l.batchId).then(refreshLists),
                  })
                }
              />
            ))}
            {recent.length > 0 && <SectionTitle title={`Recent at ${MEAL_LABELS[meal].toLowerCase()}`} />}
            {recent.map((r) => (
              <RecentRow key={`${r.ref.kind}:${r.ref.id}`} food={r} onAdd={() => void logRecent(r).then((id) => added(r.name, [id])).catch(saveFailed)} onPress={() => void openRecent(r)} />
            ))}
            {saved.length > 0 && <SectionTitle title="Saved meals" />}
            {saved.map((m) => (
              <FoodSearchRow
                key={m.id}
                title={m.name}
                detail={`${m.items} ${m.items === 1 ? 'food' : 'foods'} · ${n0(m.kcal)} kcal · ${n0(m.protein_g)} g protein`}
                onPress={() => void logSavedMeal(m.id, meal, date).then((ids) => added(m.name, ids)).catch(saveFailed)}
                onAdd={() => void logSavedMeal(m.id, meal, date).then((ids) => added(m.name, ids)).catch(saveFailed)}
              />
            ))}
            {frequent.length > 0 && <SectionTitle title="Frequent" />}
            {frequent.map((r) => (
              <RecentRow key={`f-${r.ref.kind}:${r.ref.id}`} food={r} onAdd={() => void logRecent(r).then((id) => added(r.name, [id])).catch(saveFailed)} onPress={() => void openRecent(r)} />
            ))}
            {leftovers.length + recent.length + saved.length + frequent.length === 0 && (
              <Text className="px-4 pt-6 text-center text-ink-subtle">Search for a food to get started.</Text>
            )}
          </>
        )}

        {typing && (
          <>
            {recipes.length > 0 && <SectionTitle title="My recipes" />}
            {recipes.map((r) => (
              <FoodSearchRow
                key={r.id}
                title={r.name}
                detail="Recipe · one-off or batch"
                onPress={() => {
                  setRecipeError(null);
                  setRecipe(r);
                }}
              />
            ))}
            {local.length > 0 && <SectionTitle title="Foods" />}
            {local.map((h) => (
              <FoodSearchRow
                key={`${h.ref.kind}:${h.ref.id}`}
                title={h.brand ? `${h.name} (${h.brand})` : h.name}
                detail={`${n0(h.per100.kcal)} kcal · ${n0(h.per100.protein_g)} g protein per 100 ${h.basis}${h.ref.kind === 'food' ? ' · My food' : ''}`}
                onPress={() => void lastServing(h.ref).then((last) => setPortion({ kind: 'food', hit: h, initial: last ?? undefined }))}
                onAdd={() => void quickLog(h.ref, h.name, h.per100, h.servings, h.basis).catch(saveFailed)}
              />
            ))}
            <SectionTitle title="Online (Open Food Facts)" />
            {online === 'loading' && <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} />}
            {online === 'offline' && <Text className="px-4 py-2 text-sm text-ink-subtle">Online results need internet.</Text>}
            {online === null && <Text className="px-4 py-2 text-sm text-ink-subtle">Press search to look online.</Text>}
            {Array.isArray(online) && online.length === 0 && <Text className="px-4 py-2 text-sm text-ink-subtle">No online results.</Text>}
            {Array.isArray(online) &&
              online.map((p, i) => (
                <FoodSearchRow
                  key={`${p.barcode}-${i}`}
                  title={p.brand ? `${p.name} (${p.brand})` : p.name}
                  detail={p.complete ? `${n0(p.per100.kcal)} kcal · ${n0(p.per100.protein_g)} g protein per 100 ${p.basis}` : 'Incomplete — check the details'}
                  onPress={() => openOnline(p)}
                />
              ))}
          </>
        )}
      </ScrollView>

      <PortionSheet
        visible={portion !== null}
        food={portionFood}
        initial={
          portion?.kind === 'food' && portion.initial
            ? { ...portion.initial, meal }
            : portion?.kind === 'leftover'
              ? { serving: { label: 'g', grams: 1 }, servings: Math.floor(portion.leftover.remainingG * 10) / 10, meal }
              : undefined
        }
        defaultMeal={meal}
        mode="add"
        gramsOnly={portion?.kind === 'leftover'}
        maxGrams={portion?.kind === 'leftover' ? portion.leftover.remainingG : undefined}
        onSubmit={({ serving, servings, meal: m }) => {
          const save = async () => {
            if (portion?.kind === 'food') {
              const id = await logFood({ ref: portion.hit.ref, name: portion.hit.name, per100: portion.hit.per100, serving, servings, meal: m, localDate: date });
              added(portion.hit.name, [id]);
            } else if (portion?.kind === 'leftover') {
              const id = await logFromBatch({ batchId: portion.leftover.batchId, grams: serving.grams * servings, meal: m, localDate: date });
              added(portion.leftover.recipeName, [id], deleteBatchEntry);
            }
          };
          void save().catch(saveFailed);
        }}
        onClose={() => setPortion(null)}
      />

      <QuickAddSheet
        visible={quick}
        defaultMeal={meal}
        onSubmit={(v) => void quickAdd({ ...v, localDate: date }).then((id) => added(v.name ?? 'Quick add', [id])).catch(saveFailed)}
        onClose={() => setQuick(false)}
      />

      <RecipeLogSheet visible={recipe !== null} recipeName={recipe?.name ?? ''} meal={meal} error={recipeError} onSubmit={(c) => void logRecipe(c)} onClose={() => setRecipe(null)} />

      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
    </SafeAreaView>
  );

  async function logRecent(r: RecentFood): Promise<string> {
    const hit = await recentFoodHit(r);
    return logFood({ ref: r.ref, name: r.name, per100: hit.per100, serving: r.serving, servings: r.servings, meal, localDate: date });
  }

  async function openRecent(r: RecentFood) {
    setPortion({ kind: 'food', hit: await recentFoodHit(r), initial: { serving: r.serving, servings: r.servings } });
  }
}

function RecentRow({ food, onAdd, onPress }: { food: RecentFood; onAdd: () => void; onPress: () => void }) {
  const amount = food.servings === 1 ? food.serving.label : `${Number(food.servings.toFixed(2))} × ${food.serving.label}`;
  return <FoodSearchRow title={food.name} detail={`${amount} · ${n0(food.kcal)} kcal · ${n0(food.protein_g)} g protein`} onPress={onPress} onAdd={onAdd} />;
}

function Action({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-1 items-center gap-1 rounded-xl border border-surface-border bg-surface-raised py-2 active:opacity-70">
      {icon}
      <Text className="text-[11px] font-semibold text-ink">{label}</Text>
    </Pressable>
  );
}

