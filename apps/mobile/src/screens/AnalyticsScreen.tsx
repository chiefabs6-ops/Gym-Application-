import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { kgToLb, percentChange, toLocalDateKey, weeklyTraining } from '@gym/shared';
import { HISTORY_SQL, strengthProgress, type HistorySession, type LiftProgress } from '../db/repositories/stats';
import { useLiveQuery } from '../db/useLiveQuery';
import { getSessionPRCount } from '../services/prEngine';
import { useUnits } from '../state/settingsStore';
import { NutritionSummary } from '../components/food/NutritionCharts';
import { shortDay } from '../components/dates';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKS = 8;
const CHART_H = 140;
/** A lift's best set counts as a recent PR for two weeks. */
const RECENT_PR_MS = 14 * DAY_MS;
const LIFTS_SHOWN = 5;

/** History → Stats: training volume by week, the last 4 weeks in figures, strength per lift, nutrition. */
export function StatsView() {
  const units = useUnits();
  const { data: sessions } = useLiveQuery<HistorySession>(HISTORY_SQL, [], [
    'workout_sessions',
    'session_exercises',
    'sets',
    'exercise_definitions',
  ]);
  const todayKey = toLocalDateKey(new Date());
  const weeks = useMemo(() => weeklyTraining(sessions, todayKey, WEEKS), [sessions, todayKey]);
  const version = useMemo(() => sessions.map((r) => `${r.sets_done}:${r.volume_kg}`).join(','), [sessions]);

  // The last complete week against the four before it.
  const lastWeek = weeks[WEEKS - 1]!;
  const prior = weeks.slice(WEEKS - 5, WEEKS - 1);
  const change = percentChange(lastWeek.volume_kg, prior.reduce((s, w) => s + w.volume_kg, 0) / prior.length);

  // Last 4 complete weeks: Monday of 4 weeks ago up to the start of this week.
  const windowStart = weeks[WEEKS - 4]!.week_start;
  const thisWeek = weeks[WEEKS]!.week_start;
  const recent = sessions.filter((s) => {
    const key = toLocalDateKey(new Date(s.start_time));
    return key >= windowStart && key < thisWeek;
  });
  const avgMinutes = recent.length
    ? Math.round(recent.reduce((s, r) => s + (r.end_time - r.start_time), 0) / recent.length / 60_000)
    : null;
  const [prCount, setPrCount] = useState<number | null>(null);
  const recentIds = recent.map((r) => r.id).join(',');
  useEffect(() => {
    let live = true;
    const ids = recentIds ? recentIds.split(',') : [];
    void Promise.all(ids.map(getSessionPRCount)).then((n) => live && setPrCount(n.reduce((s, v) => s + v, 0)));
    return () => {
      live = false;
    };
  }, [recentIds, version]);

  const [lifts, setLifts] = useState<LiftProgress[]>([]);
  const [allLifts, setAllLifts] = useState(false);
  useEffect(() => {
    void strengthProgress(Date.now() - WEEKS * 7 * DAY_MS).then(setLifts);
  }, [version]);

  const display = (kg: number) => (units.unit === 'imperial' ? kgToLb(kg) : kg);
  const maxVolume = Math.max(...weeks.map((w) => w.volume_kg));
  const step = niceStep(display(maxVolume) / 2);
  const top = Math.max(step * 2, step * Math.ceil(display(maxVolume) / step));
  const barHeight = (kg: number) => (top > 0 ? (display(kg) / top) * CHART_H : 0);
  const ticks = [top, top / 2];

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 14 }}>
      <View className="gap-4 rounded-[20px] bg-surface-raised p-5">
        <View className="flex-row items-baseline justify-between">
          <Text className="text-base font-semibold text-ink">Training volume</Text>
          <Text className="text-[13px] text-ink-muted">Last {WEEKS} weeks</Text>
        </View>
        <View className="gap-0.5">
          <Text className="text-[32px] font-bold leading-[38px] tabular-nums text-ink">
            {Number(units.display(lastWeek.volume_kg, 0) || 0).toLocaleString()}{' '}
            <Text className="text-base font-normal text-ink-muted">{units.label}</Text>
          </Text>
          <Text className="text-sm text-ink-muted">
            Last week{change !== null ? '. ' : '.'}
            {change !== null && (
              <>
                <Text className={`font-semibold ${change > 0 ? 'text-accent' : 'text-ink'}`}>
                  {change > 0 ? '+' : change < 0 ? '−' : ''}
                  {Math.abs(change)}%
                </Text>{' '}
                on the 4 weeks before.
              </>
            )}
          </Text>
        </View>

        <View className="flex-row gap-2">
          <View className="flex-1 gap-1.5">
            <View style={{ height: CHART_H }} className="flex-row items-end gap-1.5">
              {ticks.map((t) => (
                <View
                  key={t}
                  className="absolute left-0 right-0 border-t border-dashed border-surface-border"
                  style={{ bottom: (t / top) * CHART_H }}
                />
              ))}
              {weeks.map((w, i) => {
                const current = i === WEEKS;
                return (
                  <View
                    key={w.week_start}
                    className={`flex-1 rounded-t ${
                      current ? 'border border-dashed border-ink-faint' : i === WEEKS - 1 ? 'bg-accent' : 'bg-accent-muted'
                    }`}
                    style={{ height: Math.max(current ? 4 : 0, barHeight(w.volume_kg)) }}
                  />
                );
              })}
            </View>
            <View className="flex-row gap-1.5">
              {weeks.map((w) => (
                <Text key={w.week_start} className="flex-1 text-center text-xs tabular-nums text-ink-muted">
                  {w.workouts}
                </Text>
              ))}
            </View>
            <View className="flex-row justify-between">
              <Text className="text-[11px] text-ink-muted">{dayMonth(weeks[0]!.week_start)}</Text>
              <Text className="text-[11px] text-ink-muted">{dayMonth(weeks[WEEKS / 2]!.week_start)}</Text>
              <Text className="text-[11px] text-ink-muted">This week</Text>
            </View>
          </View>
          <View style={{ width: 30, height: CHART_H }}>
            {ticks.map((t) => (
              <Text key={t} className="absolute text-[11px] text-ink-muted" style={{ bottom: (t / top) * CHART_H - 6 }}>
                {abbreviate(t)}
              </Text>
            ))}
          </View>
        </View>
        <Text className="-mt-2 text-xs text-ink-muted">Numbers under the bars are workouts that week.</Text>
      </View>

      <View>
        <View className="flex-row rounded-[20px] bg-surface-raised py-3.5">
          <Figure label="Workouts" value={String(recent.length)} />
          <Figure label="PRs" value={prCount === null ? '–' : String(prCount)} divided />
          <Figure label="Avg session" value={avgMinutes === null ? '–' : String(avgMinutes)} unit=" min" divided />
        </View>
        <Text className="mt-1.5 px-1 text-xs text-ink-muted">Last 4 weeks, {dayMonth(windowStart)} to last Sunday</Text>
      </View>

      <View className="mt-2 gap-2">
        <View className="flex-row items-baseline justify-between px-1">
          <Text className="text-base font-semibold text-ink">
            Strength <Text className="text-sm font-normal text-ink-muted">est. 1-rep max</Text>
          </Text>
          {lifts.length > LIFTS_SHOWN && (
            <Pressable onPress={() => setAllLifts((v) => !v)} hitSlop={10}>
              <Text className="text-sm text-ink-muted">{allLifts ? 'Show fewer' : `All ${lifts.length}`}</Text>
            </Pressable>
          )}
        </View>
        {lifts.length === 0 ? (
          <View className="rounded-[20px] bg-surface-raised p-4">
            <Text className="text-sm text-ink-muted">Log weight × reps sets to see your strength here.</Text>
          </View>
        ) : (
          <View className="rounded-[20px] bg-surface-raised py-1">
            {(allLifts ? lifts : lifts.slice(0, LIFTS_SHOWN)).map((l, i) => (
              <LiftRow key={l.exercise_id} lift={l} first={i === 0} />
            ))}
          </View>
        )}
      </View>

      <NutritionSummary />
    </ScrollView>
  );
}

