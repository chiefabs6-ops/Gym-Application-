import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { ChevronLeft, ChevronRight, Dumbbell, Flag, ListOrdered, Play, Plus } from 'lucide-react-native';
import {
  formatRepTarget,
  isLinkedWithNext,
  linkWithNext,
  supersetLabels,
  supersetMembers,
  unlinkFromNext,
  type PlanDay,
  type TemplateExercise,
  type TrackingType,
} from '@gym/shared';
import { BackupReminder } from '../components/BackupReminder';
import { BottomSheet } from '../components/BottomSheet';
import { ExerciseFocusCard, type SessionExerciseView } from '../components/ExerciseFocusCard';
import { ExerciseSelector } from '../components/ExerciseSelector';
import { FinishWorkoutSheet } from '../components/FinishWorkoutSheet';
import { IntervalRunBanner } from '../components/IntervalRunBanner';
import { PlanDaySheet } from '../components/PlanDaySheet';
import { RestTimerBanner } from '../components/RestTimerModal';
import { SaveRoutineSheet } from '../components/SaveRoutineSheet';
import { SetTypeSheet } from '../components/SetTypeSheet';
import type { SetViewRow } from '../components/SetRow';
import { WorkoutOverviewSheet } from '../components/WorkoutOverviewSheet';
import {
  reorderSessionExercise,
  removeSessionExercise,
  replaceSessionExercise,
  setSessionSupersets,
} from '../db/repositories/workouts';
import { useLiveQuery } from '../db/useLiveQuery';
import { useDayRoutines, usePlanCycle, type PlanCycleView } from '../hooks/usePlan';
import { namesPreview } from '../db/repositories/stats';
import { dayAndDate, shortDay, whenText } from '../components/dates';
import { useIntervalRunStore } from '../state/intervalRunStore';
import { useActiveWorkoutStore } from '../state/activeWorkoutStore';
import { useSettingsStore } from '../state/settingsStore';
import { cardShadow, colors } from '../theme';
import { RoutineEditor } from './RoutineBuilderScreen';

export default function ActiveWorkoutScreen() {
  const sessionId = useActiveWorkoutStore((s) => s.sessionId);
  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      {sessionId ? <WorkoutInProgress sessionId={sessionId} /> : <StartWorkout />}
    </SafeAreaView>
  );
}

/* ───────────────────────────── Start screen ───────────────────────────── */

