import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  ACTIVITY_LABELS,
  ACTIVITY_LEVELS,
  GAIN_RATES_KG,
  LOSE_RATES_KG,
  MIN_KCAL,
  cmToFeetInches,
  feetInchesToCm,
  kgToLb,
  parseDecimal,
  toLocalDateKey,
  type ActivityLevel,
  type BodyProfile,
  type Goal,
  type GoalKind,
  type Sex,
  type Targets,
  type UnitSystem,
} from '@gym/shared';
import { colors } from '../../theme';
import { BottomSheet } from '../BottomSheet';
import { SegmentedControl } from '../SegmentedControl';
import { Dropdown } from '../food/Dropdown';

function Field({ label, value, onChange, numeric = true, placeholder }: { label: string; value: string; onChange: (t: string) => void; numeric?: boolean; placeholder?: string }) {
  return (
    <View className="flex-1 gap-1">
      <Text className="text-xs text-ink-muted">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        maxLength={10}
        className="rounded-xl bg-surface-elevated px-3 py-3 text-base tabular-nums text-ink"
        accessibilityLabel={label}
      />
    </View>
  );
}

function SaveButton({ disabled, label = 'Save', onPress }: { disabled: boolean; label?: string; onPress: () => void }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} className={`h-14 items-center justify-center rounded-xl bg-accent ${disabled ? 'opacity-40' : 'active:opacity-80'}`}>
      <Text className="text-base font-bold text-surface">{label}</Text>
    </Pressable>
  );
}

