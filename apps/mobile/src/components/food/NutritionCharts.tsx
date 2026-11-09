import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';
import { toLocalDateKey, type Targets } from '@gym/shared';
import { useLiveQuery } from '../../db/useLiveQuery';
import { getTargetsForDate } from '../../db/repositories/body';
import { chartDays, weightVsCalories, type DayTotals } from '../../db/repositories/nutritionStats';
import { useSettingsStore, useUnits } from '../../state/settingsStore';
import { colors } from '../../theme';

const H = 120;
const MINI_H = 64;
const n0 = (v: number) => Math.round(v).toLocaleString();
const dayLetter = (key: string) => {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12).toLocaleDateString(undefined, { weekday: 'narrow' });
};

/**
 * History → Stats: the last 7 days of eating in one card (average calories against the target, days over,
 * protein days hit, and a small bar per day), with the 8-week weight vs calories chart one tap away.
 */
export function NutritionSummary() {
  const units = useUnits();
  const nutrition = useSettingsStore((s) => s.nutrition);
  // Re-load whenever the diary or weigh-ins change.
  const { data: version } = useLiveQuery<{ v: string }>(
    `SELECT (SELECT COUNT(*) || ':' || COALESCE(MAX(updated_at), 0) FROM food_log_entries) || '/' ||
            (SELECT COUNT(*) || ':' || COALESCE(MAX(updated_at), 0) FROM body_metrics) AS v`,
    [],
    ['food_log_entries', 'body_metrics'],
  );
  const [days, setDays] = useState<(DayTotals & { target: Targets | null })[]>([]);
  const [weeks, setWeeks] = useState<{ week_start: string; avg_kcal: number | null; weight_kg: number | null }[]>([]);
  const [showWeight, setShowWeight] = useState(false);
  const today = toLocalDateKey(new Date());

  useEffect(() => {
    void chartDays(today).then(setDays);
    void weightVsCalories(today).then(setWeeks);
  }, [version[0]?.v, nutrition, today]);

  const todayTarget = getTargetsForDate(today);
  // Finished days with something logged; today is still in progress.
  const logged = days.filter((d) => d.local_date !== today && d.kcal > 0);
  const avg = logged.length ? logged.reduce((s, d) => s + d.kcal, 0) / logged.length : null;
  const over = logged.filter((d) => d.target && d.kcal > d.target.kcal).length;
  const proteinHit = logged.filter((d) => d.target && d.protein_g >= d.target.protein_g).length;
  const max = Math.max(1, ...days.map((d) => d.kcal), ...days.map((d) => d.target?.kcal ?? 0)) * 1.1;
  const targetY = todayTarget ? (todayTarget.kcal / max) * MINI_H : null;

  return (
    <View className="mt-2 gap-2">
      <View className="flex-row items-baseline justify-between px-1">
        <Text className="text-base font-semibold text-ink">
          Nutrition <Text className="text-sm font-normal text-ink-muted">last 7 days</Text>
        </Text>
        <Pressable onPress={() => setShowWeight((v) => !v)} hitSlop={10}>
          <Text className="text-sm text-ink-muted">{showWeight ? 'Hide weight trend' : 'Weight trend'}</Text>
        </Pressable>
      </View>

      <View className="flex-row items-center gap-5 rounded-[20px] bg-surface-raised px-5 py-4">
        <View className="flex-1 gap-1">
          {avg === null ? (
            <Text className="text-sm text-ink-muted">Log food to see how your week is going.</Text>
          ) : (
            <>
              <Text className="text-[22px] font-medium leading-7 tabular-nums text-ink">
                {n0(avg)} <Text className="text-[13px] text-ink-muted">kcal a day</Text>
              </Text>
              {todayTarget && (
                <Text className="text-[13px] text-ink-muted">
                  Target {n0(todayTarget.kcal)}. Over on {over} of {logged.length} days.
                </Text>
              )}
              {todayTarget && (
                <Text className="text-[13px] text-ink-muted">
                  Protein target hit on {proteinHit} of {logged.length} days.
                </Text>
              )}
            </>
          )}
        </View>
        <View className="w-28 gap-1">
          <View style={{ height: MINI_H }} className="flex-row items-end gap-1">
            {targetY !== null && (
              <View className="absolute left-0 right-0 border-t border-dashed border-ink-muted" style={{ bottom: targetY }} />
            )}
            {days.map((d) => {
              const isToday = d.local_date === today;
              const isOver = d.target !== null && d.kcal > d.target.kcal;
              return (
                <View
                  key={d.local_date}
                  className={`flex-1 rounded-sm ${isToday ? 'border border-dashed border-ink-muted' : isOver ? 'bg-settype-failure' : 'bg-ink-faint'}`}
                  style={{ height: Math.max(isToday ? 3 : 0, (d.kcal / max) * MINI_H) }}
                />
              );
            })}
          </View>
          <View className="flex-row gap-1">
            {days.map((d) => (
              <Text key={d.local_date} className="flex-1 text-center text-[11px] text-ink-muted">
                {dayLetter(d.local_date)}
              </Text>
            ))}
          </View>
        </View>
      </View>

      {showWeight && (
        <View className="gap-2 rounded-[20px] bg-surface-raised p-4">
          <View>
            <Text className="font-semibold text-ink">Weight vs calories</Text>
            <Text className="text-xs text-ink-muted">Last 8 weeks: weight as the line, average calories a day as bars</Text>
          </View>
          <WeightVsCalories weeks={weeks} format={(kg) => units.format(kg, 1)} />
        </View>
      )}
    </View>
  );
}

function WeightVsCalories({ weeks, format }: { weeks: { week_start: string; avg_kcal: number | null; weight_kg: number | null }[]; format: (kg: number) => string }) {
  const [width, setWidth] = useState(0);
  if (!weeks.some((w) => w.avg_kcal !== null || w.weight_kg !== null)) return <Text className="text-sm text-ink-subtle">Log food and weigh-ins to compare them.</Text>;
  const slot = width / Math.max(1, weeks.length);
  const maxKcal = Math.max(1, ...weeks.map((w) => w.avg_kcal ?? 0)) * 1.1;
  const ws = weeks.map((w) => w.weight_kg).filter((v): v is number => v !== null);
  const minW = Math.min(...ws);
  const spanW = Math.max(0.5, Math.max(...ws) - minW);
  const yW = (v: number) => 8 + (1 - (v - minW) / spanW) * (H * 0.55);
  const points = weeks.map((w, i) => (w.weight_kg === null ? null : { x: i * slot + slot / 2, y: yW(w.weight_kg) })).filter((p): p is { x: number; y: number } => p !== null);
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={H}>
          {weeks.map((w, i) =>
            w.avg_kcal === null ? null : (
              <Rect key={w.week_start} x={i * slot + slot * 0.15} y={H - (w.avg_kcal / maxKcal) * H} width={slot * 0.7} height={(w.avg_kcal / maxKcal) * H} rx={3} fill={colors.elevated} />
            ),
          )}
          {points.length > 1 && <Polyline points={points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={colors.accent} strokeWidth={2.5} />}
          {points.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={3} fill={colors.accent} />
          ))}
        </Svg>
      )}
      {ws.length > 0 && (
        <View className="flex-row justify-between">
          <Text className="text-[11px] text-ink-subtle">{format(ws[0]!)}</Text>
          <Text className="text-[11px] text-ink-subtle">{format(ws[ws.length - 1]!)}</Text>
        </View>
      )}
    </View>
  );
}
