import { useEffect, useMemo, useState } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { addDaysToKey, toLocalDateKey, weekStartKey } from '@gym/shared';
import { HISTORY_SQL, namesPreview, type HistorySession } from '../db/repositories/stats';
import { useLiveQuery } from '../db/useLiveQuery';
import { useNextPlanDay } from '../hooks/usePlan';
import { getSessionPRCount } from '../services/prEngine';
import { useUnits } from '../state/settingsStore';
import { SegmentedControl } from '../components/SegmentedControl';
import { StatsView } from './AnalyticsScreen';
import BodyScreen from './BodyScreen';

type HistoryView = 'workouts' | 'stats' | 'body';
const VIEWS = [
  { value: 'workouts', label: 'Workouts' },
  { value: 'stats', label: 'Stats' },
  { value: 'body', label: 'Body' },
] as const;

/** History tab: finished workouts, Stats (formerly the Analytics tab) and Body (weigh-ins, targets). */
export default function HistoryScreen() {
  const params = useLocalSearchParams<{ view?: string; at?: string }>();
  const [view, setView] = useState<HistoryView>('workouts');
  // The Food tab's "Set up your targets" opens History → Body.
  useEffect(() => {
    if (params.view === 'body' || params.view === 'stats' || params.view === 'workouts') setView(params.view);
  }, [params.view, params.at]);
  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <Text className="px-5 pt-5 text-2xl font-bold text-ink">History</Text>
      <SegmentedControl value={view} options={VIEWS} onChange={setView} className="mx-4 my-3" />
      {view === 'workouts' && <WorkoutsList />}
      {view === 'stats' && <StatsView />}
      {view === 'body' && <BodyScreen />}
    </SafeAreaView>
  );
}

interface Week {
  key: string;
  title: string;
  data: HistorySession[];
}

const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Finished workouts grouped by Monday week, newest first; the current week is always shown. */
function WorkoutsList() {
  const units = useUnits();
  const next = useNextPlanDay();
  const { data } = useLiveQuery<HistorySession>(HISTORY_SQL, [], [
    'workout_sessions',
    'session_exercises',
    'sets',
    'exercise_definitions',
  ]);
  const todayKey = toLocalDateKey(new Date());
  const thisWeek = weekStartKey(todayKey);
  // Bumps when any logged set changes, so PR badges recompute after edits to older workouts.
  const version = useMemo(() => data.map((r) => `${r.sets_done}:${r.volume_kg}`).join(','), [data]);

  const weeks = useMemo(() => {
    const out: Week[] = [{ key: thisWeek, title: 'This week', data: [] }];
    for (const row of data) {
      const key = weekStartKey(toLocalDateKey(new Date(row.start_time)));
      let week = out[out.length - 1]!;
      if (week.key !== key) {
        week = { key, title: weekTitle(key), data: [] };
        out.push(week);
      }
      week.data.push(row);
    }
    return out;
  }, [data, thisWeek]);

  return (
    <SectionList
      sections={weeks}
      keyExtractor={(r) => r.id}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
      renderSectionHeader={({ section }) => (
        <WeekHeader
          week={section}
          todayKey={todayKey}
          format={(kg) => units.format(kg, 0)}
          emptyHint={next ? `Nothing logged yet. ${next.day.name} is next.` : 'Nothing logged yet.'}
        />
      )}
      renderItem={({ item, index, section }) => (
        <WorkoutRow
          item={item}
          first={index === 0}
          last={index === section.data.length - 1}
          version={version}
          volume={units.format(item.volume_kg, 0)}
          distance={item.distance_m > 0 ? `${units.displayDistance(item.distance_m)} ${units.distanceLabel}` : null}
        />
      )}
    />
  );
}

