import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { volumeTypeSql } from '@gym/shared';
import { useLiveQuery } from '../db/useLiveQuery';
import { useUnits } from '../state/settingsStore';
import { colors } from '../theme';

interface HistoryRow {
  id: string;
  title: string | null;
  start_time: number;
  end_time: number;
  exercises: number;
  sets_done: number;
  volume_kg: number;
}

export default function HistoryScreen() {
  const units = useUnits();
  const { data } = useLiveQuery<HistoryRow>(
    `SELECT ws.id, ws.title, ws.start_time, ws.end_time,
            COUNT(DISTINCT se.id) AS exercises,
            COALESCE(SUM(s.is_completed), 0) AS sets_done,
            COALESCE(SUM(CASE WHEN s.is_completed = 1 AND s.set_type <> 'warmup' AND ${volumeTypeSql('e')}
                              THEN s.weight_kg * s.reps END), 0) AS volume_kg
     FROM workout_sessions ws
     LEFT JOIN session_exercises se ON se.session_id = ws.id AND se.deleted_at IS NULL
     LEFT JOIN exercise_definitions e ON e.id = se.exercise_id
     LEFT JOIN sets s ON s.session_exercise_id = se.id AND s.deleted_at IS NULL
     WHERE ws.end_time IS NOT NULL AND ws.deleted_at IS NULL
     GROUP BY ws.id
     ORDER BY ws.start_time DESC
     LIMIT 200`,
    [],
    ['workout_sessions', 'session_exercises', 'sets', 'exercise_definitions'],
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <Text className="p-4 text-2xl font-bold text-ink">History</Text>
      <FlatList
        data={data}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 8 }}
        ListEmptyComponent={<Text className="text-ink-subtle">No finished workouts yet.</Text>}
        renderItem={({ item }) => {
          const minutes = Math.round((item.end_time - item.start_time) / 60_000);
          return (
            <Pressable
              onPress={() => router.push(`/workout/${item.id}`)}
              className="rounded-xl bg-surface-raised p-4 active:opacity-80"
              accessibilityLabel={`${item.title ?? 'Workout'}. Tap for details`}
            >
              <View className="flex-row items-center gap-2">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-ink">{item.title ?? 'Workout'}</Text>
                  <Text className="text-xs text-ink-muted">{new Date(item.start_time).toLocaleString()}</Text>
                </View>
                <ChevronRight size={18} color={colors.faint} />
              </View>
              <View className="mt-3 flex-row gap-6">
                <Stat label="Duration" value={`${minutes}m`} />
                <Stat label="Exercises" value={String(item.exercises)} />
                <Stat label="Sets" value={String(item.sets_done)} />
                <Stat label="Volume" value={units.format(item.volume_kg, 0)} />
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-xs text-ink-subtle">{label}</Text>
      <Text className="font-semibold text-ink">{value}</Text>
    </View>
  );
}
