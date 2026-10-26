import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { MEAL_LABELS, MEALS, addDaysToKey, type Meal } from '@gym/shared';
import { colors } from '../../theme';
import { BottomSheet } from '../BottomSheet';
import { Dropdown } from './Dropdown';
import { formatDayKey } from './dayLabel';

export interface PickableEntry {
  id: string;
  name: string;
  /** Quick adds can't be saved in a meal. */
  saveable: boolean;
}

function Checklist({ entries, selected, toggle }: { entries: PickableEntry[]; selected: Set<string>; toggle: (id: string) => void }) {
  return (
    <View className="overflow-hidden rounded-xl bg-surface-elevated">
      {entries.map((e, i) => {
        const on = selected.has(e.id);
        return (
          <Pressable
            key={e.id}
            onPress={() => toggle(e.id)}
            className={`flex-row items-center gap-3 px-3 py-3 ${i > 0 ? 'border-t border-surface-border' : ''}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
          >
            <View className={`h-5 w-5 items-center justify-center rounded ${on ? 'bg-accent' : 'border border-ink-faint'}`}>
              {on && <Check size={14} color={colors.bg} />}
            </View>
            <Text className="flex-1 text-ink" numberOfLines={1}>
              {e.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useSelection = (visible: boolean, entries: PickableEntry[], filter: (e: PickableEntry) => boolean) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (visible) setSelected(new Set(entries.filter(filter).map((e) => e.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, entries]);
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return { selected, toggle };
};

/** Copy a whole meal, or picked items, to another day / meal (spec §5.5). */
export function CopyEntriesSheet({
  visible,
  entries,
  pickItems,
  fromDate,
  fromMeal,
  onCopy,
  onClose,
}: {
  visible: boolean;
  entries: PickableEntry[];
  pickItems: boolean;
  fromDate: string;
  fromMeal: Meal;
  onCopy: (ids: string[], to: { localDate: string; meal: Meal }) => void;
  onClose: () => void;
}) {
  const { selected, toggle } = useSelection(visible, entries, () => !pickItems);
  const [date, setDate] = useState(fromDate);
  const [meal, setMeal] = useState<Meal>(fromMeal);
  useEffect(() => {
    if (!visible) return;
    setDate(addDaysToKey(fromDate, 1));
    setMeal(fromMeal);
  }, [visible, fromDate, fromMeal]);
  const ids = pickItems ? entries.filter((e) => selected.has(e.id)).map((e) => e.id) : entries.map((e) => e.id);

  return (
    <BottomSheet visible={visible} onClose={onClose} className="px-5 pb-8 pt-3">
      <View className="mb-4 h-1 w-10 self-center rounded-full bg-surface-border" />
      <View className="gap-4">
        <Text className="text-xl font-bold text-ink">{pickItems ? 'Copy selected items' : `Copy ${MEAL_LABELS[fromMeal]}`}</Text>
        {pickItems && <Checklist entries={entries} selected={selected} toggle={toggle} />}
        <View className="gap-1">
          <Text className="text-xs text-ink-muted">To day</Text>
          <View className="flex-row items-center justify-between rounded-xl bg-surface-elevated px-2 py-2">
            <Pressable onPress={() => setDate(addDaysToKey(date, -1))} hitSlop={8} className="p-1" accessibilityLabel="Previous day">
              <ChevronLeft size={20} color={colors.ink} />
            </Pressable>
            <Text className="text-base text-ink">{formatDayKey(date)}</Text>
            <Pressable onPress={() => setDate(addDaysToKey(date, 1))} hitSlop={8} className="p-1" accessibilityLabel="Next day">
              <ChevronRight size={20} color={colors.ink} />
            </Pressable>
          </View>
        </View>
        <Dropdown label="To meal" value={meal} options={MEALS} format={(m) => MEAL_LABELS[m]} onChange={setMeal} />
        <Pressable
          disabled={ids.length === 0}
          onPress={() => {
            onCopy(ids, { localDate: date, meal });
            onClose();
          }}
          className={`h-14 items-center justify-center rounded-xl bg-accent ${ids.length === 0 ? 'opacity-40' : 'active:opacity-80'}`}
        >
          <Text className="text-base font-bold text-surface">
            Copy {ids.length} {ids.length === 1 ? 'item' : 'items'}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

/** Save as meal (spec §5.5a): name it, untick foods you don't want. */
export function SaveMealSheet({
  visible,
  entries,
  defaultName,
  onSave,
  onClose,
}: {
  visible: boolean;
  entries: PickableEntry[];
  defaultName: string;
  onSave: (name: string, ids: string[]) => void;
  onClose: () => void;
}) {
  const saveable = entries.filter((e) => e.saveable);
  const { selected, toggle } = useSelection(visible, saveable, () => true);
  const [name, setName] = useState('');
  useEffect(() => {
    if (visible) setName(defaultName);
  }, [visible, defaultName]);
  const ids = saveable.filter((e) => selected.has(e.id)).map((e) => e.id);
  const invalid = name.trim() === '' || ids.length === 0;

  return (
    <BottomSheet visible={visible} onClose={onClose} avoidKeyboard className="px-5 pb-8 pt-3">
      <View className="mb-4 h-1 w-10 self-center rounded-full bg-surface-border" />
      <View className="gap-4">
        <Text className="text-xl font-bold text-ink">Save as meal</Text>
        <View className="gap-1">
          <Text className="text-xs text-ink-muted">Name</Text>
          <TextInput value={name} onChangeText={setName} maxLength={120} className="rounded-xl bg-surface-elevated px-3 py-3 text-base text-ink" accessibilityLabel="Meal name" />
        </View>
        <Text className="text-xs text-ink-muted">Include</Text>
        <Checklist entries={saveable} selected={selected} toggle={toggle} />
        {saveable.length < entries.length && <Text className="text-xs text-ink-subtle">Quick adds and recipes aren't saved in meals.</Text>}
        <Pressable
          disabled={invalid}
          onPress={() => {
            onSave(name.trim(), ids);
            onClose();
          }}
          className={`h-14 items-center justify-center rounded-xl bg-accent ${invalid ? 'opacity-40' : 'active:opacity-80'}`}
        >
          <Text className="text-base font-bold text-surface">Save meal</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
