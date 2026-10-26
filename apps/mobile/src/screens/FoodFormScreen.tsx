import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { router, useLocalSearchParams } from 'expo-router';
import { Plus, Trash2, X } from 'lucide-react-native';
import {
  buildFoodFromForm,
  formFieldsFrom,
  parseDecimal,
  type FoodFormErrors,
  type FoodFormFields,
  type FoodRow,
  type Serving,
} from '@gym/shared';
import { getRecord } from '../db/mutate';
import { createFood, logFood, updateFood, type PortionFood } from '../db/repositories/food';
import { useFoodFormDraftStore } from '../state/foodFormDraftStore';
import { saveFailed, showToast } from '../state/toastStore';
import { colors } from '../theme';
import { SegmentedControl } from '../components/SegmentedControl';
import { PortionSheet } from '../components/food/PortionSheet';

type Mode = 'new' | 'edit' | 'check' | 'label';

const EMPTY: FoodFormFields = { name: '', basis: '100g', servingGrams: '', kcal: '', protein: '', carbs: '', fat: '', fibre: '', sugars: '', satFat: '', salt: '' };
const TITLES: Record<Mode, string> = { new: 'New food', edit: 'Edit food', check: 'Check details', label: 'Check label' };

/**
 * Create / edit a food (spec §6.3), the Open Food Facts check page (§6.2, first scan only) and the label-photo
 * confirmation page (§6.4). Only name, calories and protein are required. Opened from logging, saving goes
 * straight to the portion screen for that meal and day.
 */