function LiftRow({ lift, first }: { lift: LiftProgress; first: boolean }) {
  const units = useUnits();
  const recentPR = lift.had_prior === 1 && Date.now() - lift.best_at < RECENT_PR_MS;
  const delta = lift.before_e1rm === null ? null : lift.e1rm - lift.before_e1rm;
  const deltaText =
    delta === null ? 'New' : Math.abs(delta) < 0.05 ? 'No change' : `${delta > 0 ? '+' : '−'}${units.format(Math.abs(delta))}`;
  return (
    <View className={`flex-row items-center gap-3 px-4 py-3 ${first ? '' : 'border-t border-surface-elevated'}`}>
      <View className="flex-1 gap-[3px]">
        <View className="flex-row items-center gap-2">
          <Text className="shrink text-base font-medium text-ink" numberOfLines={1}>
            {lift.name}
          </Text>
          {recentPR && (
            <View className="h-5 justify-center rounded-full bg-pr/15 px-2">
              <Text className="text-xs font-semibold text-pr">PR</Text>
            </View>
          )}
        </View>
        <Text className="text-[13px] tabular-nums text-ink-muted">
          {units.format(lift.weight_kg)} × {lift.reps} · {shortDay(lift.best_at)}
        </Text>
      </View>
      <View className="items-end gap-[3px]">
        <Text className="text-base font-semibold tabular-nums text-ink">
          {units.display(lift.e1rm, 1)} <Text className="text-[13px] font-normal text-ink-muted">{units.label}</Text>
        </Text>
        <Text className={`text-[13px] tabular-nums ${delta !== null && delta >= 0.05 ? 'text-accent' : 'text-ink-muted'}`}>
          {deltaText}
        </Text>
      </View>
    </View>
  );
}

function Figure({ label, value, unit, divided }: { label: string; value: string; unit?: string; divided?: boolean }) {
  return (
    <View className={`flex-1 gap-0.5 px-4 ${divided ? 'border-l border-surface-border' : ''}`}>
      <Text className="text-xs text-ink-muted">{label}</Text>
      <Text className="text-[22px] font-medium leading-7 tabular-nums text-ink">
        {value}
        {unit && <Text className="text-[13px] text-ink-muted">{unit}</Text>}
      </Text>
    </View>
  );
}

/** 1, 2, 2.5 or 5 × a power of ten at or above `x`, for round gridlines. */
function niceStep(x: number): number {
  if (x <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(x));
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= x) ?? 10) * p;
}

const abbreviate = (v: number) => (v >= 1000 ? `${Number((v / 1000).toFixed(1))}k` : String(Math.round(v)));

const dayMonth = (key: string) => {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

