import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Pencil, Plus, RotateCcw } from 'lucide-react-native';
import { ACTIVITY_LABELS, ACTIVITY_MULTIPLIER, kgToLb, maintenanceKcal, toLocalDateKey, type Targets } from '@gym/shared';
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

/** History → Body (spec §8): weigh-ins with a trend, body details and goal, and the daily targets. */
export default function BodyScreen() {
  const units = useUnits();
  const nutrition = useSettingsStore((s) => s.nutrition);
  const [logging, setLogging] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingTarget, setEditingTarget] = useState<keyof Targets | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [editingWeigh, setEditingWeigh] = useState<{ id: string; value: number } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [trend, setTrend] = useState<{ local_date: string; value: number }[]>([]);

  const { data: weighIns } = useLiveQuery<{ id: string; local_date: string; value: number }>(
    `SELECT id, local_date, value FROM body_metrics WHERE deleted_at IS NULL AND metric = 'weight' ORDER BY local_date DESC, measured_at DESC LIMIT 100`,
    [],
    ['body_metrics'],
  );
  useEffect(() => {
    void currentWeightKg().then(setWeight);
    void weightTrend().then(setTrend);
  }, [weighIns]);

  const today = toLocalDateKey(new Date());
  const targets = getTargetsForDate(today);
  const overrides = nutrition?.overrides ?? {};
  const fmtWeight = (kg: number) => units.format(kg, 1);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48, gap: 12 }}>
      <View className="gap-3 rounded-card bg-surface-raised p-4">
        <View className="flex-row items-end justify-between">
          <View>
            <Text className="text-xs text-ink-muted">Current weight (7-day average)</Text>
            <Text className="text-2xl font-bold tabular-nums text-ink">{weight === null ? '–' : fmtWeight(weight)}</Text>
          </View>
          <Pressable onPress={() => setLogging(true)} className="flex-row items-center gap-1.5 rounded-xl bg-accent px-3 py-2 active:opacity-80">
            <Plus size={16} color={colors.bg} />
            <Text className="font-bold text-surface">Log weight</Text>
          </Pressable>
        </View>
        <WeightTrendChart points={[...weighIns].reverse()} trend={trend} format={fmtWeight} />
      </View>

      <View className="gap-2 rounded-card bg-surface-raised p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-semibold text-ink">Body &amp; goal</Text>
          <Pressable onPress={() => setEditingProfile(true)} hitSlop={10} accessibilityLabel="Edit body and goal">
            <Pencil size={18} color={colors.muted} />
          </Pressable>
        </View>
        {nutrition ? (
          <>
            <Text className="text-sm text-ink-subtle">
              {nutrition.profile.sex === 'male' ? 'Male' : 'Female'} · {ACTIVITY_LABELS[nutrition.profile.activity]} ·{' '}
              {nutrition.goal.kind === 'maintain'
                ? 'Maintain weight'
                : `${nutrition.goal.kind === 'lose' ? 'Lose' : 'Gain'} ${units.unit === 'imperial' ? `${Number(kgToLb(nutrition.goal.rate_kg_per_week).toFixed(2))} lb` : `${nutrition.goal.rate_kg_per_week} kg`} / week`}
            </Text>
            {weight !== null && (
              <Text className="text-xs text-ink-subtle">
                Maintenance ≈ {maintenanceKcal(nutrition.profile, weight, today).toLocaleString()} kcal (Mifflin-St Jeor × {ACTIVITY_MULTIPLIER[nutrition.profile.activity]})
              </Text>
            )}
          </>
        ) : (
          <Pressable onPress={() => setEditingProfile(true)} className="mt-1 h-11 items-center justify-center rounded-xl bg-accent active:opacity-80">
            <Text className="font-bold text-surface">Set up body details and goal</Text>
          </Pressable>
        )}
      </View>

      {nutrition && (
        <View className="rounded-card bg-surface-raised">
          <Text className="px-4 pb-2 pt-3 font-semibold text-ink">Daily targets</Text>
          {!targets && <Text className="px-4 pb-3 text-sm text-ink-subtle">Log your weight to work out your targets.</Text>}
          {targets &&
            TARGET_ROWS.map((row) => {
              const edited = overrides[row.key] !== undefined;
              return (
                <Pressable key={row.key} onPress={() => setEditingTarget(row.key)} className="flex-row items-center gap-3 border-t border-surface-border px-4 py-3 active:bg-surface-elevated">
                  <Text className="flex-1 text-ink">{row.label}</Text>
                  {edited && (
                    <Pressable onPress={() => void setOverride(row.key, null)} hitSlop={8} className="flex-row items-center gap-1" accessibilityLabel={`Reset ${row.label}`}>
                      <RotateCcw size={14} color={colors.pr} />
                      <Text className="text-xs text-pr">edited</Text>
                    </Pressable>
                  )}
                  <Text className="tabular-nums text-ink">
                    {Math.round(targets[row.key]).toLocaleString()} {row.unit}
                  </Text>
                </Pressable>
              );
            })}
        </View>
      )}

      {weighIns.length > 0 && (
        <View className="rounded-card bg-surface-raised">
          <Text className="px-4 pb-2 pt-3 font-semibold text-ink">Weigh-ins</Text>
          {weighIns.slice(0, 30).map((w) => (
            <Pressable key={w.id} onPress={() => setEditingWeigh(w)} className="flex-row justify-between border-t border-surface-border px-4 py-3 active:bg-surface-elevated">
              <Text className="text-ink">{formatDayKey(w.local_date)}</Text>
              <Text className="tabular-nums text-ink">{fmtWeight(w.value)}</Text>
            </Pressable>
          ))}
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
