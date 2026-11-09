import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, BackHandler, Pressable, ScrollView, SectionList, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Folder,
  FolderPlus,
  Link2,
  Minus,
  MoreHorizontal,
  Play,
  Plus,
  Trash2,
  Unlink,
  X,
} from 'lucide-react-native';
import {
  REST_SECONDS_MAX,
  TRACKING_FIELDS,
  expandTemplateSets,
  isLinkedWithNext,
  linkWithNext,
  normalizeGroups,
  supersetLabels,
  unlinkFromNext,
  formatDuration,
  formatRepTarget,
  parseDuration,
  parseRepTarget,
  usesField,
  weightSign,
  type SetField,
  type TrackingType,
  type SetType,
  type TemplateExercise,
  type TemplateSet,
} from '@gym/shared';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { ConfirmSheet, type ConfirmRequest } from '../components/ConfirmSheet';
import { DurationInputSheet } from '../components/DurationInputSheet';
import { ExerciseSelector } from '../components/ExerciseSelector';
import { FolderSheet } from '../components/FolderSheet';
import { PlanDayPicker } from '../components/PlanDayPicker';
import { SET_TYPE_STYLE } from '../components/SetRow';
import { DragHandle, useDragReorder } from '../components/DragReorder';
import { ToggleRow } from '../components/SettingsControls';
import { WorkoutConflictSheet } from '../components/WorkoutConflictSheet';
import { db } from '../db/client';
import { getRecord } from '../db/mutate';
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  listFolders,
  renameFolder,
  updateTemplate,
} from '../db/repositories/templates';
import { useLiveQuery } from '../db/useLiveQuery';
import { useActiveWorkoutStore } from '../state/activeWorkoutStore';
import { ROUTINE_NAMES_SQL } from '../hooks/usePlan';
import { namesPreview } from '../db/repositories/stats';
import { shortDay } from '../components/dates';
import { useSettingsStore, useUnits } from '../state/settingsStore';
import { saveFailed } from '../state/toastStore';
import { colors } from '../theme';

/**
 * Inputs that hold text that isn't a valid value report it here, so save() can block and name the exercise.
 * Keyed per input instance; an input unmounting (set or exercise removed) clears its entry.
 */
const FieldValidityContext = createContext<{ name: string; report: (id: string, name: string | null) => void } | null>(null);

function useFieldValidity(bad: boolean) {
  const ctx = useContext(FieldValidityContext);
  const id = useId();
  const ref = useRef(ctx);
  ref.current = ctx;
  useEffect(() => {
    ref.current?.report(id, bad ? ref.current.name : null);
    return () => ref.current?.report(id, null);
  }, [bad, id]);
}

/** Editor row: the stored template exercise + display name + whether the typed reps text is invalid. */
type DraftItem = TemplateExercise & { name: string; tracking_type: TrackingType; repsError?: boolean };
/** null = closed, 'new' = create, otherwise the id of the routine being edited. */
type EditorTarget = null | 'new' | string;

export default function RoutineBuilderScreen() {
  const [editing, setEditing] = useState<EditorTarget>(null);
  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      {editing ? (
        <RoutineEditor
          key={editing}
          templateId={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
          onOpen={setEditing}
        />
      ) : (
        <RoutineList onNew={() => setEditing('new')} onEdit={setEditing} />
      )}
    </SafeAreaView>
  );
}

/* ───────────────────────────── List ───────────────────────────── */

interface RoutineRow {
  id: string;
  title: string;
  folder: string | null;
  plan_day_id: string | null;
  n: number;
  last_used: number | null;
  /** Exercise names, one per line. */
  names: string | null;
}

