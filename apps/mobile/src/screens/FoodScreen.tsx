import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { BookOpen, ChevronLeft, ChevronRight, MoreHorizontal, Plus } from 'lucide-react-native';
import {
  MEAL_LABELS,
  MEALS,
  addDaysToKey,
  foodAmountLabel,
  isLateNight,
  sumNutrients,
  toDisplayFoodAmount,
  toLocalDateKey,
  type FoodLogEntryRow,
  type Meal,
} from '@gym/shared';
import { useLiveQuery } from '../db/useLiveQuery';
import { copyEntries, deleteEntry, editableEntry, saveMeal, updateEntry, updateQuickAdd, type EditableEntry } from '../db/repositories/food';
import { deleteBatchEntry, updateBatchEntryGrams } from '../db/repositories/recipes';
import { acceptRecalcPrompt, getTargetsForDate, markPrompted, shouldPromptRecalc } from '../db/repositories/body';
import { useFoodUiStore } from '../state/foodUiStore';
import { useSettingsStore } from '../state/settingsStore';
import { saveFailed, showToast } from '../state/toastStore';
import { colors } from '../theme';
import { ConfirmSheet, type ConfirmRequest } from '../components/ConfirmSheet';
import { SegmentedControl } from '../components/SegmentedControl';
import { ChoiceSheet } from '../components/food/ChoiceSheet';
import { DatePickerSheet } from '../components/food/DatePickerSheet';
import { DiarySummaryCard } from '../components/food/DiarySummaryCard';
import { CopyEntriesSheet, SaveMealSheet, type PickableEntry } from '../components/food/EntryPickerSheets';
import { PortionSheet } from '../components/food/PortionSheet';
import { QuickAddSheet } from '../components/food/QuickAddSheet';
import { formatDayKey } from '../components/food/dayLabel';

const n0 = (v: number | null) => (v === null ? '–' : String(Math.round(v)));