function StartWorkout() {
  const start = useActiveWorkoutStore((s) => s.start);
  const savePrompt = useActiveWorkoutStore((s) => s.savePrompt);
  const clearSavePrompt = useActiveWorkoutStore((s) => s.clearSavePrompt);
  /** undefined = draft editor closed; null / a day id = open, with that day chosen. */
  const [draftDay, setDraftDay] = useState<string | null | undefined>(undefined);
  const [picking, setPicking] = useState(false);
  /** Day whose routines are offered in the picker sheet. */
  const [chosen, setChosen] = useState<PlanDay | null>(null);
  const cycle = usePlanCycle();
  const plan = useSettingsStore((s) => s.training_plan);
  const { data: templates } = useLiveQuery<{
    id: string;
    title: string;
    folder: string | null;
    plan_day_id: string | null;
    n: number;
    last_used: number | null;
  }>(
    `SELECT t.id, t.title, t.folder, t.plan_day_id, json_array_length(t.template_exercises) AS n,
       (SELECT MAX(s.start_time) FROM workout_sessions s
        WHERE s.template_id = t.id AND s.deleted_at IS NULL AND s.end_time IS NOT NULL) AS last_used
     FROM workout_templates t
     WHERE t.deleted_at IS NULL ORDER BY last_used IS NULL, last_used DESC, t.updated_at DESC`,
    [],
    ['workout_templates', 'workout_sessions'],
  );

  if (draftDay !== undefined) {
    return (
      <RoutineEditor
        templateId={null}
        mode="draft"
        initialPlanDayId={draftDay}
        onDone={() => setDraftDay(undefined)}
        onOpen={() => {}}
      />
    );
  }

  const dayName = (id: string | null) => plan?.days.find((d) => d.id === id)?.name ?? null;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 20, gap: 12 }}>
      <View className="flex-row items-baseline justify-between px-1 pb-1">
        <Text className="text-2xl font-bold text-ink">Workout</Text>
        <Text className="text-sm text-ink-muted">
          {new Date().toLocaleDateString(undefined, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })}
        </Text>
      </View>

      {cycle && (
        <NextDayCard
          cycle={cycle}
          onStart={(templateId) => void start({ templateId, planDayId: cycle.next.id })}
          onBuild={() => setDraftDay(cycle.next.id)}
        />
      )}

      {cycle ? (
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => setPicking(true)}
            className="h-12 flex-1 items-center justify-center rounded-full bg-surface-raised active:opacity-70"
          >
            <Text className="text-sm font-medium text-ink">Another day</Text>
          </Pressable>
          <Pressable
            onPress={() => setDraftDay(null)}
            className="h-12 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-surface-raised active:opacity-70"
          >
            <Plus size={16} color={colors.ink} />
            <Text className="text-sm font-medium text-ink">Empty workout</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => setDraftDay(null)}
          className="h-[52px] flex-row items-center justify-center gap-2 rounded-full bg-accent active:opacity-80"
        >
          <Plus size={18} color={colors.bg} />
          <Text className="text-base font-bold text-surface">Start empty workout</Text>
        </Pressable>
      )}

      <BackupReminder />

      <View className="mt-3 flex-row items-baseline justify-between px-1">
        <Text className="text-base font-semibold text-ink">
          Routines <Text className="font-normal text-ink-muted">{templates.length}</Text>
        </Text>
        <Pressable onPress={() => router.navigate('/routines')} hitSlop={10}>
          <Text className="text-sm text-ink-muted">Edit</Text>
        </Pressable>
      </View>
      {templates.length === 0 ? (
        <View className="rounded-[20px] bg-surface-raised p-4">
          <Text className="text-sm text-ink-muted">Build a routine in the Routines tab.</Text>
        </View>
      ) : (
        <View className="rounded-[20px] bg-surface-raised py-1">
          {templates.map((item, i) => (
            <Pressable
              key={item.id}
              onPress={() => void start({ templateId: item.id })}
              className={`min-h-[60px] flex-row items-center gap-3 px-4 py-2 active:bg-surface-elevated ${
                i > 0 ? 'border-t border-surface-elevated' : ''
              }`}
              accessibilityLabel={`Start ${item.title}`}
            >
              <View className="flex-1">
                <Text className="text-base font-medium text-ink" numberOfLines={1}>
                  {item.title}
                </Text>
                <Text className="text-[13px] text-ink-muted" numberOfLines={1}>
                  {[
                    dayName(item.plan_day_id) ?? item.folder,
                    `${item.n} exercise${item.n === 1 ? '' : 's'}`,
                    item.last_used ? shortDay(item.last_used) : 'Not done yet',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <View className="h-9 w-9 items-center justify-center rounded-full bg-accent-soft">
                <Play size={14} color={colors.accent} fill={colors.accent} />
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <PlanDaySheet visible={picking} days={plan?.days ?? []} onClose={() => setPicking(false)} onPick={setChosen} />
      <DayRoutineSheet
        day={chosen}
        onClose={() => setChosen(null)}
        onStart={(templateId) => {
          const day = chosen!;
          setChosen(null);
          void start({ templateId, planDayId: day.id });
        }}
        onEmpty={() => {
          const day = chosen!;
          setChosen(null);
          setDraftDay(day.id);
        }}
      />
      <SaveRoutineSheet prompt={savePrompt} onClose={clearSavePrompt} />
    </ScrollView>
  );
}

/**
 * The plan's rotation (done days green, the rest white), the next day with when it was last trained, and its
 * routines to choose from. The least recently done routine is preselected.
 */
function NextDayCard({
  cycle,
  onStart,
  onBuild,
}: {
  cycle: PlanCycleView;
  onStart: (templateId: string) => void;
  onBuild: () => void;
}) {
  const { plan, next, done, lastAt } = cycle;
  const routines = useDayRoutines(next.id);
  const [picked, setPicked] = useState<string | null>(null);
  const selected = routines.find((r) => r.id === picked) ?? routines[0] ?? null;
  const last = lastAt.get(next.id);
  const title = /day$/i.test(next.name) ? next.name : `${next.name} day`;
  const wide = plan.days.length > 5;

  const cells = plan.days.map((d) => {
    const isDone = done.has(d.id);
    const doneAt = lastAt.get(d.id);
    const when = isDone && doneAt ? `Done ${dayAndDate(doneAt)}` : d.id === next.id ? 'Up next' : 'To do';
    return (
      <View key={d.id} className={`gap-1.5 ${wide ? 'w-[76px]' : 'flex-1'}`}>
        <View className={`h-1 rounded-full ${isDone ? 'bg-accent' : 'bg-ink'}`} />
        <Text className={`text-[13px] font-semibold ${isDone ? 'text-accent' : 'text-ink'}`} numberOfLines={1}>
          {d.name}
        </Text>
        <Text className={`text-xs ${isDone ? 'text-accent' : 'text-ink-muted'}`} numberOfLines={1}>
          {when}
        </Text>
      </View>
    );
  });

  return (
    <View className="gap-[18px] rounded-[20px] bg-surface-raised p-5">
      {wide ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {cells}
        </ScrollView>
      ) : (
        <View className="flex-row gap-1.5" accessibilityLabel="Plan cycle">
          {cells}
        </View>
      )}

      <View className="gap-1">
        <Text className="text-[32px] font-bold leading-9 text-ink">{title}</Text>
        <Text className="text-sm text-ink-muted">
          {last ? `Last ${next.name} was ${whenText(last)}.` : `First ${next.name} in your log.`}
        </Text>
      </View>

      {routines.length > 1 && (
        <View className="gap-1.5" accessibilityRole="radiogroup">
          {routines.map((r) => {
            const on = r.id === selected?.id;
            return (
              <Pressable
                key={r.id}
                onPress={() => setPicked(r.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                className={`min-h-[60px] flex-row items-center gap-3 rounded-xl px-3.5 py-2.5 ${on ? 'bg-surface-elevated' : ''}`}
              >
                <View
                  className={`h-[18px] w-[18px] items-center justify-center rounded-full border-2 ${
                    on ? 'border-ink' : 'border-ink-faint'
                  }`}
                >
                  {on && <View className="h-2 w-2 rounded-full bg-ink" />}
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-ink">{r.title}</Text>
                  <Text className="text-[13px] text-ink-muted" numberOfLines={1}>
                    {namesPreview(r.names) || `${r.n} exercises`}
                  </Text>
                </View>
                <Text className="text-xs text-ink-muted">{r.last_used ? shortDay(r.last_used) : 'New'}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {routines.length === 1 && (
        <Text className="text-[13px] text-ink-muted" numberOfLines={2}>
          {namesPreview(routines[0]!.names, 4)}
        </Text>
      )}

      {selected ? (
        <Pressable
          onPress={() => onStart(selected.id)}
          className="h-[52px] flex-row items-center justify-center gap-2 rounded-full bg-accent px-4 active:opacity-80"
        >
          <Play size={16} color={colors.bg} fill={colors.bg} />
          <Text className="text-base font-bold text-surface" numberOfLines={1}>
            Start {selected.title}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onBuild}
          className="h-[52px] flex-row items-center justify-center gap-2 rounded-full bg-accent px-4 active:opacity-80"
        >
          <Plus size={18} color={colors.bg} />
          <Text className="text-base font-bold text-surface">Build a {next.name} routine</Text>
        </Pressable>
      )}
    </View>
  );
}

/** A plan day's routines (least recently used first), plus starting that day empty. */
function DayRoutineSheet({
  day,
  onClose,
  onStart,
  onEmpty,
}: {
  day: PlanDay | null;
  onClose: () => void;
  onStart: (templateId: string) => void;
  onEmpty: () => void;
}) {
  const routines = useDayRoutines(day?.id ?? null);
  return (
    <BottomSheet visible={day !== null} onClose={onClose} className="gap-2 p-5">
      <Text className="mb-2 text-xl font-bold text-ink">{day?.name ?? ''}</Text>
      {routines.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => onStart(r.id)}
          className="flex-row items-center justify-between rounded-card border border-surface-border bg-surface-raised p-4 active:opacity-80"
        >
          <View>
            <Text className="text-base font-semibold text-ink">{r.title}</Text>
            <Text className="text-xs text-ink-subtle">
              {r.n} exercise{r.n === 1 ? '' : 's'}
            </Text>
          </View>
          <Play size={16} color={colors.accent} fill={colors.accent} />
        </Pressable>
      ))}
      <Pressable
        onPress={onEmpty}
        className="flex-row items-center justify-center gap-2 rounded-card border border-dashed border-surface-border p-4 active:opacity-80"
      >
        <Plus size={16} color={colors.accent} />
        <Text className="text-base font-semibold text-accent">Start empty {day?.name ?? ''}</Text>
      </Pressable>
    </BottomSheet>
  );
}

/* ───────────────────────────── Focus mode ───────────────────────────── */

function useElapsed(startedAt: number | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function WorkoutInProgress({ sessionId }: { sessionId: string }) {
  const { startedAt, prHits, currentIndex, setCurrentIndex, addExercise, toggleSetComplete, finish, discard } =
    useActiveWorkoutStore();
  const { width } = useWindowDimensions();
  const elapsed = useElapsed(startedAt);
  const pagerRef = useRef<FlatList<SessionExerciseView>>(null);
  const jumpToNewExercise = useRef(false);

  const [selectorOpen, setSelectorOpen] = useState(false);
  /** Workout slot being replaced via the selector (null = the selector adds an exercise). */
  const [replacing, setReplacing] = useState<string | null>(null);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [setTypeTarget, setSetTypeTarget] = useState<SetViewRow | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);

  // Settings → "Keep screen awake": only while a workout is open; released when it ends or the screen unmounts.
  const keepAwake = useSettingsStore((s) => s.keep_awake);
  useEffect(() => {
    if (!keepAwake) return;
    void activateKeepAwakeAsync('active-workout');
    return () => void deactivateKeepAwake('active-workout');
  }, [keepAwake]);

  const { data: sessionRows } = useLiveQuery<{ template_id: string | null }>(
    `SELECT template_id FROM workout_sessions WHERE id = ?`,
    [sessionId],
    ['workout_sessions'],
  );
  const templateId = sessionRows[0]?.template_id ?? null;

  // The routine's rep range per exercise (e.g. "8–12"), shown as the reps target while logging.
  const { data: templateRows } = useLiveQuery<{ template_exercises: string }>(
    `SELECT template_exercises FROM workout_templates WHERE id = ?`,
    [templateId],
    ['workout_templates'],
  );
  const repRanges = useMemo(() => {
    const map = new Map<string, string>();
    const raw = templateRows[0]?.template_exercises;
    if (!raw) return map;
    for (const te of JSON.parse(raw) as TemplateExercise[]) {
      if (te.rep_min != null && te.rep_max != null && !map.has(te.exercise_id)) {
        map.set(te.exercise_id, formatRepTarget(te));
      }
    }
    return map;
  }, [templateRows]);
  // The routine's interval "auto-start next set" per exercise.
  const routineAutoNext = useMemo(() => {
    const map = new Map<string, boolean>();
    const raw = templateRows[0]?.template_exercises;
    if (!raw) return map;
    for (const te of JSON.parse(raw) as TemplateExercise[]) {
      if (te.auto_next != null && !map.has(te.exercise_id)) map.set(te.exercise_id, te.auto_next);
    }
    return map;
  }, [templateRows]);

  const { data: exercises, loading } = useLiveQuery<SessionExerciseView>(
    `SELECT se.id, se.exercise_id, se.rest_seconds, se.notes, se.superset_group,
            e.name, e.primary_muscle, e.equipment, e.tracking_type
     FROM session_exercises se JOIN exercise_definitions e ON e.id = se.exercise_id
     WHERE se.session_id = ? AND se.deleted_at IS NULL ORDER BY se.order_index`,
    [sessionId],
    ['session_exercises', 'exercise_definitions'],
  );
  // One query for every set in the session, grouped in memory: avoids a live query per page.
  const { data: sets } = useLiveQuery<SetViewRow & { tracking_type: TrackingType }>(
    `SELECT s.id, s.session_exercise_id, s.order_index, s.set_type, s.weight_kg, s.reps, s.duration_s, s.distance_m,
            s.is_completed, s.notes, s.rpe, e.tracking_type
     FROM sets s JOIN session_exercises se ON se.id = s.session_exercise_id
     JOIN exercise_definitions e ON e.id = se.exercise_id
     WHERE se.session_id = ? AND s.deleted_at IS NULL ORDER BY s.order_index`,
    [sessionId],
    ['sets', 'exercise_definitions'],
  );

  const setsByExercise = useMemo(() => {
    const map = new Map<string, SetViewRow[]>();
    for (const s of sets) {
      const list = map.get(s.session_exercise_id) ?? [];
      list.push(s);
      map.set(s.session_exercise_id, list);
    }
    return map;
  }, [sets]);

  const count = exercises.length;
  const index = Math.min(currentIndex, Math.max(0, count - 1));
  const current = exercises[index];
  const isLast = index === count - 1;

  /**
   * Page a button-driven scroll is heading to. Android fires onMomentumScrollEnd as soon as a programmatic scroll
   * starts, with the old offset; without this, that event set the index back and Back/Next did nothing.
   */
  const scrollingTo = useRef<number | null>(null);
  const scrollPagerTo = useCallback((i: number, animated: boolean) => {
    scrollingTo.current = animated ? i : null;
    pagerRef.current?.scrollToIndex({ index: i, animated });
  }, []);

  const goTo = useCallback(
    (target: number, animated = true) => {
      if (count === 0) return;
      const i = Math.max(0, Math.min(count - 1, target));
      setCurrentIndex(i);
      scrollPagerTo(i, animated);
    },
    [count, setCurrentIndex, scrollPagerTo],
  );

  // After adding an exercise, glide to it once it appears; after removing, clamp into range.
  useEffect(() => {
    if (jumpToNewExercise.current && count > 0) {
      jumpToNewExercise.current = false;
      goTo(count - 1);
    } else if (count > 0 && currentIndex > count - 1) {
      goTo(count - 1, false);
    }
  }, [count, currentIndex, goTo]);

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (scrollingTo.current !== null) {
      // Ignore the stale events of a button-driven scroll until it lands.
      if (i === scrollingTo.current) scrollingTo.current = null;
      return;
    }
    if (i !== currentIndex) {
      void Haptics.selectionAsync();
      setCurrentIndex(i);
    }
  };

  const groups = useMemo(() => exercises.map((e) => e.superset_group), [exercises]);
  const labels = useMemo(() => supersetLabels(groups), [groups]);
  const membersOf = useCallback(
    (i: number) =>
      supersetMembers(groups, i).map((m) => {
        const list = setsByExercise.get(exercises[m]!.id) ?? [];
        return {
          index: m,
          label: labels[m] ?? '',
          name: exercises[m]!.name,
          total: list.length,
          done: list.filter((s) => s.is_completed === 1).length,
        };
      }),
    [groups, labels, exercises, setsByExercise],
  );

  const completeSet = useActiveWorkoutStore((s) => s.completeSet);
  /** Ticking runs the shared workout flow (superset auto-advance / rest); unticking just unticks. */
  const onToggleComplete = useCallback(
    (setId: string, completed: boolean, restSeconds: number | null) =>
      void (completed ? completeSet(setId, restSeconds) : toggleSetComplete(setId, false)),
    [completeSet, toggleSetComplete],
  );

  const onStartInterval = useCallback(
    (sessionExerciseId: string, setId: string) => void useIntervalRunStore.getState().start(sessionExerciseId, setId),
    [],
  );

  // The store can move to another exercise (superset flow, lock screen, notification): keep the pager on it.
  // Any change of exercise (Next / Back, swipe, overview jump, auto-advance) also puts the keyboard away.
  const shownIndex = useRef(index);
  useEffect(() => {
    if (currentIndex !== shownIndex.current) Keyboard.dismiss();
    if (count > 0 && currentIndex !== shownIndex.current && currentIndex < count) {
      scrollPagerTo(currentIndex, true);
    }
    shownIndex.current = currentIndex;
  }, [currentIndex, count, scrollPagerTo]);

  const toggleLink = (i: number) => {
    void setSessionSupersets(sessionId, isLinkedWithNext(groups, i) ? unlinkFromNext(groups, i) : linkWithNext(groups, i));
  };

  const confirmFinish = () => {
    Keyboard.dismiss();
    setFinishOpen(true);
  };

  /** What the rest leads into: the next unticked set here, else the next exercise. */
  const restNext = useMemo(() => {
    if (!current) return null;
    const list = setsByExercise.get(current.id) ?? [];
    const i = list.findIndex((s) => s.is_completed === 0);
    if (i >= 0) {
      if (list[i]!.set_type === 'warmup') return 'a warm-up set';
      return `set ${list.slice(0, i + 1).filter((s) => s.set_type !== 'warmup').length}`;
    }
    return exercises[index + 1]?.name ?? null;
  }, [current, setsByExercise, exercises, index]);

  const overviewItems = useMemo(
    () =>
      exercises.map((e) => {
        const list = setsByExercise.get(e.id) ?? [];
        return {
          id: e.id,
          name: e.name,
          total: list.length,
          done: list.filter((s) => s.is_completed === 1).length,
          label: labels[exercises.indexOf(e)] ?? null,
        };
      }),
    [exercises, setsByExercise, labels],
  );

  return (
    <View className="flex-1">
      {/* Sticky header, with a progress strip: finished exercises green, the current one white. */}
      <View className="gap-2.5 border-b border-surface-border px-4 py-3">
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={() => setOverviewOpen(true)}
          className="h-10 w-10 items-center justify-center rounded-xl bg-surface-raised active:opacity-70"
          accessibilityLabel="Workout overview"
        >
          <ListOrdered size={20} color={colors.ink} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-xl font-bold tabular-nums text-ink">{elapsed}</Text>
          <Text className="text-xs text-ink-subtle" numberOfLines={1}>
            {current ? current.name : 'Empty workout'}
          </Text>
        </View>
        <Pressable onPress={confirmFinish} className="rounded-xl bg-surface-raised px-4 py-2.5 active:opacity-70">
          <Text className="font-bold text-ink">Finish</Text>
        </Pressable>
      </View>
      {count > 0 && (
        <Pressable onPress={() => setOverviewOpen(true)} hitSlop={8} className="flex-row gap-1" accessibilityLabel="Workout overview">
          {overviewItems.map((e, i) => (
            <View
              key={e.id}
              className={`h-1 flex-1 rounded-full ${
                i === index ? 'bg-ink' : e.total > 0 && e.done === e.total ? 'bg-accent' : 'bg-surface-border'
              }`}
            />
          ))}
        </Pressable>
      )}
      </View>

      {/* Pager */}
      <View className="flex-1">
        {loading ? (
          <ActivityIndicator className="mt-10" color={colors.accent} />
        ) : count === 0 ? (
          <EmptyWorkout onAdd={() => setSelectorOpen(true)} />
        ) : (
          <FlatList
            ref={pagerRef}
            data={exercises}
            keyExtractor={(e) => e.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={index}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={onMomentumScrollEnd}
            // A swipe always wins over a button-driven scroll still in flight.
            onScrollBeginDrag={() => {
              scrollingTo.current = null;
              Keyboard.dismiss();
            }}
            keyboardShouldPersistTaps="handled"
            // Keep neighbours mounted so swiping back and forth is instant and inputs keep state.
            windowSize={5}
            initialNumToRender={Math.min(count, index + 2)}
            removeClippedSubviews={false}
            renderItem={({ item, index: i }) => (
              <ExerciseFocusCard
                exercise={item}
                index={i}
                supersetLabel={labels[i] ?? null}
                supersetMembers={labels[i] ? membersOf(i) : []}
                onJump={goTo}
                sets={setsByExercise.get(item.id) ?? []}
                sessionId={sessionId}
                templateId={templateId}
                repRange={repRanges.get(item.exercise_id) ?? null}
                routineAutoNext={routineAutoNext.get(item.exercise_id) ?? null}
                onStartInterval={onStartInterval}
                width={width}
                prHits={prHits}
                onToggleComplete={onToggleComplete}
                onOpenSetType={setSetTypeTarget}
              />
            )}
          />
        )}
      </View>

      <RestTimerBanner next={restNext} />
      <IntervalRunBanner />

      {/* Fixed navigation bar */}
      <View className="flex-row items-center gap-3 border-t border-surface-border bg-surface-raised px-4 py-3">
        <Pressable
          onPress={() => goTo(index - 1)}
          disabled={index === 0 || count === 0}
          className={`h-12 flex-row items-center gap-1 rounded-xl bg-surface-elevated px-3 ${
            index === 0 || count === 0 ? 'opacity-40' : 'active:opacity-70'
          }`}
          accessibilityLabel="Previous exercise"
        >
          <ChevronLeft size={18} color={colors.ink} />
          <Text className="font-semibold text-ink">Back</Text>
        </Pressable>

        <Pressable onPress={() => setOverviewOpen(true)} className="flex-1 items-center">
          <Text className="text-[11px] font-semibold uppercase tracking-widest text-ink-subtle">
            {count > 0 ? `Exercise ${index + 1} of ${count}` : 'No exercises'}
          </Text>
          <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
            {current?.name ?? 'Add one to begin'}
          </Text>
        </Pressable>

        {count === 0 ? (
          <NavPrimary label="Add" icon={<Plus size={18} color={colors.bg} />} onPress={() => setSelectorOpen(true)} />
        ) : isLast ? (
          <NavPrimary label="Finish" icon={<Flag size={16} color={colors.bg} />} onPress={confirmFinish} />
        ) : (
          <NavPrimary label="Next" icon={<ChevronRight size={18} color={colors.bg} />} onPress={() => goTo(index + 1)} />
        )}
      </View>

      <WorkoutOverviewSheet
        visible={overviewOpen}
        items={overviewItems}
        currentIndex={index}
        onClose={() => setOverviewOpen(false)}
        onJump={(i) => {
          setOverviewOpen(false);
          goTo(i);
        }}
        onAddExercise={() => {
          setOverviewOpen(false);
          setSelectorOpen(true);
        }}
        onRemove={(id) => void removeSessionExercise(id)}
        groups={groups}
        onToggleLink={toggleLink}
        onReorder={(from, to) => {
          void reorderSessionExercise(sessionId, from, to);
          // Keep the pager on the exercise that was on screen.
          if (from === index) goTo(to, false);
          else if (from < index && to >= index) goTo(index - 1, false);
          else if (from > index && to <= index) goTo(index + 1, false);
        }}
        onReplace={(id) => {
          setOverviewOpen(false);
          setReplacing(id);
          setSelectorOpen(true);
        }}
      />
      <ExerciseSelector
        visible={selectorOpen}
        onClose={() => {
          setSelectorOpen(false);
          setReplacing(null);
        }}
        // Replacing swaps one exercise; adding takes several at once, in the order they were ticked.
        onSelect={(e) => {
          if (!replacing) return;
          void replaceSessionExercise(replacing, e.id);
          setReplacing(null);
        }}
        onSelectMany={
          replacing
            ? undefined
            : (picked) => {
                jumpToNewExercise.current = true;
                void (async () => {
                  for (const e of picked) await addExercise(e.id);
                })();
              }
        }
      />
      <SetTypeSheet set={setTypeTarget} onClose={() => setSetTypeTarget(null)} />
      <FinishWorkoutSheet
        visible={finishOpen}
        elapsed={elapsed}
        exerciseCount={count}
        sets={sets}
        onClose={() => setFinishOpen(false)}
        onFinish={(fields) => {
          setFinishOpen(false);
          void finish(fields);
        }}
        onDiscard={() => {
          setFinishOpen(false);
          void discard();
        }}
      />
    </View>
  );
}

function NavPrimary({ label, icon, onPress }: { label: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="h-12 flex-row items-center gap-1 rounded-xl bg-accent px-4 active:opacity-80">
      <Text className="font-bold text-surface">{label}</Text>
      {icon}
    </Pressable>
  );
}

function EmptyWorkout({ onAdd }: { onAdd: () => void }) {
  return (
    <View className="flex-1 justify-center p-6">
      <View className="items-center gap-3 rounded-card border border-surface-border bg-surface-raised p-8" style={cardShadow}>
        <View className="h-14 w-14 items-center justify-center rounded-full bg-accent-soft">
          <Dumbbell size={26} color={colors.accent} />
        </View>
        <Text className="text-lg font-bold text-ink">Your workout is empty</Text>
        <Text className="text-center text-sm text-ink-subtle">Add exercises and log them one at a time.</Text>
        <Pressable onPress={onAdd} className="mt-2 flex-row items-center gap-2 rounded-xl bg-accent px-5 py-3 active:opacity-80">
          <Plus size={18} color={colors.bg} />
          <Text className="font-bold text-surface">Add exercise</Text>
        </Pressable>
      </View>
    </View>
  );
}