/** + Log weight (today), or fix / delete an existing weigh-in when `initial` is given. */
export function LogWeightSheet({
  visible,
  unit,
  toKg,
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  visible: boolean;
  unit: UnitSystem;
  toKg: (v: number) => number;
  /** Editing: the weigh-in's value already in the user's unit. */
  initial?: string;
  onSave: (kg: number, localDate: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  useEffect(() => {
    if (visible) setValue(initial ?? '');
  }, [visible, initial]);
  const v = parseDecimal(value);
  const kg = v === null ? null : toKg(v);
  const invalid = kg === null || kg < 20 || kg > 400;
  return (
    <BottomSheet visible={visible} onClose={onClose} avoidKeyboard className="px-5 pb-8 pt-3">
      <View className="mb-4 h-1 w-10 self-center rounded-full bg-surface-border" />
      <View className="gap-4">
        <Text className="text-xl font-bold text-ink">{initial ? 'Edit weigh-in' : 'Log weight'}</Text>
        <Field label={`Weight${initial ? '' : ' today'} (${unit === 'imperial' ? 'lb' : 'kg'})`} value={value} onChange={setValue} />
        <SaveButton
          disabled={invalid}
          onPress={() => {
            if (kg === null) return;
            onSave(kg, toLocalDateKey(new Date()));
            onClose();
          }}
        />
        {onDelete && (
          <Pressable onPress={onDelete} className="h-12 items-center justify-center rounded-xl bg-surface-elevated active:opacity-80">
            <Text className="font-semibold text-settype-failure">Delete weigh-in</Text>
          </Pressable>
        )}
      </View>
    </BottomSheet>
  );
}

const rateLabel = (kg: number, unit: UnitSystem) => (unit === 'imperial' ? `${Number(kgToLb(kg).toFixed(2))} lb` : `${kg} kg`);
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Body details and goal (spec §8.1): height, date of birth, sex, activity, lose / maintain / gain + weekly rate. */
export function ProfileGoalSheet({
  visible,
  unit,
  profile,
  goal,
  onSave,
  onClose,
}: {
  visible: boolean;
  unit: UnitSystem;
  profile: BodyProfile | null;
  goal: Goal | null;
  onSave: (p: BodyProfile, g: Goal) => void;
  onClose: () => void;
}) {
  const [cm, setCm] = useState('');
  const [ft, setFt] = useState('');
  const [inch, setInch] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [sex, setSex] = useState<Sex>('male');
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [kind, setKind] = useState<GoalKind>('maintain');
  const [rate, setRate] = useState(0.5);

  useEffect(() => {
    if (!visible) return;
    const h = profile?.height_cm ?? null;
    setCm(h ? String(Math.round(h)) : '');
    const fi = h ? cmToFeetInches(h) : null;
    setFt(fi ? String(fi.feet) : '');
    setInch(fi ? String(fi.inches) : '');
    const [y, m, d] = profile?.birth_date.split('-') ?? ['', '', ''];
    setYear(y ?? '');
    setMonth(m ? String(Number(m)) : '');
    setDay(d ? String(Number(d)) : '');
    setSex(profile?.sex ?? 'male');
    setActivity(profile?.activity ?? 'moderate');
    setKind(goal?.kind ?? 'maintain');
    setRate(goal && goal.rate_kg_per_week > 0 ? goal.rate_kg_per_week : 0.5);
  }, [visible, profile, goal]);

  const heightCm = unit === 'imperial' ? (parseDecimal(ft) !== null ? feetInchesToCm(parseDecimal(ft)!, parseDecimal(inch) ?? 0) : null) : parseDecimal(cm);
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const dob = new Date(y, m - 1, d, 12);
  const validDob = y > 1900 && dob.getFullYear() === y && dob.getMonth() === m - 1 && dob.getDate() === d && dob < new Date();
  const rates = kind === 'lose' ? LOSE_RATES_KG : kind === 'gain' ? GAIN_RATES_KG : [];
  const effectiveRate = kind === 'maintain' ? 0 : (rates as readonly number[]).includes(rate) ? rate : 0.5;
  const invalid = heightCm === null || heightCm < 100 || heightCm > 250 || !validDob;

  return (
    <BottomSheet visible={visible} onClose={onClose} avoidKeyboard className="max-h-[92%] px-5 pb-8 pt-3">
      <View className="mb-4 h-1 w-10 self-center rounded-full bg-surface-border" />
      <View className="gap-4">
        <Text className="text-xl font-bold text-ink">Body &amp; goal</Text>
        {unit === 'imperial' ? (
          <View className="flex-row gap-3">
            <Field label="Height (ft)" value={ft} onChange={setFt} />
            <Field label="(in)" value={inch} onChange={setInch} />
          </View>
        ) : (
          <Field label="Height (cm)" value={cm} onChange={setCm} />
        )}
        <View className="flex-row gap-3">
          <Field label="Day of birth" value={day} onChange={setDay} placeholder="DD" />
          <Field label="Month" value={month} onChange={setMonth} placeholder="MM" />
          <Field label="Year" value={year} onChange={setYear} placeholder="YYYY" />
        </View>
        <SegmentedControl value={sex} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} onChange={setSex} />
        <Dropdown label="Activity level" value={activity} options={ACTIVITY_LEVELS} format={(a) => ACTIVITY_LABELS[a]} onChange={setActivity} />
        <SegmentedControl
          value={kind}
          options={[
            { value: 'lose', label: 'Lose' },
            { value: 'maintain', label: 'Maintain' },
            { value: 'gain', label: 'Gain' },
          ]}
          onChange={setKind}
        />
        {kind !== 'maintain' && (
          <View className="flex-row flex-wrap gap-2">
            {rates.map((r) => (
              <Pressable key={r} onPress={() => setRate(r)} className={`rounded-full border px-4 py-2 ${effectiveRate === r ? 'border-accent bg-accent-soft' : 'border-surface-border'}`}>
                <Text className={effectiveRate === r ? 'font-semibold text-accent' : 'text-ink-muted'}>{rateLabel(r, unit)} / week</Text>
              </Pressable>
            ))}
          </View>
        )}
        <SaveButton
          disabled={invalid}
          onPress={() => {
            if (heightCm === null) return;
            onSave({ birth_date: `${y}-${pad2(m)}-${pad2(d)}`, sex, height_cm: heightCm, activity }, { kind, rate_kg_per_week: effectiveRate });
            onClose();
          }}
        />
      </View>
    </BottomSheet>
  );
}

const TARGET_LABELS: Record<keyof Targets, string> = { kcal: 'Calories (kcal)', protein_g: 'Protein (g)', carbs_g: 'Carbs (g)', fat_g: 'Fat (g)' };

/** Hand-edit one target (spec §8.2). Calories below the minimum and macros that add up below it are refused. */
export function TargetEditSheet({
  target,
  current,
  sex,
  onSave,
  onClose,
}: {
  target: keyof Targets | null;
  current: Targets | null;
  sex: Sex;
  onSave: (key: keyof Targets, value: number) => Promise<{ ok: true } | { ok: false; kcal: number; min: number }>;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (target && current) setValue(String(Math.round(current[target])));
    setError(null);
  }, [target, current]);
  const v = parseDecimal(value);
  const belowMin = target === 'kcal' && v !== null && v < MIN_KCAL[sex];
  return (
    <BottomSheet visible={target !== null} onClose={onClose} avoidKeyboard className="px-5 pb-8 pt-3">
      <View className="mb-4 h-1 w-10 self-center rounded-full bg-surface-border" />
      {target && (
        <View className="gap-4">
          <Text className="text-xl font-bold text-ink">Edit {TARGET_LABELS[target].replace(/ \(.+\)/, '').toLowerCase()} target</Text>
          <Field label={TARGET_LABELS[target]} value={value} onChange={setValue} />
          {belowMin && <Text className="text-xs text-settype-failure">Minimum {MIN_KCAL[sex].toLocaleString()} kcal</Text>}
          {error && <Text className="text-xs text-settype-failure">{error}</Text>}
          <SaveButton
            disabled={v === null || belowMin}
            onPress={() => {
              if (v === null) return;
              void onSave(target, v).then((r) => {
                if (r.ok) onClose();
                else setError(`Your macros add up to ${r.kcal.toLocaleString()} kcal, below your minimum of ${r.min.toLocaleString()} kcal.`);
              });
            }}
          />
        </View>
      )}
    </BottomSheet>
  );
}
