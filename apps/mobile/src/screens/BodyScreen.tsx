import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { ACTIVITY_LABELS, addDaysToKey, ageOn, kgToLb, maintenanceKcal, toLocalDateKey, type Targets } from '@gym/shared';
import { useLiveQuery } from '../db/useLiveQuery';
import { currentWeightKg, deleteWeight, getTargetsForDate, logWeight, saveProfileAndGoal, setOverride, updateWeight, weightTrend } from '../db/repositories/body';
import { ConfirmSheet, type ConfirmRequest } from '../components/ConfirmSheet';
import { saveFailed } from '../state/toastStore';
import { useSettingsStore, useUnits } from '../state/settingsStore';
import { colors } from '../theme';
import { LogWeightSheet, ProfileGoalSheet, TargetEditSheet } from '../components/body/BodySheets';
import { WeightTrendChart } from '../components/body/WeightTrendChart';
import { formatDayKey } from '../components/food/dayLabel';

const TARGET_ROWS: { key: keyof Targets; label: string; unit: string }[] = [
  { key: 'kcal', label: 'Calories', unit: 'kcal' },
  { key: 'protein_g', label: 'Protein', unit: 'g' },
  { key: 'carbs_g', label: 'Carbs', unit: 'g' },
  { key: 'fat_g', label: 'Fat', unit: 'g' },
];
/** The chart shows the last 8 weeks; the headline change compares with 4 weeks ago. */
const CHART_DAYS = 56;
const CHANGE_DAYS = 28;
const WEIGH_INS_SHOWN = 5;

