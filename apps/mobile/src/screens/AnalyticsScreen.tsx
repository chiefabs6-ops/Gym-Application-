import { ScrollView, Text, View } from 'react-native';
import { volumeTypeSql } from '@gym/shared';
import { useLiveQuery } from '../db/useLiveQuery';
import { useUnits } from '../state/settingsStore';
import { NutritionCharts } from '../components/food/NutritionCharts';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Shared filter for loaded sets that count toward volume and strength stats (weight × reps exercises and
 * added weight on bodyweight ones). Mirrors countsTowardRecords() / countsTowardVolume() in @gym/shared.
 */
const COUNTED_SETS = `
  s.is_completed = 1 AND s.set_type <> 'warmup' AND s.weight_kg > 0 AND s.reps > 0 AND ${volumeTypeSql('e')}
  AND s.deleted_at IS NULL AND se.deleted_at IS NULL AND ws.deleted_at IS NULL`;

/** History → Stats (formerly the Analytics tab). Content only: History owns the safe area and title. */
export function StatsView() {
  const { data: weekly } = useLiveQuery<{ week: number; volume: number }>(
    `SELECT CAST(ws.start_time / ${WEEK_MS} AS INTEGER) AS week, SUM(s.weight_kg * s.reps) AS volume
     FROM sets s
     JOIN session_exercises se ON se.id = s.session_exercise_id
     JOIN workout_sessions ws ON ws.id = se.session_id
     JOIN exercise_definitions e ON e.id = se.exercise_id
     WHERE ${COUNTED_SETS}
     GROUP BY week ORDER BY week DESC LIMIT 8`,
    [],
    ['sets', 'workout_sessions', 'exercise_definitions'],
  );

  const { data: bests } = useLiveQuery<{ id: string; name: string; e1rm: number; max_weight: number; sets: number }>(
    `SELECT e.id, e.name,
            MAX(s.weight_kg * (1 + s.reps / 30.0)) AS e1rm,
            MAX(s.weight_kg) AS max_weight,
            COUNT(*) AS sets
     FROM sets s
     JOIN session_exercises se ON se.id = s.session_exercise_id
     JOIN workout_sessions ws ON ws.id = se.session_id
     JOIN exercise_definitions e ON e.id = se.exercise_id
     WHERE ${COUNTED_SETS} AND e.tracking_type = 'weight_reps'
     GROUP BY e.id ORDER BY sets DESC LIMIT 15`,
    [],
    ['sets', 'exercise_definitions'],
  );

  const units = useUnits();
  const maxVolume = Math.max(1, ...weekly.map((w) => w.volume));

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 24 }}>

        <View className="gap-2">
          <Text className="text-sm uppercase tracking-wider text-ink-muted">Weekly volume</Text>
          {weekly.length === 0 && <Text className="text-ink-subtle">Complete a workout to see trends.</Text>}
          {[...weekly].reverse().map((w) => (
            <View key={w.week} className="flex-row items-center gap-3">
              <Text className="w-16 text-xs text-ink-muted">
                {new Date(w.week * WEEK_MS).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>
              <View className="h-4 flex-1 overflow-hidden rounded bg-surface-raised">
                <View className="h-full rounded bg-accent" style={{ width: `${(w.volume / maxVolume) * 100}%` }} />
              </View>
              <Text className="w-20 text-right text-xs tabular-nums text-ink">
                {units.format(w.volume, 0)}
              </Text>
            </View>
          ))}
        </View>

        <View className="gap-2">
          <Text className="text-sm uppercase tracking-wider text-ink-muted">Personal bests</Text>
          {bests.map((b) => (
            <View key={b.id} className="flex-row items-center justify-between rounded-lg bg-surface-raised px-4 py-3">
              <View className="flex-1">
                <Text className="text-ink">{b.name}</Text>
                <Text className="text-xs text-ink-subtle">{b.sets} sets logged</Text>
              </View>
              <View className="items-end">
                <Text className="font-semibold tabular-nums text-pr">{units.format(b.e1rm)} e1RM</Text>
                <Text className="text-xs tabular-nums text-ink-muted">top {units.format(b.max_weight)}</Text>
              </View>
            </View>
          ))}
        </View>
      <NutritionCharts />
    </ScrollView>
  );
}