function RoutineList({ onNew, onEdit }: { onNew: () => void; onEdit: (id: string) => void }) {
  const start = useActiveWorkoutStore((s) => s.start);
  const discard = useActiveWorkoutStore((s) => s.discard);
  const activeSession = useActiveWorkoutStore((s) => s.sessionId);
  const startedAt = useActiveWorkoutStore((s) => s.startedAt);
  const [conflict, setConflict] = useState<{ id: string; title: string } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const plan = useSettingsStore((s) => s.training_plan);
  const { data } = useLiveQuery<RoutineRow>(
    `SELECT t.id, t.title, t.folder, t.plan_day_id, json_array_length(t.template_exercises) AS n,
       (SELECT MAX(s.start_time) FROM workout_sessions s
        WHERE s.template_id = t.id AND s.deleted_at IS NULL AND s.end_time IS NOT NULL) AS last_used,
       ${ROUTINE_NAMES_SQL}
     FROM workout_templates t
     WHERE t.deleted_at IS NULL ORDER BY t.title COLLATE NOCASE`,
    [],
    ['workout_templates', 'workout_sessions', 'exercise_definitions'],
  );
  const dayName = (id: string | null) => plan?.days.find((d) => d.id === id)?.name ?? null;
  const folderCount = new Set(data.map((r) => r.folder).filter(Boolean)).size;

  // Folders A→Z, then routines without a folder. With no folders at all, one headerless section.
  const sections = useMemo(() => {
    const byFolder = new Map<string, RoutineRow[]>();
    const loose: RoutineRow[] = [];
    for (const r of data) {
      if (r.folder) byFolder.set(r.folder, [...(byFolder.get(r.folder) ?? []), r]);
      else loose.push(r);
    }
    const names = [...byFolder.keys()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    const out = names.map((name) => ({ key: name, folder: name as string | null, count: byFolder.get(name)!.length, data: byFolder.get(name)! }));
    if (loose.length > 0) out.push({ key: '__none__', folder: null, count: loose.length, data: loose });
    return out.map((s) => (collapsed.has(s.key) ? { ...s, data: [] } : s));
  }, [data, collapsed]);
  const hasFolders = sections.some((s) => s.folder !== null);

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const launch = async (templateId: string) => {
    await start({ templateId });
    router.navigate('/');
  };

  const startRoutine = (routine: { id: string; title: string }) => {
    if (activeSession) setConflict(routine);
    else void launch(routine.id);
  };

  return (
    <View className="flex-1 px-4 pt-5">
      <View className="mb-2 flex-row items-center justify-between px-1">
        <View className="gap-0.5">
          <Text className="text-2xl font-bold text-ink">Routines</Text>
          {data.length > 0 && (
            <Text className="text-sm text-ink-muted">
              {data.length} routine{data.length === 1 ? '' : 's'}
              {folderCount > 0 ? ` in ${folderCount + (sections.some((x) => x.folder === null) ? 1 : 0)} groups` : ''}
            </Text>
          )}
        </View>
        <Pressable onPress={onNew} className="h-11 flex-row items-center gap-1.5 rounded-full bg-accent px-[18px] active:opacity-80">
          <Plus size={16} color={colors.bg} strokeWidth={2.5} />
          <Text className="text-[15px] font-bold text-surface">New</Text>
        </Pressable>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <View className="mt-4 rounded-[20px] bg-surface-raised p-4">
            <Text className="text-sm text-ink-muted">No routines yet. Tap New to build one.</Text>
          </View>
        }
        renderSectionHeader={({ section }) =>
          hasFolders ? (
            <View className="mb-2 mt-4 flex-row items-center gap-2 px-1">
              <Pressable
                onPress={() => toggle(section.key)}
                className="flex-1 flex-row items-center gap-2 py-1.5"
                accessibilityLabel={`${section.folder ?? 'No folder'}, ${section.count} routines. Tap to ${collapsed.has(section.key) ? 'expand' : 'collapse'}`}
              >
                {collapsed.has(section.key) ? (
                  <ChevronRight size={16} color={colors.muted} />
                ) : (
                  <ChevronDown size={16} color={colors.muted} />
                )}
                <Text className="shrink text-base font-semibold text-ink" numberOfLines={1}>
                  {section.folder ?? 'No folder'} <Text className="font-normal text-ink-muted">{section.count}</Text>
                </Text>
              </Pressable>
              {section.folder && (
                <Pressable
                  onPress={() => setRenaming(section.folder)}
                  hitSlop={8}
                  className="h-8 w-8 items-center justify-center rounded-lg active:bg-surface-raised"
                  accessibilityLabel={`Rename folder ${section.folder}`}
                >
                  <MoreHorizontal size={18} color={colors.subtle} />
                </Pressable>
              )}
            </View>
          ) : null
        }
        renderItem={({ item, index, section }) => {
          // One grouped panel per folder: rounded at the panel's ends, a fine line between rows.
          const first = index === 0;
          const last = index === section.data.length - 1;
          return (
            <Pressable
              onPress={() => onEdit(item.id)}
              className={`min-h-[72px] flex-row items-center gap-3 bg-surface-raised px-4 py-2.5 active:bg-surface-elevated ${
                first ? 'rounded-t-[20px] pt-3.5' : 'border-t border-surface-elevated'
              } ${last ? 'rounded-b-[20px] pb-3.5' : ''}`}
              accessibilityLabel={`${item.title}, ${item.n} exercises. Tap to edit`}
            >
              <View className="flex-1 gap-[3px]">
                <Text className="text-base font-semibold text-ink" numberOfLines={1}>
                  {item.title}
                </Text>
                {!!item.names && (
                  <Text className="text-[13px] text-ink-muted" numberOfLines={1}>
                    {namesPreview(item.names)}
                  </Text>
                )}
                <Text className="text-[13px] text-ink-subtle" numberOfLines={1}>
                  {[
                    dayName(item.plan_day_id) && `${dayName(item.plan_day_id)} day`,
                    `${item.n} exercise${item.n === 1 ? '' : 's'}`,
                    item.last_used ? shortDay(item.last_used) : 'Not done yet',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Pressable
                onPress={() => startRoutine(item)}
                hitSlop={8}
                className="h-10 w-10 items-center justify-center rounded-full bg-accent-soft"
                accessibilityLabel={`Start ${item.title}`}
              >
                <Play size={15} color={colors.accent} fill={colors.accent} />
              </Pressable>
            </Pressable>
          );
        }}
      />

      <FolderSheet
        folder={renaming}
        routineCount={data.filter((r) => r.folder === renaming).length}
        onClose={() => setRenaming(null)}
        onSave={(name) => {
          const from = renaming;
          setRenaming(null);
          if (from !== null && name !== from) void renameFolder(from, name);
        }}
      />
      <WorkoutConflictSheet
        routineTitle={conflict?.title ?? null}
        startedAt={startedAt}
        onClose={() => setConflict(null)}
        onResume={() => {
          setConflict(null);
          router.navigate('/');
        }}
        onDiscardAndStart={() => {
          const target = conflict;
          setConflict(null);
          if (target) void discard().then(() => launch(target.id));
        }}
      />
    </View>
  );
}

/* ───────────────────────────── Editor ───────────────────────────── */

const formatRest = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

interface Draft {
  title: string;
  notes: string | null;
  folder: string | null;
  plan_day_id: string | null;
  items: DraftItem[];
}

async function loadRoutine(id: string): Promise<Draft | null> {
  const t = await getRecord('workout_templates', id);
  if (!t || t.deleted_at !== null) return null;
  const defs = await db.getAllAsync<{ id: string; name: string; tracking_type: TrackingType }>(
    'SELECT id, name, tracking_type FROM exercise_definitions',
  );
  const byId = new Map(defs.map((d) => [d.id, d]));
  const items = [...t.template_exercises]
    .sort((a, b) => a.order_index - b.order_index)
    .map((te) => ({
      ...te,
      name: byId.get(te.exercise_id)?.name ?? 'Unknown exercise',
      tracking_type: byId.get(te.exercise_id)?.tracking_type ?? ('weight_reps' as const),
    }));
  return { title: t.title, notes: t.notes, folder: t.folder, plan_day_id: t.plan_day_id, items };
}

const toTemplateExercises = (items: DraftItem[]): TemplateExercise[] =>
  items.map(({ name: _name, tracking_type: _type, repsError: _err, ...te }, i) => ({
    ...te,
    order_index: i,
    target_sets: te.sets ? te.sets.length : te.target_sets,
  }));

/**
 * Routine builder. `draft` mode (Workout tab → "Start empty workout") builds a workout that starts without
 * saving a routine: no folder, optional name, and "Start" instead of "Save".
 */
export function RoutineEditor({
  templateId,
  onDone,
  onOpen,
  mode = 'routine',
  initialPlanDayId = null,
}: {
  templateId: string | null;
  onDone: () => void;
  onOpen: (id: string) => void;
  mode?: 'routine' | 'draft';
  initialPlanDayId?: string | null;
}) {
  const isDraft = mode === 'draft';
  const start = useActiveWorkoutStore((s) => s.start);
  const defaultRest = useSettingsStore((s) => s.default_rest_seconds);
  const [loaded, setLoaded] = useState(templateId === null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState<string | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  const [planDayId, setPlanDayId] = useState<string | null>(initialPlanDayId);
  const [folders, setFolders] = useState<string[]>([]);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [initial, setInitial] = useState('');
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [editingRestIndex, setEditingRestIndex] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void listFolders().then(setFolders);
    if (!templateId) {
      setInitial(JSON.stringify({ title: '', folder: null, planDayId: initialPlanDayId, items: [] }));
      return;
    }
    void loadRoutine(templateId).then((r) => {
      if (!r) return onDone(); // deleted elsewhere
      setTitle(r.title);
      setNotes(r.notes);
      setFolder(r.folder);
      setPlanDayId(r.plan_day_id);
      setItems(r.items);
      setInitial(JSON.stringify({ title: r.title, folder: r.folder, planDayId: r.plan_day_id, items: r.items }));
      setLoaded(true);
    });
  }, [templateId]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = items.map((it) => it.superset_group);
  const labels = supersetLabels(groups);
  /** Link / unlink exercise i with the next one as a superset. */
  const toggleLink = (i: number) => {
    const next = isLinkedWithNext(groups, i) ? unlinkFromNext(groups, i) : linkWithNext(groups, i);
    setItems((prev) => prev.map((it, idx) => ({ ...it, superset_group: next[idx] ?? null })));
  };

  const dirty = useMemo(
    () => JSON.stringify({ title, folder, planDayId, items }) !== initial,
    [title, folder, planDayId, items, initial],
  );

  const patch = (i: number, p: Partial<DraftItem>) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  /** Drag and drop: superset links are re-checked so moving an exercise never leaves half a superset. */
  const reorder = useDragReorder(items.length, (from, to) =>
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      const clean = normalizeGroups(next.map((it) => it.superset_group));
      return next.map((it, i) => ({ ...it, superset_group: clean[i] ?? null }));
    }),
  );
  const hasPlan = useSettingsStore((s) => s.training_plan) !== null;
  /** Inputs currently holding invalid text (input id → exercise name), see useFieldValidity. */
  const invalidFields = useRef(new Map<string, string>());
  const reportInvalid = useCallback((id: string, name: string | null) => {
    if (name === null) invalidFields.current.delete(id);
    else invalidFields.current.set(id, name);
  }, []);
  /** Folder name typed in the picker but not committed yet (Save may be tapped before blur). */
  const pendingFolder = useRef('');

  /** Returns why the draft can't be saved, or null. */
  const problem = (): ConfirmRequest | null => {
    if (!isDraft && !title.trim()) return { title: 'Give the routine a name', confirmLabel: 'OK', notice: true };
    if (items.length === 0) return { title: 'Add at least one exercise', confirmLabel: 'OK', notice: true };
    const bad = items.find((it) => it.repsError);
    if (bad) {
      return {
        title: `Check the reps for ${bad.name}`,
        message: 'Use a number like 10 or a range like 8-12.',
        confirmLabel: 'OK',
        notice: true,
      };
    }
    const invalid = [...invalidFields.current.values()][0];
    if (invalid !== undefined) {
      return {
        title: `Check the numbers for ${invalid}`,
        message: 'One of the targets isn’t a valid number or time. Fix it or clear it.',
        confirmLabel: 'OK',
        notice: true,
      };
    }
    return null;
  };

  const save = async () => {
    const p = problem();
    if (p) return setConfirm(p);
    const folderNow = pendingFolder.current.trim() || folder;
    const fields = { title: title.trim(), notes, folder: folderNow, plan_day_id: planDayId, template_exercises: toTemplateExercises(items) };
    setSaving(true);
    try {
      if (templateId) await updateTemplate(templateId, fields);
      else await createTemplate(fields.title, fields.template_exercises, { notes, folder: folderNow, planDayId });
      onDone();
    } catch (e) {
      saveFailed(e);
    } finally {
      setSaving(false);
    }
  };

  /** Draft mode: start the workout from what's on screen. No routine is saved. */
  const startDraft = async () => {
    const p = problem();
    if (p) return setConfirm(p);
    const dayName = useSettingsStore.getState().training_plan?.days.find((d) => d.id === planDayId)?.name ?? null;
    setSaving(true);
    try {
      await start({ draft: toTemplateExercises(items), title: title.trim() || dayName, planDayId });
      onDone();
    } catch (e) {
      saveFailed(e);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    if (!dirty) return onDone();
    setConfirm({
      title: isDraft ? 'Discard this workout?' : 'Discard changes?',
      message: isDraft ? 'The exercises you added will be lost.' : 'Your edits to this routine haven’t been saved.',
      confirmLabel: isDraft ? 'Discard' : 'Discard changes',
      tone: 'destructive',
      onConfirm: onDone,
    });
  };

  /** Copies what's on screen (including unsaved edits) into a new routine and opens it. */
  const duplicate = () => {
    if (!templateId) return;
    const run = async () => {
      const id = await duplicateTemplate(templateId, {
        title: title.trim() || 'Routine',
        notes,
        folder: pendingFolder.current.trim() || folder,
        plan_day_id: planDayId,
        template_exercises: toTemplateExercises(items),
      });
      onOpen(id);
    };
    const p = problem();
    if (p) return setConfirm(p);
    if (!dirty) return void run();
    setConfirm({
      title: 'Duplicate with your edits?',
      message: `The copy gets what’s on screen. Unsaved edits to “${title.trim()}” itself are dropped.`,
      confirmLabel: 'Duplicate',
      onConfirm: () => void run(),
    });
  };

  // Android Back behaves like Cancel (asks before dropping unsaved edits) instead of leaving the tab.
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;
  // Only while this tab is focused: tabs stay mounted, so a plain effect would also catch Back on other tabs.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        cancelRef.current();
        return true;
      });
      return () => sub.remove();
    }, []),
  );


  const askDelete = () =>
    setConfirm({
      title: `Delete “${title || 'this routine'}”?`,
      message: 'Past workouts started from it are kept. This can’t be undone.',
      confirmLabel: 'Delete routine',
      tone: 'destructive',
      onConfirm: () => {
        if (templateId) void deleteTemplate(templateId).then(onDone);
      },
    });

  if (!loaded) {
    return <ActivityIndicator className="mt-16" color={colors.accent} />;
  }

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between border-b border-surface-border px-4 py-3">
        <Pressable onPress={cancel} hitSlop={8}>
          <Text className="text-base text-ink-muted">Cancel</Text>
        </Pressable>
        <Text className="text-lg font-bold text-ink">{isDraft ? 'New workout' : templateId ? 'Edit routine' : 'New routine'}</Text>
        <Pressable onPress={() => void (isDraft ? startDraft() : save())} disabled={saving} hitSlop={8}>
          <Text className={`text-base font-bold ${saving ? 'text-ink-faint' : 'text-accent'}`}>{isDraft ? 'Start' : 'Save'}</Text>
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        // Scrolls the field being edited above the keyboard (edge-to-edge doesn't resize the window).
        bottomOffset={16}
        scrollEnabled={!reorder.dragging}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-3 gap-3">
          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            placeholder={isDraft ? 'Workout name (optional)' : 'Routine name (e.g. Push Day)'}
            placeholderTextColor={colors.subtle}
            className="rounded-[14px] bg-surface-raised px-4 py-3.5 text-[17px] font-semibold text-ink"
          />
          {hasPlan && (
            <View className="gap-1.5">
              <Text className="pl-1 text-[13px] text-ink-muted">Plan day</Text>
              <PlanDayPicker value={planDayId} onChange={setPlanDayId} showIcon={false} />
            </View>
          )}
          {!isDraft && (
            <View className="gap-1.5">
              <Text className="pl-1 text-[13px] text-ink-muted">Folder</Text>
              <FolderPicker value={folder} folders={folders} onChange={setFolder} pendingRef={pendingFolder} />
            </View>
          )}
        </View>

        {items.map((item, index) => (
          <Animated.View key={`${item.exercise_id}-${index}`} onLayout={reorder.measure(index)} style={reorder.rowStyle(index)}>
            <View
              className={`gap-3 rounded-[20px] bg-surface-raised py-3 pl-2 pr-3.5 ${labels[index] ? 'border border-superset/40' : ''}`}
              style={
                reorder.drag?.from === index
                  ? { shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 10 }
                  : undefined
              }
            >
              <View className="flex-row items-center gap-2">
                {items.length > 1 ? (
                  <DragHandle
                    label={`Drag ${item.name} to reorder`}
                    active={reorder.drag?.from === index}
                    {...reorder.handlers(index)}
                  />
                ) : (
                  <View className="w-1" />
                )}
                <Text className="flex-1 text-base font-semibold text-ink" numberOfLines={1}>
                  {labels[index] && <Text className="text-superset">{labels[index]} </Text>}
                  {item.name}
                </Text>
                <Pressable
                  onPress={() => setItems((p) => p.filter((_, i) => i !== index))}
                  hitSlop={4}
                  className="h-9 w-9 items-center justify-center rounded-full bg-surface-elevated active:opacity-70"
                  accessibilityLabel={`Remove ${item.name}`}
                >
                  <X size={16} color={colors.muted} />
                </Pressable>
              </View>

              <FieldValidityContext.Provider value={{ name: item.name, report: reportInvalid }}>
              <View className="pl-1.5">
                {item.sets ? (
                  <PerSetTable sets={item.sets} trackingType={item.tracking_type} onChange={(sets) => patch(index, { sets })} />
                ) : (
                  <View className="flex-row gap-2">
                    <Box label="Sets" grow={1.3}>
                      <Stepper value={item.target_sets} onChange={(v) => patch(index, { target_sets: Math.min(50, Math.max(1, v)) })} label="sets" />
                    </Box>
                    {usesField(item.tracking_type, 'reps') && (
                      <Box label="Reps">
                        <RepsField item={item} onChange={(p) => patch(index, p)} />
                      </Box>
                    )}
                    {usesField(item.tracking_type, 'weight') && (
                      <Box
                        label={
                          weightSign(item.tracking_type) === '+'
                            ? 'Added'
                            : weightSign(item.tracking_type) === '−'
                              ? 'Assist'
                              : 'Weight'
                        }
                      >
                        <WeightField
                          sign={weightSign(item.tracking_type)}
                          valueKg={item.target_weight_kg ?? null}
                          onChange={(kg) => patch(index, { target_weight_kg: kg })}
                        />
                      </Box>
                    )}
                    {usesField(item.tracking_type, 'distance') && (
                      <Box label="Distance">
                        <DistanceField valueM={item.target_distance_m} onChange={(m) => patch(index, { target_distance_m: m })} />
                      </Box>
                    )}
                    {usesField(item.tracking_type, 'duration') && (
                      <Box label="Time">
                        <TimeInput value={item.target_duration_s} onChange={(s) => patch(index, { target_duration_s: s })} />
                      </Box>
                    )}
                  </View>
                )}
              </View>
              </FieldValidityContext.Provider>

              <View className="flex-row flex-wrap items-center justify-between gap-3 pl-1.5">
                <View className="flex-row items-center gap-2">
                  <Text className="text-xs text-ink-muted">Rest</Text>
                  <Stepper
                    label="rest"
                    small
                    value={item.rest_seconds ?? defaultRest}
                    step={15}
                    format={formatRest}
                    onChange={(v) => patch(index, { rest_seconds: Math.min(REST_SECONDS_MAX, Math.max(0, v)) })}
                    onPressValue={() => setEditingRestIndex(index)}
                  />
                </View>
                <Pressable
                  onPress={() =>
                    patch(index, item.sets ? collapseSets(item.sets) : { sets: expandTemplateSets(item), repsError: false })
                  }
                  hitSlop={6}
                  className="rounded-lg px-2 py-1 active:bg-surface-elevated"
                >
                  <Text className="text-[13px] font-semibold text-accent">{item.sets ? 'Same for all sets' : 'Customise sets'}</Text>
                </Pressable>
              </View>
              {item.tracking_type === 'duration' && !isDraft && (
                <ToggleRow
                  label="Auto-start next set"
                  hint="Interval timer: after rest, the next set's countdown starts by itself"
                  value={item.auto_next ?? false}
                  onChange={(v) => patch(index, { auto_next: v })}
                />
              )}
            </View>
            {index < items.length - 1 ? (
              <Pressable
                onPress={() => toggleLink(index)}
                hitSlop={4}
                className={`flex-row items-center justify-center gap-1.5 py-2 ${reorder.dragging ? 'opacity-0' : ''}`}
                accessibilityLabel={isLinkedWithNext(groups, index) ? 'Unlink superset' : 'Superset with next exercise'}
              >
                {isLinkedWithNext(groups, index) ? (
                  <Unlink size={13} color={colors.superset} />
                ) : (
                  <Link2 size={13} color={colors.faint} />
                )}
                <Text className={`text-xs ${isLinkedWithNext(groups, index) ? 'text-superset' : 'text-ink-faint'}`}>
                  {isLinkedWithNext(groups, index) ? 'Superset · tap to unlink' : 'Superset with next'}
                </Text>
              </Pressable>
            ) : (
              <View className="h-2.5" />
            )}
          </Animated.View>
        ))}

        <View className="gap-3">
          <Pressable
            onPress={() => setSelectorOpen(true)}
            className="mt-1 flex-row items-center justify-center gap-2 rounded-[14px] border border-dashed border-accent/50 py-3.5 active:bg-accent-soft"
          >
            <Plus size={18} color={colors.accent} />
            <Text className="font-semibold text-accent">Add exercise</Text>
          </Pressable>
          {isDraft && (
            <Pressable
              onPress={() => void startDraft()}
              disabled={saving}
              className="mt-4 h-[52px] flex-row items-center justify-center gap-2 rounded-full bg-accent active:opacity-80"
            >
              <Play size={18} color={colors.bg} fill={colors.bg} />
              <Text className="text-base font-bold text-surface">Start workout</Text>
            </Pressable>
          )}
          {templateId && !isDraft && (
            <View className="mt-3 flex-row gap-2">
              <Pressable
                onPress={duplicate}
                className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-surface-raised active:opacity-70"
              >
                <Copy size={16} color={colors.ink} />
                <Text className="font-semibold text-ink">Duplicate</Text>
              </Pressable>
              <Pressable
                onPress={askDelete}
                className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-settype-failure/15 active:opacity-70"
              >
                <Trash2 size={16} color={colors.danger} />
                <Text className="font-semibold text-settype-failure">Delete</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAwareScrollView>

      <ExerciseSelector
        visible={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelectMany={(picked) =>
          setItems((prev) => [
            ...prev,
            ...picked.map((e, k) => ({
              exercise_id: e.id,
              name: e.name,
              order_index: prev.length + k,
              target_sets: 3,
              rest_seconds: defaultRest,
              target_weight_kg: null,
              rep_min: null,
              rep_max: null,
              sets: null,
              target_duration_s: null,
              target_distance_m: null,
              superset_group: null,
              auto_next: null,
              tracking_type: e.tracking_type,
              // Rep-based types start at 3 × 10; time / distance start empty.
              target_reps: usesField(e.tracking_type, 'reps') ? 10 : null,
            })),
          ])
        }
      />
      <DurationInputSheet
        visible={editingRestIndex !== null}
        title={editingRestIndex !== null ? `Rest: ${items[editingRestIndex]?.name ?? ''}` : 'Rest'}
        value={editingRestIndex !== null ? (items[editingRestIndex]?.rest_seconds ?? defaultRest) : defaultRest}
        min={0}
        max={REST_SECONDS_MAX}
        onClose={() => setEditingRestIndex(null)}
        onSave={(rest_seconds) => editingRestIndex !== null && patch(editingRestIndex, { rest_seconds })}
      />
      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
    </View>
  );
}

/** Per-set targets → shared targets, taken from the first working set (or the first set). */
function collapseSets(sets: TemplateSet[]): Partial<DraftItem> {
  const ref = sets.find((s) => s.set_type === 'working') ?? sets[0]!;
  return {
    sets: null,
    target_sets: sets.length,
    target_reps: ref.reps,
    rep_min: null,
    rep_max: null,
    target_weight_kg: ref.weight_kg,
    target_duration_s: ref.duration_s,
    target_distance_m: ref.distance_m,
  };
}

/* ───────────────────────────── Editor parts ───────────────────────────── */

export function FolderPicker({
  value,
  folders,
  onChange,
  pendingRef,
}: {
  value: string | null;
  folders: string[];
  onChange: (f: string | null) => void;
  /** Mirrors the folder name being typed, so the parent's Save can commit it without a blur / Enter. */
  pendingRef?: { current: string };
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  // Latest typed text for commit(): the blur that follows a chip tap must see the cleared text, not a stale closure.
  const textRef = useRef('');
  // A folder typed for this routine (not saved yet) still shows as a chip.
  const options = value && !folders.includes(value) ? [...folders, value] : folders;
  const type = (t: string) => {
    setText(t);
    textRef.current = t;
    if (pendingRef) pendingRef.current = t;
  };

  const commit = () => {
    const name = textRef.current.trim();
    if (name) onChange(name);
    setAdding(false);
    type('');
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8, alignItems: 'center' }}>
      {/* Tapping a chip wins over a half-typed new folder name. */}
      <Chip label="No folder" active={value === null} onPress={() => { type(''); setAdding(false); onChange(null); }} />
      {options.map((f) => (
        <Chip key={f} label={f} active={value === f} onPress={() => { type(''); setAdding(false); onChange(f); }} />
      ))}
      {adding ? (
        <TextInput
          value={text}
          onChangeText={type}
          onSubmitEditing={commit}
          onBlur={commit}
          autoFocus
          maxLength={60}
          placeholder="Folder name"
          placeholderTextColor={colors.faint}
          className="min-w-32 rounded-full border border-accent bg-surface-elevated px-3 py-1.5 text-sm text-ink"
        />
      ) : (
        <Pressable
          onPress={() => setAdding(true)}
          className="flex-row items-center gap-1 rounded-full border border-dashed border-surface-border px-3.5 py-2 active:opacity-70"
        >
          <FolderPlus size={14} color={colors.muted} />
          <Text className="text-sm text-ink-muted">New folder</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-3.5 py-2 ${active ? 'border-accent bg-accent-soft' : 'border-surface-raised bg-surface-raised'}`}
    >
      <Text className={`text-sm ${active ? 'font-semibold text-accent' : 'text-ink-muted'}`}>{label}</Text>
    </Pressable>
  );
}

/** Reps as text: "10" or a range "8-12". Invalid text is flagged and blocks saving. */
/** A target field: its label above a filled box. */
function Box({ label, grow = 1, children }: { label: string; grow?: number; children: React.ReactNode }) {
  return (
    <View className="min-w-0 gap-1" style={{ flex: grow }}>
      <Text className="text-xs text-ink-muted">{label}</Text>
      <View className="h-10 justify-center rounded-xl bg-surface-elevated">{children}</View>
    </View>
  );
}

function RepsField({ item, onChange }: { item: DraftItem; onChange: (p: Partial<DraftItem>) => void }) {
  const [text, setText] = useState(formatRepTarget(item));
  const change = (t: string) => {
    setText(t);
    const parsed = parseRepTarget(t);
    onChange(parsed ? { ...parsed, repsError: false } : { repsError: true });
  };
  return (
    <TextInput
      value={text}
      onChangeText={change}
      keyboardType="numbers-and-punctuation"
      placeholder="—"
      placeholderTextColor={colors.faint}
      selectTextOnFocus
      className={`h-10 rounded-xl px-2 text-center font-semibold tabular-nums text-ink ${item.repsError ? 'border border-settype-failure' : ''}`}
      accessibilityLabel="Target reps, a number or a range like 8-12"
    />
  );
}

/** Tap order for a set badge: working → warm-up → drop → failure → working. */
const TYPE_CYCLE: readonly SetType[] = ['working', 'warmup', 'drop', 'failure'];
const nextType = (t: SetType): SetType => TYPE_CYCLE[(TYPE_CYCLE.indexOf(t) + 1) % TYPE_CYCLE.length]!;

/** Per-set targets: each set's type (tap to cycle W / working / D / F) and the fields its tracking type logs. */
function PerSetTable({
  sets,
  trackingType,
  onChange,
}: {
  sets: TemplateSet[];
  trackingType: TrackingType;
  onChange: (sets: TemplateSet[]) => void;
}) {
  const units = useUnits();
  const fields = TRACKING_FIELDS[trackingType];
  const update = (i: number, p: Partial<TemplateSet>) => onChange(sets.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  // Stable row keys (sets have no ids): removing a set must not hand its inputs to the next set's row.
  const keySeq = useRef(0);
  const keys = useRef<number[]>([]);
  while (keys.current.length < sets.length) keys.current.push(keySeq.current++);
  if (keys.current.length > sets.length) keys.current = keys.current.slice(0, sets.length);
  const label = (f: SetField) =>
    f === 'weight'
      ? `${weightSign(trackingType)}${units.label}`.toUpperCase()
      : f === 'reps'
        ? 'REPS'
        : f === 'duration'
          ? 'TIME'
          : units.distanceLabel.toUpperCase();
  const input = (s: TemplateSet, i: number, f: SetField) => {
    if (f === 'weight')
      return (
        <NumberInput
          value={s.weight_kg === null ? null : Number(units.display(s.weight_kg))}
          decimal
          placeholder={trackingType === 'weighted_bodyweight' ? 'BW' : units.label}
          onChange={(v) => update(i, { weight_kg: v === null ? null : Math.min(2000, units.toKg(v)) })}
        />
      );
    if (f === 'reps')
      return <NumberInput value={s.reps} placeholder="reps" onChange={(v) => update(i, { reps: v === null ? null : Math.min(1000, Math.round(v)) })} />;
    if (f === 'duration') return <TimeInput value={s.duration_s} onChange={(v) => update(i, { duration_s: v })} />;
    return (
      <NumberInput
        value={s.distance_m === null ? null : Number(units.displayDistance(s.distance_m))}
        decimal
        placeholder={units.distanceLabel}
        onChange={(v) => update(i, { distance_m: v === null ? null : Math.min(1_000_000, units.toMeters(v)) })}
      />
    );
  };
  let working = 0;
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-2 px-1">
        <Text className="w-9 text-center text-[11px] font-semibold tracking-wider text-ink-faint">SET</Text>
        {fields.map((f) => (
          <Text key={f} className="flex-1 text-center text-[11px] font-semibold tracking-wider text-ink-faint">
            {label(f)}
          </Text>
        ))}
        <View className="w-8" />
      </View>
      {sets.map((s, i) => {
        const style = SET_TYPE_STYLE[s.set_type];
        const number = s.set_type === 'warmup' ? 0 : ++working;
        return (
          <View key={keys.current[i]} className="flex-row items-center gap-2 px-1">
            <Pressable
              onPress={() => update(i, { set_type: nextType(s.set_type) })}
              className={`h-8 w-9 items-center justify-center rounded-lg ${style.bg}`}
              accessibilityLabel={`Set ${i + 1}, ${s.set_type}. Tap to change type`}
            >
              <Text className={`font-bold ${style.text}`}>{style.label || number}</Text>
            </Pressable>
            {fields.map((f) => (
              <View key={f} className="flex-1">
                {input(s, i, f)}
              </View>
            ))}
            <Pressable
              onPress={() => {
                keys.current = keys.current.filter((_, idx) => idx !== i);
                onChange(sets.filter((_, idx) => idx !== i));
              }}
              disabled={sets.length === 1}
              hitSlop={6}
              className={`h-8 w-8 items-center justify-center rounded-lg ${sets.length === 1 ? 'opacity-30' : 'active:bg-surface-elevated'}`}
              accessibilityLabel={`Remove set ${i + 1}`}
            >
              <X size={14} color={colors.muted} />
            </Pressable>
          </View>
        );
      })}
      <Pressable
        onPress={() =>
          onChange(
            [
              ...sets,
              { ...(sets[sets.length - 1] ?? { set_type: 'working', reps: null, weight_kg: null, duration_s: null, distance_m: null }) },
            ].slice(0, 50),
          )
        }
        className="mt-1 flex-row items-center justify-center gap-1.5 rounded-lg bg-surface-elevated py-2 active:opacity-70"
      >
        <Plus size={14} color={colors.ink} />
        <Text className="text-sm font-semibold text-ink">Add set</Text>
      </Pressable>
      <Text className="text-[11px] text-ink-faint">Tap a set number to make it a warm-up, drop set or failure set.</Text>
    </View>
  );
}

/** Time box (m:ss, or keypad digits: 130 = 1:30). Reports seconds, null when empty; invalid text turns red. */
function TimeInput({ value, onChange }: { value: number | null; onChange: (seconds: number | null) => void }) {
  const [text, setText] = useState(formatDuration(value));
  const [bad, setBad] = useState(false);
  useFieldValidity(bad);
  const change = (t: string) => {
    setText(t);
    const v = parseDuration(t);
    setBad(v === undefined);
    if (v !== undefined) onChange(v);
  };
  return (
    <TextInput
      value={text}
      onChangeText={change}
      onEndEditing={() => !bad && setText(formatDuration(parseDuration(text) ?? null))}
      keyboardType="numbers-and-punctuation"
      placeholder="m:ss"
      placeholderTextColor={colors.faint}
      selectTextOnFocus
      className={`rounded-lg bg-surface-elevated px-2 py-1.5 text-center tabular-nums text-ink ${bad ? 'border border-settype-failure' : ''}`}
    />
  );
}

/** Target distance in km / mi (stored in meters). */
function DistanceField({ valueM, onChange }: { valueM: number | null; onChange: (m: number | null) => void }) {
  const units = useUnits();
  return (
    <View className="flex-row items-center pr-2.5">
      <View className="flex-1">
        <NumberInput
          value={valueM === null ? null : Number(units.displayDistance(valueM))}
          decimal
          placeholder="—"
          onChange={(v) => onChange(v === null ? null : Math.min(1_000_000, units.toMeters(v)))}
        />
      </View>
      <Text className="text-xs text-ink-subtle">{units.distanceLabel}</Text>
    </View>
  );
}

/** Numeric text box that reports a number (or null when empty) on every keystroke. */
function NumberInput({
  value,
  onChange,
  placeholder,
  decimal = false,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder: string;
  decimal?: boolean;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));
  const parse = (t: string): number | null | undefined => {
    if (t.trim() === '') return null;
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const bad = parse(text) === undefined;
  useFieldValidity(bad);
  const change = (t: string) => {
    setText(t);
    const v = parse(t);
    if (v !== undefined) onChange(v);
  };
  return (
    <TextInput
      value={text}
      onChangeText={change}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      placeholder={placeholder}
      placeholderTextColor={colors.faint}
      selectTextOnFocus
      className={`rounded-lg bg-surface-elevated px-2 py-1.5 text-center tabular-nums text-ink ${bad ? 'border border-settype-failure' : ''}`}
    />
  );
}

/**
 * Target weight in the user's unit (stored in kg). Empty = no target. Updates the draft on every
 * keystroke (it's only saved with the routine), so tapping Save straight after typing never loses it.
 */
function WeightField({
  valueKg,
  onChange,
  sign = '',
}: {
  valueKg: number | null;
  onChange: (kg: number | null) => void;
  /** "+" (added to bodyweight) or "−" (assistance). */
  sign?: string;
}) {
  const units = useUnits();
  const [text, setText] = useState(units.display(valueKg));
  useEffect(() => setText(units.display(valueKg)), [units.unit]); // eslint-disable-line react-hooks/exhaustive-deps
  const parse = (t: string): number | null | undefined => {
    if (t.trim() === '') return null;
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? Math.min(2000, units.toKg(n)) : undefined;
  };
  useFieldValidity(parse(text) === undefined);

  const change = (t: string) => {
    setText(t);
    const v = parse(t);
    if (v !== undefined) onChange(v);
  };

  return (
    <View className="flex-row items-center pr-2.5">
      <TextInput
        value={text}
        onChangeText={change}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={colors.faint}
        selectTextOnFocus
        className="h-10 flex-1 px-1 text-center font-semibold tabular-nums text-ink"
        accessibilityLabel={`Target weight in ${units.label}`}
      />
      <Text className="text-xs text-ink-subtle">
        {sign}
        {units.label}
      </Text>
    </View>
  );
}

function Stepper({
  label,
  value,
  step = 1,
  format = String,
  small = false,
  onChange,
  onPressValue,
}: {
  /** For screen readers: "sets", "rest". */
  label: string;
  value: number;
  step?: number;
  format?: (v: number) => string;
  small?: boolean;
  onChange: (v: number) => void;
  /** Makes the value tappable (e.g. to type an exact time). */
  onPressValue?: () => void;
}) {
  const button = `items-center justify-center bg-surface-border active:opacity-70 ${small ? 'h-7 w-7 rounded-[9px]' : 'h-8 w-8 rounded-[10px]'}`;
  return (
    <View className={`flex-row items-center justify-between ${small ? 'h-9 gap-1.5 rounded-xl bg-surface-elevated px-1' : 'px-1'}`}>
      <Pressable onPress={() => onChange(value - step)} className={button} accessibilityLabel={`Decrease ${label}`}>
        <Minus size={14} color={colors.ink} />
      </Pressable>
      <Pressable
        onPress={onPressValue}
        disabled={!onPressValue}
        hitSlop={6}
        accessibilityLabel={onPressValue ? `${label} ${format(value)}. Tap to type a value` : undefined}
      >
        <Text className="min-w-9 text-center font-semibold tabular-nums text-ink">{format(value)}</Text>
      </Pressable>
      <Pressable onPress={() => onChange(value + step)} className={button} accessibilityLabel={`Increase ${label}`}>
        <Plus size={14} color={colors.ink} />
      </Pressable>
    </View>
  );
}
