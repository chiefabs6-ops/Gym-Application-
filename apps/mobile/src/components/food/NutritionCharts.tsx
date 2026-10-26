import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { toLocalDateKey, type MacroTotals, type Targets } from '@gym/shared';
import { useLiveQuery } from '../../db/useLiveQuery';
import { getTargetsForDate } from '../../db/repositories/body';
import { chartDays, weeklyAverages, weightVsCalories, type DayTotals } from '../../db/repositories/nutritionStats';
import { useSettingsStore, useUnits } from '../../state/settingsStore';
import { colors } from '../../theme';

const H = 120;
const n0 = (v: number) => Math.round(v).toLocaleString();
const dayLetter = (key: string) => {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12).toLocaleDateString(undefined, { weekday: 'narrow' });
};

/** The four nutrition charts in History → Stats (spec §8.5). */
export function NutritionCharts() {
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
  const [averages, setAverages] = useState<({ days: number } & MacroTotals) | null>(null);
  const [weeks, setWeeks] = useState<{ week_start: string; avg_kcal: number | null; weight_kg: number | null }[]>([]);
  const today = toLocalDateKey(new Date());

  useEffect(() => {
    void chartDays(today).then(setDays);
    void weeklyAverages(today).then(setAverages);
    void weightVsCalories(today).then(setWeeks);
  }, [version[0]?.v, nutrition, today]);

  const todayTarget = getTargetsForDate(today);
  const proteinHit = days.filter((d) => d.local_date !== today && d.kcal > 0 && d.target && d.protein_g >= d.target.protein_g).length;
  const proteinDays = days.filter((d) => d.local_date !== today && d.kcal > 0).length;

  return (
    <View className="gap-4">
      <Text className="text-sm uppercase tracking-wider text-ink-muted">Nutrition</Text>

      <Card title="Calories this week" subtitle={todayTarget ? `Target ${n0(todayTarget.kcal)} kcal` : undefined}>
        <DayBars days={days} today={today} value={(d) => d.kcal} target={(d) => d.target?.kcal ?? null} color={colors.accent} />
        <Legend items={[{ color: colors.accent, label: 'within target' }, { color: colors.danger, label: 'over' }, { color: colors.faint, label: 'today so far' }]} />
      </Card>

      <Card title="Protein this week" subtitle={todayTarget ? `Target ${n0(todayTarget.protein_g)} g` : undefined}>
        <DayBars days={days} today={today} value={(d) => d.protein_g} target={(d) => d.target?.protein_g ?? null} color={colors.protein} redWhenOver={false} />
        {proteinDays > 0 && <Text className="text-xs text-ink-subtle">Hit target on {proteinHit} of {proteinDays} days</Text>}
      </Card>

      <Card title="Weekly averages" subtitle={averages ? `Last 7 days (${averages.days} logged)` : undefined}>
        {averages && averages.days > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            <Average label="Calories" value={averages.kcal} target={todayTarget?.kcal} unit="" color={colors.accent} />
            <Average label="Protein" value={averages.protein_g} target={todayTarget?.protein_g} unit=" g" color={colors.protein} />
            <Average label="Carbs" value={averages.carbs_g} target={todayTarget?.carbs_g} unit=" g" color={colors.carbs} />
            <Average label="Fat" value={averages.fat_g} target={todayTarget?.fat_g} unit=" g" color={colors.fat} />
          </View>
        ) : (
          <Text className="text-sm text-ink-subtle">Log food to see your averages.</Text>
        )}
      </Card>

      <Card title="Weight vs calories" subtitle="Last 8 weeks">
        <WeightVsCalories weeks={weeks} format={(kg) => units.format(kg, 1)} />
        <Legend items={[{ color: colors.accent, label: 'weight' }, { color: colors.elevated, label: 'avg calories / day' }]} />
      </Card>
    </View>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View className="gap-2 rounded-card bg-surface-raised p-4">
      <View>
        <Text className="font-semibold text-ink">{title}</Text>
        {subtitle && <Text className="text-xs text-ink-subtle">{subtitle}</Text>}
      </View>
      {children}
    </View>
  );
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <View className="flex-row flex-wrap gap-3">
      {items.map((i) => (
        <View key={i.label} className="flex-row items-center gap-1">
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: i.color }} />
          <Text className="text-[11px] text-ink-subtle">{i.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** A bar per day; the target as a dashed line per day (each day's own target). */
function DayBars({
  days,
  today,
  value,
  target,
  color,
  redWhenOver = true,
}: {
  days: (DayTotals & { target: Targets | null })[];
  today: string;
  value: (d: DayTotals) => number;
  target: (d: DayTotals & { target: Targets | null }) => number | null;
  color: string;
  /** Protein: false (going over isn't a problem; user decision). */
  redWhenOver?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const max = Math.max(1, ...days.map(value), ...days.map((d) => target(d) ?? 0)) * 1.1;
  const slot = width / Math.max(1, days.length);
  const y = (v: number) => H - (v / max) * H;
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={H}>
          {days.map((d, i) => {
            const v = value(d);
            const t = target(d);
            const isToday = d.local_date === today;
            const over = redWhenOver && t !== null && v > t;
            const fill = isToday ? colors.faint : over ? colors.danger : color;
            return (
              <Rect key={d.local_date} x={i * slot + slot * 0.2} y={y(v)} width={slot * 0.6} height={H - y(v)} rx={3} fill={fill} />
            );
          })}
          {days.map((d, i) => {
            const t = target(d);
            return t === null ? null : <Line key={`t-${d.local_date}`} x1={i * slot + 2} x2={(i + 1) * slot - 2} y1={y(t)} y2={y(t)} stroke={colors.muted} strokeDasharray="4 3" />;
          })}
        </Svg>
      )}
      <View className="flex-row">
        {days.map((d) => (
          <Text key={d.local_date} className="flex-1 text-center text-[11px] text-ink-subtle">
            {dayLetter(d.local_date)}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Average({ label, value, target, unit, color }: { label: string; value: number; target?: number; unit: string; color: string }) {
  const over = target !== undefined && value > target;
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  return (
    <View className="min-w-[45%] flex-1 gap-1 rounded-xl bg-surface-elevated p-3">
      <Text className="text-xs text-ink-muted">{label}</Text>
      <Text className="tabular-nums text-ink">
        <Text className="text-lg font-bold">{n0(value)}</Text>
        {unit}
        {target !== undefined && <Text className="text-ink-subtle"> / {n0(target)}</Text>}
      </Text>
      {target !== undefined && (
        <View className="h-1.5 overflow-hidden rounded-full bg-surface">
          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: over ? colors.danger : color }} />
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