/** Food tab (spec §5.1): date row, summary card, meal tabs, the selected meal's entries. */
export default function FoodScreen() {
  const unit = useSettingsStore((s) => s.unit);
  const nutrition = useSettingsStore((s) => s.nutrition); // re-render when targets change
  const meal = useFoodUiStore((s) => s.lastMeal);
  const setMeal = useFoodUiStore((s) => s.setLastMeal);
  const setLateNightChoice = useFoodUiStore((s) => s.setLateNightChoice);

  const [date, setDate] = useState(() => toLocalDateKey(new Date()));
  const [picking, setPicking] = useState(false);
  const [askLateNight, setAskLateNight] = useState(false);
  const [askRecalc, setAskRecalc] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copy, setCopy] = useState<null | 'meal' | 'items'>(null);
  const [savingMeal, setSavingMeal] = useState(false);
  const [editing, setEditing] = useState<EditableEntry | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  // 00:00–02:59: ask once per visit whether this visit logs to yesterday or today (spec §5.7). The answer holds while
  // adding food (add / scan / form screens) and is cleared when the app goes to the background or the window ends.
  useFocusEffect(
    useCallback(() => {
      const ui = useFoodUiStore.getState();
      if (!isLateNight(new Date())) {
        if (ui.lateNightChoice !== null) {
          ui.setLateNightChoice(null);
          setDate(toLocalDateKey(new Date()));
        }
        void shouldPromptRecalc(new Date()).then(setAskRecalc);
      } else if (ui.lateNightChoice === null) setAskLateNight(true);
    }, []),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') useFoodUiStore.getState().setLateNightChoice(null);
    });
    return () => sub.remove();
  }, []);

  const { data: entries } = useLiveQuery<FoodLogEntryRow>(
    `SELECT * FROM food_log_entries WHERE local_date = ? AND deleted_at IS NULL ORDER BY logged_at, rowid`,
    [date],
    ['food_log_entries'],
  );
  const totals = useMemo(() => sumNutrients(entries), [entries]);
  const byMeal = useMemo(() => {
    const m = new Map<Meal, FoodLogEntryRow[]>(MEALS.map((k) => [k, []]));
    for (const e of entries) m.get(e.meal)!.push(e);
    return m;
  }, [entries]);
  const mealEntries = useMemo(() => byMeal.get(meal) ?? [], [byMeal, meal]);
  const mealTotals = sumNutrients(mealEntries);
  const targets = getTargetsForDate(date);
  const pickable: PickableEntry[] = useMemo(
    () => mealEntries.map((e) => ({ id: e.id, name: e.name, saveable: e.kind === 'food' || e.kind === 'builtin' })),
    [mealEntries],
  );

  const amountText = (e: FoodLogEntryRow) => {
    if (e.kind === 'quick' || e.grams === null || e.servings === null) return 'Quick add';
    if (e.serving_label === 'g' || e.serving_label === 'ml') {
      const value = e.serving_label === 'g' ? toDisplayFoodAmount(e.grams, unit) : e.grams;
      return `${Number(value.toFixed(1))} ${e.serving_label === 'g' ? foodAmountLabel(unit) : 'ml'}`;
    }
    return e.servings === 1 ? e.serving_label! : `${Number(e.servings.toFixed(2))} × ${e.serving_label}`;
  };

  const askDelete = (e: FoodLogEntryRow) =>
    setConfirm({
      title: `Delete ${e.name}?`,
      message: 'It will be removed from this day.',
      confirmLabel: 'Delete',
      tone: 'destructive',
      onConfirm: () => {
        setEditing(null);
        void (e.batch_id ? deleteBatchEntry(e.id) : deleteEntry(e.id)).catch(saveFailed);
      },
    });

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 pt-4">
        <Text className="text-2xl font-bold text-ink">Food</Text>
        <Pressable onPress={() => router.push('/food/my-foods')} className="flex-row items-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 active:opacity-70">
          <BookOpen size={16} color={colors.ink} />
          <Text className="text-sm font-semibold text-ink">My foods</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}>
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => setDate(addDaysToKey(date, -1))} hitSlop={10} className="p-1" accessibilityLabel="Previous day">
            <ChevronLeft size={22} color={colors.ink} />
          </Pressable>
          <Pressable onPress={() => setPicking(true)} accessibilityLabel="Pick a day">
            <Text className="text-base font-semibold text-ink">{formatDayKey(date)}</Text>
          </Pressable>
          <Pressable onPress={() => setDate(addDaysToKey(date, 1))} hitSlop={10} className="p-1" accessibilityLabel="Next day">
            <ChevronRight size={22} color={colors.ink} />
          </Pressable>
        </View>

        <DiarySummaryCard totals={totals} targets={targets} hasProfile={nutrition !== null} onSetUp={() => router.navigate({ pathname: '/history', params: { view: 'body', at: String(Date.now()) } })} />

        <SegmentedControl
          value={meal}
          options={MEALS.map((m) => ({ value: m, label: MEAL_LABELS[m], detail: n0(sumNutrients(byMeal.get(m) ?? []).kcal) }))}
          onChange={setMeal}
        />

        <View className="rounded-card bg-surface-raised">
          <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
            <Text className="font-semibold text-ink">{MEAL_LABELS[meal]}</Text>
            <View className="flex-row items-center gap-3">
              <Text className="text-xs tabular-nums text-ink-muted">
                {n0(mealTotals.kcal)} kcal · <Text className="text-macro-protein">{n0(mealTotals.protein_g)} g protein</Text>
              </Text>
              {mealEntries.length > 0 && (
                <Pressable onPress={() => setMenuOpen(true)} hitSlop={10} accessibilityLabel={`${MEAL_LABELS[meal]} options`}>
                  <MoreHorizontal size={20} color={colors.muted} />
                </Pressable>
              )}
            </View>
          </View>
          {mealEntries.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => void editableEntry(e.id).then(setEditing)}
              className="flex-row items-center border-t border-surface-border px-4 py-3 active:bg-surface-elevated"
            >
              <View className="flex-1 pr-3">
                <Text className="text-ink" numberOfLines={1}>
                  {e.name}
                </Text>
                <Text className="text-xs text-ink-subtle">
                  {amountText(e)} · <Text className="text-macro-protein">{n0(e.protein_g)} g protein</Text>
                </Text>
              </View>
              <Text className="tabular-nums text-ink">{n0(e.kcal)}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => router.push({ pathname: '/food/add', params: { meal, date } })}
            className="flex-row items-center gap-2 border-t border-surface-border px-4 py-3 active:bg-surface-elevated"
          >
            <Plus size={16} color={colors.accent} />
            <Text className="font-semibold text-accent">Add food</Text>
          </Pressable>
        </View>
      </ScrollView>

      <DatePickerSheet visible={picking} value={date} onPick={setDate} onClose={() => setPicking(false)} />

      <ChoiceSheet
        visible={askLateNight}
        title="Add food to which day?"
        message="It's after midnight. Food you log now can count towards yesterday or today."
        dismissable={false}
        onClose={() => setAskLateNight(false)}
        choices={[
          { label: `Yesterday (${formatDayKey(addDaysToKey(toLocalDateKey(new Date()), -1))})`, tone: 'primary', onPress: () => {
            setLateNightChoice('yesterday');
            setDate(addDaysToKey(toLocalDateKey(new Date()), -1));
          } },
          { label: 'Today', onPress: () => {
            setLateNightChoice('today');
            setDate(toLocalDateKey(new Date()));
          } },
        ]}
      />

      <ChoiceSheet
        visible={askRecalc}
        title="Recalculate your targets?"
        message="Your weight has changed since your targets were set. Recalculate your edited targets?"
        onClose={() => setAskRecalc(false)}
        choices={[
          { label: 'Recalculate', tone: 'primary', onPress: () => void markPrompted(new Date()).then(() => acceptRecalcPrompt()) },
          { label: 'Keep mine', onPress: () => void markPrompted(new Date()) },
        ]}
      />

      <ChoiceSheet
        visible={menuOpen}
        title={MEAL_LABELS[meal]}
        onClose={() => setMenuOpen(false)}
        choices={[
          { label: 'Save as meal', onPress: () => setSavingMeal(true) },
          { label: 'Copy to another day', onPress: () => setCopy('meal') },
          { label: 'Copy selected items', onPress: () => setCopy('items') },
        ]}
      />

      <CopyEntriesSheet
        visible={copy !== null}
        entries={pickable}
        pickItems={copy === 'items'}
        fromDate={date}
        fromMeal={meal}
        onCopy={(ids, to) => {
          void copyEntries(ids, to).catch(saveFailed).then(() => showToast({ message: `Copied ${ids.length} ${ids.length === 1 ? 'item' : 'items'} to ${formatDayKey(to.localDate)}` }));
        }}
        onClose={() => setCopy(null)}
      />

      <SaveMealSheet
        visible={savingMeal}
        entries={pickable}
        defaultName={`${MEAL_LABELS[meal]} ${formatDayKey(date)}`}
        onSave={(name, ids) => void saveMeal(name, ids).then(() => showToast({ message: `Saved "${name}"` }))}
        onClose={() => setSavingMeal(false)}
      />

      <PortionSheet
        visible={editing?.kind === 'food'}
        food={editing?.kind === 'food' ? editing.food : null}
        initial={editing?.kind === 'food' ? editing.initial : undefined}
        defaultMeal={meal}
        mode="edit"
        gramsOnly={editing?.kind === 'food' && editing.gramsOnly}
        maxGrams={editing?.kind === 'food' ? editing.maxGrams : undefined}
        onSubmit={({ serving, servings, meal: m }) => {
          if (editing?.kind !== 'food') return;
          const e = editing.entry;
          const saving = e.batch_id
            ? updateBatchEntryGrams(e.id, serving.grams * servings, { meal: m })
            : updateEntry(e.id, { serving, servings, meal: m, per100: editing.food.per100 });
          void saving.catch(saveFailed);
        }}
        onDelete={() => editing && askDelete(editing.entry)}
        onClose={() => setEditing(null)}
      />

      <QuickAddSheet
        visible={editing?.kind === 'quick'}
        initial={editing?.kind === 'quick' ? editing.quick : undefined}
        defaultMeal={meal}
        onSubmit={(v) => editing && void updateQuickAdd(editing.entry.id, v).catch(saveFailed)}
        onDelete={() => editing && askDelete(editing.entry)}
        onClose={() => setEditing(null)}
      />

      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
    </SafeAreaView>
  );
}