/** History → Body (spec §8): weight and its trend against the goal, body details and goal, daily targets, weigh-ins. */
export default function BodyScreen() {
  const units = useUnits();
  const nutrition = useSettingsStore((s) => s.nutrition);
  const [logging, setLogging] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingTarget, setEditingTarget] = useState<keyof Targets | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [weightBefore, setWeightBefore] = useState<number | null>(null);
  const [editingWeigh, setEditingWeigh] = useState<{ id: string; value: number } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [trend, setTrend] = useState<{ local_date: string; value: number }[]>([]);
  const [allWeighIns, setAllWeighIns] = useState(false);

  const { data: weighIns } = useLiveQuery<{ id: string; local_date: string; value: number }>(
    `SELECT id, local_date, value FROM body_metrics WHERE deleted_at IS NULL AND metric = 'weight' ORDER BY local_date DESC, measured_at DESC LIMIT 100`,
    [],
    ['body_metrics'],
  );
  const today = toLocalDateKey(new Date());
  const changeFrom = addDaysToKey(today, -CHANGE_DAYS);
  useEffect(() => {
    void currentWeightKg().then(setWeight);
    void currentWeightKg(changeFrom).then(setWeightBefore);
    void weightTrend().then(setTrend);
  }, [weighIns, changeFrom]);

  const targets = getTargetsForDate(today);
  const overrides = nutrition?.overrides ?? {};
  const toDisplay = (kg: number) => (units.unit === 'imperial' ? kgToLb(kg) : kg);
  const signed = (kg: number) => `${kg > 0 ? '+' : kg < 0 ? '−' : ''}${units.format(Math.abs(kg), 1)}`;

  // Goal pace: from the weight 4 weeks ago, at the goal's rate. Losing counts down, gaining up.
  const goal = nutrition?.goal ?? null;
  const perWeek = goal ? (goal.kind === 'lose' ? -1 : goal.kind === 'gain' ? 1 : 0) * goal.rate_kg_per_week : 0;
  const goalLine: [{ local_date: string; value: number }, { local_date: string; value: number }] | null =
    goal && weightBefore !== null
      ? [
          { local_date: changeFrom, value: weightBefore },
          { local_date: today, value: weightBefore + (perWeek * CHANGE_DAYS) / 7 },
        ]
      : null;
  const change = weight !== null && weightBefore !== null && weighIns.some((w) => w.local_date <= changeFrom) ? weight - weightBefore : null;
  // Moving in the goal's direction is good news; maintaining or no goal stays neutral.
  const changeTone = change !== null && perWeek !== 0 && Math.sign(change) === Math.sign(perWeek) ? 'text-accent' : 'text-ink';

  const goalTitle = !goal
    ? ''
    : goal.kind === 'maintain'
      ? 'Maintain weight'
      : `${goal.kind === 'lose' ? 'Lose' : 'Gain'} ${units.format(goal.rate_kg_per_week, 2)} a week`;
  const profile = nutrition?.profile;
  const height = !profile
    ? ''
    : units.unit === 'imperial'
      ? `${Math.floor(profile.height_cm / 30.48)}′${Math.round((profile.height_cm / 2.54) % 12)}″`
      : `${profile.height_cm} cm`;

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48, gap: 14 }}>
      <View className="gap-3.5 rounded-[20px] bg-surface-raised p-5">
        <View className="flex-row items-baseline justify-between">
          <Text className="text-base font-semibold text-ink">Weight</Text>
          <Text className="text-[13px] text-ink-muted">7-day average</Text>
        </View>
        <View className="gap-0.5">
          <Text className="text-[32px] font-bold leading-[38px] tabular-nums text-ink">
            {weight === null ? '–' : units.display(weight, 1)} <Text className="text-base font-normal text-ink-muted">{units.label}</Text>
          </Text>
          {change !== null && (
            <Text className="text-sm text-ink-muted">
              <Text className={`font-semibold ${changeTone}`}>{signed(change)}</Text> in 4 weeks.
              {perWeek !== 0 && ` Goal pace is ${signed((perWeek * CHANGE_DAYS) / 7)}.`}
            </Text>
          )}
        </View>

        <View className="flex-row flex-wrap gap-x-3.5 gap-y-1">
          <Key swatch={<View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#6E6E78' }} />} label="Weigh-ins" />
          <Key swatch={<View className="h-[3px] w-3.5 rounded-full bg-accent" />} label="30-day trend" />
          {goalLine && <Key swatch={<View className="w-3.5 border-t-2 border-dashed border-ink-muted" />} label="Goal pace" />}
        </View>

        <WeightTrendChart
          points={[...weighIns].reverse()}
          trend={trend}
          goal={goalLine}
          fromKey={addDaysToKey(today, -CHART_DAYS)}
          todayKey={today}
          toDisplay={toDisplay}
        />

        <Pressable
          onPress={() => setLogging(true)}
          className="h-[52px] flex-row items-center justify-center gap-2 rounded-full bg-accent active:opacity-80"
        >
          <Plus size={18} color={colors.bg} />
          <Text className="text-base font-bold text-surface">Log weight</Text>
        </Pressable>
      </View>

      {nutrition && profile && goal ? (
        <View className="gap-3.5 rounded-[20px] bg-surface-raised px-5 py-[18px]">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 gap-0.5">
              <Text className="text-lg font-semibold text-ink">{goalTitle}</Text>
              <Text className="text-[13px] text-ink-muted">
                {profile.sex === 'male' ? 'Male' : 'Female'} · {ageOn(profile.birth_date, today)} · {height} ·{' '}
                {ACTIVITY_LABELS[profile.activity]}
              </Text>
            </View>
            <Pressable onPress={() => setEditingProfile(true)} hitSlop={12} accessibilityLabel="Edit body and goal">
              <Text className="text-sm text-ink-muted">Edit</Text>
            </Pressable>
          </View>
          {weight !== null && (
            <View className="flex-row rounded-[14px] bg-surface-elevated py-3">
              <View className="flex-1 gap-0.5 px-3.5">
                <Text className="text-xs text-ink-muted">Maintenance</Text>
                <Text className="text-lg font-medium tabular-nums text-ink">
                  ≈ {maintenanceKcal(profile, weight, today).toLocaleString()} <Text className="text-[13px] text-ink-muted">kcal</Text>
                </Text>
              </View>
              {targets && (
                <View className="flex-1 gap-0.5 border-l border-surface-border px-3.5">
                  <Text className="text-xs text-ink-muted">Eat for the goal</Text>
                  <Text className="text-lg font-medium tabular-nums text-ink">
                    {Math.round(targets.kcal).toLocaleString()} <Text className="text-[13px] text-ink-muted">kcal</Text>
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      ) : (
        <Pressable
          onPress={() => setEditingProfile(true)}
          className="h-[52px] items-center justify-center rounded-full bg-accent active:opacity-80"
        >
          <Text className="text-base font-bold text-surface">Set up body details and goal</Text>
        </Pressable>
      )}

      {nutrition && (
        <View className="mt-1.5 gap-2">
          <View className="flex-row items-baseline justify-between px-1">
            <Text className="text-base font-semibold text-ink">Daily targets</Text>
            {targets && <Text className="text-[13px] text-ink-muted">Tap one to change it</Text>}
          </View>
          {!targets ? (
            <View className="rounded-[20px] bg-surface-raised p-4">
              <Text className="text-sm text-ink-muted">Log your weight to work out your targets.</Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {TARGET_ROWS.map((row) => {
                const edited = overrides[row.key] !== undefined;
                return (
                  <Pressable
                    key={row.key}
                    onPress={() => setEditingTarget(row.key)}
                    className="min-h-[68px] grow basis-[45%] gap-0.5 rounded-2xl bg-surface-raised px-3.5 py-3 active:bg-surface-elevated"
                  >
                    <Text className="text-[13px] text-ink-muted">{row.label}</Text>
                    <Text className="text-xl font-medium tabular-nums text-ink">
                      {Math.round(targets[row.key]).toLocaleString()} <Text className="text-[13px] text-ink-muted">{row.unit}</Text>
                    </Text>
                    {edited && (
                      <Pressable onPress={() => void setOverride(row.key, null)} hitSlop={8} accessibilityLabel={`Reset ${row.label}`}>
                        <Text className="text-xs text-pr">Set by you · Reset</Text>
                      </Pressable>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      )}

      {weighIns.length > 0 && (
        <View className="mt-1.5 gap-2">
          <View className="flex-row items-baseline justify-between px-1">
            <Text className="text-base font-semibold text-ink">
              Weigh-ins <Text className="font-normal text-ink-muted">{weighIns.length}</Text>
            </Text>
            {weighIns.length > WEIGH_INS_SHOWN && (
              <Pressable onPress={() => setAllWeighIns((v) => !v)} hitSlop={10}>
                <Text className="text-sm text-ink-muted">{allWeighIns ? 'Show fewer' : 'View all'}</Text>
              </Pressable>
            )}
          </View>
          <View className="rounded-[20px] bg-surface-raised py-1">
            {weighIns.slice(0, allWeighIns ? 100 : WEIGH_INS_SHOWN).map((w, i) => {
              const older = weighIns[i + 1];
              const diff = older ? Math.round(toDisplay(w.value - older.value) * 10) / 10 : null;
              return (
                <Pressable
                  key={w.id}
                  onPress={() => setEditingWeigh(w)}
                  className={`min-h-[52px] flex-row items-center gap-3 px-4 active:bg-surface-elevated ${
                    i > 0 ? 'border-t border-surface-elevated' : ''
                  }`}
                >
                  <Text className="flex-1 text-[15px] text-ink">{formatDayKey(w.local_date)}</Text>
                  <Text className="w-14 text-right text-[13px] tabular-nums text-ink-muted">
                    {diff === null ? '' : `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${Math.abs(diff).toFixed(1)}`}
                  </Text>
                  <Text className="w-[84px] text-right text-base font-medium tabular-nums text-ink">
                    {units.display(w.value, 1)} <Text className="text-[13px] font-normal text-ink-muted">{units.label}</Text>
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <LogWeightSheet visible={logging} unit={units.unit} toKg={units.toKg} onSave={(kg, date) => void logWeight(kg, date).catch(saveFailed)} onClose={() => setLogging(false)} />
      <LogWeightSheet
        visible={editingWeigh !== null}
        unit={units.unit}
        toKg={units.toKg}
        initial={editingWeigh ? units.display(editingWeigh.value, 1) : undefined}
        onSave={(kg) => editingWeigh && void updateWeight(editingWeigh.id, kg).catch(saveFailed)}
        onDelete={() =>
          editingWeigh &&
          setConfirm({
            title: 'Delete this weigh-in?',
            message: 'Your average and targets will be recalculated.',
            confirmLabel: 'Delete',
            tone: 'destructive',
            onConfirm: () => {
              void deleteWeight(editingWeigh.id).catch(saveFailed);
              setEditingWeigh(null);
            },
          })
        }
        onClose={() => setEditingWeigh(null)}
      />
      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
      <ProfileGoalSheet
        visible={editingProfile}
        unit={units.unit}
        profile={nutrition?.profile ?? null}
        goal={nutrition?.goal ?? null}
        onSave={(p, g) => void saveProfileAndGoal(p, g)}
        onClose={() => setEditingProfile(false)}
      />
      <TargetEditSheet
        target={editingTarget}
        current={targets}
        sex={nutrition?.profile.sex ?? 'male'}
        onSave={(key, value) => setOverride(key, value)}
        onClose={() => setEditingTarget(null)}
      />
    </ScrollView>
  );
}

function Key({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      {swatch}
      <Text className="text-xs text-ink-muted">{label}</Text>
    </View>
  );
}