/** "19–25 Oct", or "28 Sep – 4 Oct" across months. */
function weekTitle(monday: string): string {
  const date = (key: string) => {
    const [y, m, d] = key.split('-').map(Number) as [number, number, number];
    return new Date(y, m - 1, d, 12);
  };
  const a = date(monday);
  const b = date(addDaysToKey(monday, 6));
  const month = (d: Date) => d.toLocaleDateString(undefined, { month: 'short' });
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${month(b)}`
    : `${a.getDate()} ${month(a)} – ${b.getDate()} ${month(b)}`;
}

function WeekHeader({
  week,
  todayKey,
  format,
  emptyHint,
}: {
  week: Week;
  todayKey: string;
  format: (kg: number) => string;
  emptyHint: string;
}) {
  const n = week.data.length;
  const trained = new Set(week.data.map((r) => toLocalDateKey(new Date(r.start_time))));
  const volume = week.data.reduce((s, r) => s + r.volume_kg, 0);
  return (
    <View className="mb-2 mt-5 gap-2">
      <View className="flex-row items-end justify-between gap-3 px-1">
        <View className="gap-0.5">
          <Text className="text-base font-semibold text-ink">{week.title}</Text>
          <Text className="text-[13px] text-ink-muted">
            {n === 0 ? 'No workouts yet' : `${n} workout${n === 1 ? '' : 's'} · ${format(volume)}`}
          </Text>
        </View>
        <View className="flex-row gap-1" accessibilityLabel={`${trained.size} training days`}>
          {WEEKDAY_LETTERS.map((letter, i) => {
            const key = addDaysToKey(week.key, i);
            const done = trained.has(key);
            const isToday = key === todayKey;
            const future = key > todayKey;
            return (
              <View key={key} className="w-[18px] items-center gap-1">
                <Text className={`text-[11px] ${isToday ? 'text-ink' : future ? 'text-ink-faint' : 'text-ink-muted'}`}>{letter}</Text>
                <View
                  className={`h-2.5 w-2.5 rounded-full ${
                    done ? 'bg-accent' : isToday ? 'border-2 border-ink' : future ? 'border border-surface-border' : 'bg-surface-border'
                  }`}
                />
              </View>
            );
          })}
        </View>
      </View>
      {n === 0 && (
        <Pressable
          onPress={() => router.navigate('/')}
          className="flex-row items-center gap-3 rounded-[20px] bg-surface-raised p-4 active:opacity-80"
        >
          <Text className="flex-1 text-sm text-ink-muted">{emptyHint}</Text>
          <Text className="text-sm font-semibold text-accent">Start</Text>
        </Pressable>
      )}
    </View>
  );
}

function WorkoutRow({
  item,
  first,
  last,
  version,
  volume,
  distance,
}: {
  item: HistorySession;
  first: boolean;
  last: boolean;
  version: string;
  volume: string;
  distance: string | null;
}) {
  const [prs, setPrs] = useState(0);
  useEffect(() => {
    let live = true;
    void getSessionPRCount(item.id).then((n) => live && setPrs(n));
    return () => {
      live = false;
    };
  }, [item.id, version]);

  const start = new Date(item.start_time);
  const minutes = Math.round((item.end_time - item.start_time) / 60_000);
  const stats = [`${minutes} min`, `${item.sets_done} sets`, item.volume_kg > 0 || !distance ? volume : distance];
  if (item.volume_kg > 0 && distance) stats.push(distance);

  return (
    <Pressable
      onPress={() => router.push(`/workout/${item.id}`)}
      className={`flex-row items-start gap-3.5 bg-surface-raised px-4 py-3 active:bg-surface-elevated ${
        first ? 'rounded-t-[20px] pt-4' : 'border-t border-surface-elevated'
      } ${last ? 'rounded-b-[20px] pb-4' : ''}`}
      accessibilityLabel={`${item.title ?? 'Workout'}, ${start.toDateString()}. Tap for details`}
    >
      <View className="w-[34px] items-center pt-px">
        <Text className="text-xs text-ink-muted">{start.toLocaleDateString(undefined, { weekday: 'short' })}</Text>
        <Text className="text-xl font-semibold leading-6 text-ink">{start.getDate()}</Text>
      </View>
      <View className="flex-1 gap-[3px]">
        <View className="flex-row items-center gap-2">
          <Text className="shrink text-base font-semibold text-ink" numberOfLines={1}>
            {item.title ?? 'Workout'}
          </Text>
          {prs > 0 && (
            <View className="h-5 justify-center rounded-full bg-pr/15 px-2">
              <Text className="text-xs font-semibold text-pr">
                {prs} PR{prs === 1 ? '' : 's'}
              </Text>
            </View>
          )}
        </View>
        {!!item.names && (
          <Text className="text-[13px] text-ink-muted" numberOfLines={1}>
            {namesPreview(item.names)}
          </Text>
        )}
        <Text className="text-[13px] tabular-nums text-ink-subtle">{stats.join(' · ')}</Text>
      </View>
    </Pressable>
  );
}