export default function FoodFormScreen() {
  const params = useLocalSearchParams<{ mode?: string; foodId?: string; name?: string; barcode?: string }>();
  const mode: Mode = params.mode === 'edit' || params.mode === 'check' || params.mode === 'label' ? params.mode : 'new';
  const draft = useFoodFormDraftStore((s) => s.draft);
  const logTo = useFoodFormDraftStore((s) => s.logTo);

  const [fields, setFields] = useState<FoodFormFields>(EMPTY);
  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState<string | null>(null);
  const [servings, setServings] = useState<{ label: string; grams: string }[]>([]);
  const [source, setSource] = useState<FoodRow['source']>('custom');
  const [errors, setErrors] = useState<FoodFormErrors>({});
  const [saved, setSaved] = useState<{ id: string; food: PortionFood } | null>(null);

  useEffect(() => {
    if (mode === 'edit' && params.foodId) {
      void getRecord('foods', params.foodId).then((f) => {
        if (!f) return;
        setFields(formFieldsFrom({ name: f.name, basis: f.basis, per100: f }));
        setBrand(f.brand ?? '');
        setBarcode(f.barcode);
        setServings(f.servings.map((s) => ({ label: s.label, grams: String(s.grams) })));
        setSource(f.source);
      });
    } else if (draft) {
      const prefilled = formFieldsFrom({ name: draft.name, basis: draft.basis, per100: draft.per100 }, { unknownKcal: !draft.kcalKnown });
      setFields(prefilled);
      setBrand(draft.brand ?? '');
      setBarcode(draft.barcode);
      setServings(draft.servings.map((s) => ({ label: s.label, grams: String(s.grams) })));
      setSource(mode === 'label' ? 'label' : draft.source);
      // Check / label pages show what's missing straight away.
      const r = buildFoodFromForm(prefilled);
      setErrors(r.ok ? {} : r.errors);
    } else {
      setFields({ ...EMPTY, name: params.name ?? '' });
      setBarcode(params.barcode ?? null);
      setSource(mode === 'label' ? 'label' : 'custom');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (key: keyof FoodFormFields) => (text: string) => setFields((f) => ({ ...f, [key]: text }));

  const save = async () => {
    const r = buildFoodFromForm(fields);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    const extra: Serving[] = servings
      .map((s) => ({ label: s.label.trim(), grams: parseDecimal(s.grams) ?? 0 }))
      .filter((s) => s.label !== '' && s.grams > 0);
    const all = r.extraServing && !extra.some((s) => Math.abs(s.grams - r.extraServing!.grams) < 0.01) ? [r.extraServing, ...extra] : extra;
    const input = { name: fields.name, brand: brand.trim() || null, barcode, source, basis: r.basis, per100: r.per100, servings: all.slice(0, 20) };
    if (busy.current) return; // a double tap must not create two foods
    busy.current = true;
    try {
      if (mode === 'edit' && params.foodId) {
        await updateFood(params.foodId, { name: input.name.trim(), brand: input.brand, basis: input.basis, ...input.per100, servings: input.servings });
        router.back();
        return;
      }
      const food = await createFood(input);
      if (logTo) setSaved({ id: food.id, food: { name: food.name, per100: input.per100, servings: input.servings, basis: input.basis } });
      else router.back();
    } catch (e) {
      busy.current = false;
      saveFailed(e);
    }
  };
  const busy = useRef(false);

  const done = () => {
    useFoodFormDraftStore.getState().clear();
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 pt-3">
        <Pressable onPress={done} hitSlop={10} accessibilityLabel="Close">
          <X size={24} color={colors.ink} />
        </Pressable>
        <Text className="text-xl font-bold text-ink">{TITLES[mode]}</Text>
      </View>
      <KeyboardAwareScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 48 }} bottomOffset={24}>
        {mode === 'check' && <Text className="text-sm text-ink-subtle">Found online (Open Food Facts). Fix anything that looks wrong.</Text>}
        {mode === 'label' && <Text className="text-sm text-ink-subtle">Read from your photo. Check every value against the label before saving.</Text>}

        <Field label="Name" value={fields.name} onChange={set('name')} error={errors.name} />
        <Field label="Brand (optional)" value={brand} onChange={setBrand} />

        <View className="gap-1">
          <Text className="text-xs text-ink-muted">Values are per</Text>
          <SegmentedControl
            value={fields.basis}
            options={[
              { value: '100g', label: '100 g' },
              { value: '100ml', label: '100 ml' },
              { value: 'serving', label: 'Serving' },
            ]}
            onChange={(b) => setFields((f) => ({ ...f, basis: b }))}
          />
        </View>
        {fields.basis === 'serving' && <Field label="Serving weight (g)" value={fields.servingGrams} onChange={set('servingGrams')} error={errors.servingGrams} numeric />}

        <View className="flex-row gap-3">
          <Field row label="Energy (kcal)" value={fields.kcal} onChange={set('kcal')} error={errors.kcal} numeric />
          <Field row label="Protein (g)" value={fields.protein} onChange={set('protein')} error={errors.protein} numeric />
        </View>
        <View className="flex-row gap-3">
          <Field row label="Fat (g)" value={fields.fat} onChange={set('fat')} error={errors.fat} numeric />
          <Field row label="of which saturates (g)" value={fields.satFat} onChange={set('satFat')} error={errors.satFat} numeric />
        </View>
        <View className="flex-row gap-3">
          <Field row label="Carbohydrate (g)" value={fields.carbs} onChange={set('carbs')} error={errors.carbs} numeric />
          <Field row label="of which sugars (g)" value={fields.sugars} onChange={set('sugars')} error={errors.sugars} numeric />
        </View>
        <View className="flex-row gap-3">
          <Field row label="Fibre (g)" value={fields.fibre} onChange={set('fibre')} error={errors.fibre} numeric />
          <Field row label="Salt (g)" value={fields.salt} onChange={set('salt')} error={errors.salt} numeric />
        </View>
        <Text className="text-xs text-ink-subtle">Only calories and protein are needed. Leave anything the label doesn’t list blank.</Text>

        <View className="gap-2">
          <Text className="text-xs text-ink-muted">Servings (optional)</Text>
          {servings.map((s, i) => (
            <View key={i} className="flex-row items-center gap-2">
              <TextInput
                value={s.label}
                onChangeText={(t) => setServings((list) => list.map((x, j) => (j === i ? { ...x, label: t } : x)))}
                placeholder="e.g. 1 bar"
                placeholderTextColor={colors.faint}
                maxLength={60}
                className="flex-[2] rounded-xl bg-surface-elevated px-3 py-3 text-ink"
              />
              <TextInput
                value={s.grams}
                onChangeText={(t) => setServings((list) => list.map((x, j) => (j === i ? { ...x, grams: t } : x)))}
                placeholder="g"
                placeholderTextColor={colors.faint}
                keyboardType="decimal-pad"
                className="flex-1 rounded-xl bg-surface-elevated px-3 py-3 text-ink"
              />
              <Pressable onPress={() => setServings((list) => list.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel="Remove serving">
                <Trash2 size={18} color={colors.subtle} />
              </Pressable>
            </View>
          ))}
          <Pressable onPress={() => setServings((list) => [...list, { label: '', grams: '' }])} className="flex-row items-center gap-2 py-1">
            <Plus size={16} color={colors.accent} />
            <Text className="font-semibold text-accent">Add serving</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => void save()} className="mt-2 h-14 items-center justify-center rounded-xl bg-accent active:opacity-80">
          <Text className="text-base font-bold text-surface">{mode === 'check' ? 'Looks right' : 'Save'}</Text>
        </Pressable>
      </KeyboardAwareScrollView>

      <PortionSheet
        visible={saved !== null}
        food={saved?.food ?? null}
        defaultMeal={logTo?.meal ?? 'breakfast'}
        mode="add"
        onSubmit={async ({ serving, servings: n, meal }) => {
          if (!saved || !logTo) return;
          try {
            await logFood({ ref: { kind: 'food', id: saved.id }, name: saved.food.name, per100: saved.food.per100, serving, servings: n, meal, localDate: logTo.date });
            showToast({ message: `Added ${saved.food.name}` });
          } catch (e) {
            saveFailed(e);
          }
        }}
        onClose={done}
      />
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, error, numeric, row }: { row?: boolean; label: string; value: string; onChange: (t: string) => void; error?: string; numeric?: boolean }) {
  return (
    <View className={row ? 'flex-1 gap-1' : 'gap-1'}>
      <Text className="text-xs text-ink-muted">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        maxLength={numeric ? 10 : 120}
        className={`rounded-xl bg-surface-elevated px-3 py-3 text-base text-ink ${error ? 'border border-settype-failure' : ''}`}
        accessibilityLabel={label}
      />
      {error && <Text className="text-xs text-settype-failure">{error}</Text>}
    </View>
  );
}
