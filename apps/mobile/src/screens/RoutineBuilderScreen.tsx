import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Pressable, ScrollView, SectionList, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Folder,
  FolderPlus,
  Link2,
  ListTree,
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
import { useSettingsStore, useUnits } from '../state/settingsStore';
import { cardShadow, colors } from '../theme';

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
  n: number;
}

function RoutineList({ onNew, onEdit }: { onNew: () => void; onEdit: (id: string) => void }) {
  const start = useActiveWorkoutStore((s) => s.start);
  const discard = useActiveWorkoutStore((s) => s.discard);
  const activeSession = useActiveWorkoutStore((s) => s.sessionId);
  const startedAt = useActiveWorkoutStore((s) => s.startedAt);
  const [conflict, setConflict] = useState<{ id: string; title: string } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const { data } = useLiveQuery<RoutineRow>(
    `SELECT id, title, folder, json_array_length(template_exercises) AS n FROM workout_templates
     WHERE deleted_at IS NULL ORDER BY title COLLATE NOCASE`,
    [],
    ['workout_templates'],
  );

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
    <View className="flex-1 p-4">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-3xl font-bold text-ink">Routines</Text>
        <Pressable onPress={onNew} className="flex-row items-center gap-1 rounded-xl bg-accent px-4 py-2.5 active:opacity-80">
          <Plus size={16} color={colors.bg} />
          <Text className="font-bold text-surface">New</Text>
        </Pressable>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View className="h-2.5" />}
        ListEmptyComponent={
          <Text className="mt-6 text-center text-ink-subtle">No routines yet. Tap New to build one.</Text>
        }
        renderSectionHeader={({ section }) =>
          hasFolders ? (
            <View className="mb-2 mt-3 flex-row items-center gap-2">
              <Pressable
                onPress={() => toggle(section.key)}
                className="flex-1 flex-row items-center gap-2 py-1.5"
                accessibilityLabel={`${section.folder ?? 'No folder'}, ${section.count} routines. Tap to ${collapsed.has(section.key) ? 'expand' : 'collapse'}`}
              >
                {collapsed.has(section.key) ? (
                  <ChevronRight size={16} color={colors.subtle} />
                ) : (
                  <ChevronDown size={16} color={colors.subtle} />
                )}
                {section.folder && <Folder size={15} color={colors.muted} />}
                <Text className="text-xs font-semibold uppercase tracking-widest text-ink-subtle" numberOfLines={1}>
                  {section.folder ?? 'No folder'}
                </Text>
                <Text className="text-xs text-ink-faint">{section.count}</Text>
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
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onEdit(item.id)}
            className="flex-row items-center gap-3 rounded-card border border-surface-border bg-surface-raised p-4 active:opacity-80"
            accessibilityLabel={`${item.title}, ${item.n} exercises. Tap to edit`}
          >
            <View className="flex-1">
              <Text className="text-base font-semibold text-ink">{item.title}</Text>
              <Text className="text-xs text-ink-subtle">
                {item.n} exercise{item.n === 1 ? '' : 's'} · tap to edit
              </Text>
            </View>
            <Pressable
              onPress={() => startRoutine(item)}
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full bg-accent-soft"
              accessibilityLabel={`Start ${item.title}`}
            >
              <Play size={16} color={colors.accent} fill={colors.accent} />
            </Pressable>
            <ChevronRight size={18} color={colors.faint} />
          </Pressable>
        )}
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
  const move = (i: number, delta: -1 | 1) =>
    setItems((prev) => {
      const j = i + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

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
    return null;
  };

  const save = async () => {
    const p = problem();
    if (p) return setConfirm(p);
    const fields = { title: title.trim(), notes, folder, plan_day_id: planDayId, template_exercises: toTemplateExercises(items) };
    setSaving(true);
    try {
      if (templateId) await updateTemplate(templateId, fields);
      else await createTemplate(fields.title, fields.template_exercises, { notes, folder, planDayId });
      onDone();
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
        folder,
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

      <FlatList
        data={items}
        keyExtractor={(it, i) => `${it.exercise_id}-${i}`}
        // Scrolls the field being edited above the keyboard (edge-to-edge doesn't resize the window).
        renderScrollComponent={(props) => <KeyboardAwareScrollView {...props} bottomOffset={16} />}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View className="mb-2 gap-3">
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={isDraft ? 'Workout name (optional)' : 'Routine name (e.g. Push Day)'}
              placeholderTextColor={colors.subtle}
              className="rounded-xl bg-surface-raised px-4 py-3.5 text-base text-ink"
            />
            {!isDraft && <FolderPicker value={folder} folders={folders} onChange={setFolder} />}
          </View>
        }
        renderItem={({ item, index }) => (
          <View>
          <View
            className={`rounded-card border bg-surface-raised p-3 ${labels[index] ? 'border-superset/40' : 'border-surface-border'}`}
          >
            <View className="mb-2 flex-row items-center gap-1">
              <Text className="flex-1 text-base font-semibold text-ink" numberOfLines={1}>
                {labels[index] ? <Text className="text-superset">{labels[index]} </Text> : `${index + 1}. `}
                {item.name}
              </Text>
              <IconButton label="Move up" disabled={index === 0} onPress={() => move(index, -1)}>
                <ChevronUp size={16} color={colors.muted} />
              </IconButton>
              <IconButton label="Move down" disabled={index === items.length - 1} onPress={() => move(index, 1)}>
                <ChevronDown size={16} color={colors.muted} />
              </IconButton>
              <IconButton label={`Remove ${item.name}`} onPress={() => setItems((p) => p.filter((_, i) => i !== index))}>
                <X size={16} color={colors.muted} />
              </IconButton>
            </View>

            {item.sets ? (
              <PerSetTable sets={item.sets} trackingType={item.tracking_type} onChange={(sets) => patch(index, { sets })} />
            ) : (
              <View className="flex-row flex-wrap items-center gap-x-5 gap-y-3">
                <Stepper label="Sets" value={item.target_sets} onChange={(v) => patch(index, { target_sets: Math.min(50, Math.max(1, v)) })} />
                {usesField(item.tracking_type, 'reps') && <RepsField item={item} onChange={(p) => patch(index, p)} />}
                {usesField(item.tracking_type, 'weight') && (
                  <WeightField
                    sign={weightSign(item.tracking_type)}
                    valueKg={item.target_weight_kg ?? null}
                    onChange={(kg) => patch(index, { target_weight_kg: kg })}
                  />
                )}
                {usesField(item.tracking_type, 'distance') && (
                  <DistanceField valueM={item.target_distance_m} onChange={(m) => patch(index, { target_distance_m: m })} />
                )}
                {usesField(item.tracking_type, 'duration') && (
                  <View className="flex-row items-center gap-2">
                    <Text className="text-xs text-ink-muted">Time</Text>
                    <View className="w-20">
                      <TimeInput value={item.target_duration_s} onChange={(s) => patch(index, { target_duration_s: s })} />
                    </View>
                  </View>
                )}
              </View>
            )}

            <View className="mt-3 flex-row flex-wrap items-center justify-between gap-3">
              <Stepper
                label="Rest"
                value={item.rest_seconds ?? defaultRest}
                step={15}
                format={formatRest}
                onChange={(v) => patch(index, { rest_seconds: Math.min(REST_SECONDS_MAX, Math.max(0, v)) })}
                onPressValue={() => setEditingRestIndex(index)}
              />
              <Pressable
                onPress={() =>
                  patch(index, item.sets ? collapseSets(item.sets) : { sets: expandTemplateSets(item), repsError: false })
                }
                hitSlop={6}
                className="flex-row items-center gap-1.5 rounded-lg px-2 py-1 active:bg-surface-elevated"
              >
                <ListTree size={14} color={colors.accent} />
                <Text className="text-xs font-semibold text-accent">{item.sets ? 'Same for all sets' : 'Customise sets'}</Text>
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
          {index < items.length - 1 && (
            <Pressable
              onPress={() => toggleLink(index)}
              hitSlop={4}
              className="-mb-1 mt-1.5 flex-row items-center justify-center gap-1.5 py-1"
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
          )}
          </View>
        )}
        ListFooterComponent={
          <View className="gap-3">
            <Pressable
              onPress={() => setSelectorOpen(true)}
              className="mt-1 flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-accent/50 py-3.5 active:bg-accent-soft"
            >
              <Plus size={18} color={colors.accent} />
              <Text className="font-semibold text-accent">Add exercise</Text>
            </Pressable>
            <View className="mt-4">
              <PlanDayPicker value={planDayId} onChange={setPlanDayId} />
            </View>
            {isDraft && (
              <Pressable
                onPress={() => void startDraft()}
                disabled={saving}
                className="mt-4 flex-row items-center justify-center gap-2 rounded-card bg-accent py-4 active:opacity-80"
                style={cardShadow}
              >
                <Play size={18} color={colors.bg} fill={colors.bg} />
                <Text className="text-base font-bold text-surface">Start workout</Text>
              </Pressable>
            )}
            {templateId && !isDraft && (
              <View className="mt-4 flex-row gap-2">
                <Pressable
                  onPress={duplicate}
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-surface-border py-3 active:opacity-70"
                >
                  <Copy size={16} color={colors.muted} />
                  <Text className="font-semibold text-ink-muted">Duplicate</Text>
                </Pressable>
                <Pressable
                  onPress={askDelete}
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-settype-failure/30 py-3 active:opacity-70"
                >
                  <Trash2 size={16} color={colors.danger} />
                  <Text className="font-semibold text-settype-failure">Delete</Text>
                </Pressable>
              </View>
            )}
          </View>
        }
      />

      <ExerciseSelector
        visible={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelect={(e) =>
          setItems((prev) => [
            ...prev,
            {
              exercise_id: e.id,
              name: e.name,
              order_index: prev.length,
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
            },
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

export function FolderPicker({ value, folders, onChange }: { value: string | null; folders: string[]; onChange: (f: string | null) => void }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  // A folder typed for this routine (not saved yet) still shows as a chip.
  const options = value && !folders.includes(value) ? [...folders, value] : folders;

  const commit = () => {
    const name = text.trim();
    if (name) onChange(name);
    setAdding(false);
    setText('');
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8, alignItems: 'center' }}>
      <Folder size={16} color={colors.subtle} />
      <Chip label="No folder" active={value === null} onPress={() => onChange(null)} />
      {options.map((f) => (
        <Chip key={f} label={f} active={value === f} onPress={() => onChange(f)} />
      ))}
      {adding ? (
        <TextInput
          value={text}
          onChangeText={setText}
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
          className="flex-row items-center gap-1 rounded-full border border-dashed border-surface-border px-3 py-1.5 active:opacity-70"
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
      className={`rounded-full border px-3 py-1.5 ${active ? 'border-accent bg-accent-soft' : 'border-surface-border bg-surface-raised'}`}
    >
      <Text className={`text-sm ${active ? 'font-semibold text-accent' : 'text-ink-muted'}`}>{label}</Text>
    </Pressable>
  );
}

/** Reps as text: "10" or a range "8-12". Invalid text is flagged and blocks saving. */
function RepsField({ item, onChange }: { item: DraftItem; onChange: (p: Partial<DraftItem>) => void }) {
  const [text, setText] = useState(formatRepTarget(item));
  const change = (t: string) => {
    setText(t);
    const parsed = parseRepTarget(t);
    onChange(parsed ? { ...parsed, repsError: false } : { repsError: true });
  };
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-xs text-ink-muted">Reps</Text>
      <TextInput
        value={text}
        onChangeText={change}
        keyboardType="numbers-and-punctuation"
        placeholder="—"
        placeholderTextColor={colors.faint}
        selectTextOnFocus
        className={`w-20 rounded-lg bg-surface-elevated px-2 py-1 text-center tabular-nums text-ink ${item.repsError ? 'border border-settype-failure' : ''}`}
        accessibilityLabel="Target reps, a number or a range like 8-12"
      />
    </View>
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
          <View key={i} className="flex-row items-center gap-2 px-1">
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
              onPress={() => onChange(sets.filter((_, idx) => idx !== i))}
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
    <View className="flex-row items-center gap-2">
      <Text className="text-xs text-ink-muted">Distance</Text>
      <View className="w-16">
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
  const change = (t: string) => {
    setText(t);
    const n = Number(t.replace(',', '.'));
    if (t.trim() === '') onChange(null);
    else if (Number.isFinite(n) && n >= 0) onChange(n);
  };
  return (
    <TextInput
      value={text}
      onChangeText={change}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      placeholder={placeholder}
      placeholderTextColor={colors.faint}
      selectTextOnFocus
      className="rounded-lg bg-surface-elevated px-2 py-1.5 text-center tabular-nums text-ink"
    />
  );
}

function IconButton({ label, disabled, onPress, children }: { label: string; disabled?: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      className={`h-8 w-8 items-center justify-center rounded-lg bg-surface-elevated ${disabled ? 'opacity-30' : 'active:opacity-70'}`}
      accessibilityLabel={label}
    >
      {children}
    </Pressable>
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

  const change = (t: string) => {
    setText(t);
    const n = Number(t.replace(',', '.'));
    if (t.trim() === '') onChange(null);
    else if (Number.isFinite(n) && n >= 0) onChange(Math.min(2000, units.toKg(n)));
  };

  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-xs text-ink-muted">{sign === '+' ? 'Added' : sign === '−' ? 'Assist' : 'Weight'}</Text>
      <TextInput
        value={text}
        onChangeText={change}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={colors.faint}
        selectTextOnFocus
        className="w-16 rounded-lg bg-surface-elevated px-2 py-1 text-center tabular-nums text-ink"
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
  onChange,
  onPressValue,
}: {
  label: string;
  value: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  /** Makes the value tappable (e.g. to type an exact time). */
  onPressValue?: () => void;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-xs text-ink-muted">{label}</Text>
      <Pressable onPress={() => onChange(value - step)} className="rounded-md bg-surface-elevated p-1.5" accessibilityLabel={`Decrease ${label}`}>
        <Minus size={12} color={colors.ink} />
      </Pressable>
      <Pressable
        onPress={onPressValue}
        disabled={!onPressValue}
        hitSlop={6}
        className={onPressValue ? 'rounded border border-dashed border-surface-border px-1.5 py-0.5' : ''}
        accessibilityLabel={onPressValue ? `${label} ${format(value)}. Tap to type a value` : undefined}
      >
        <Text className="min-w-6 text-center tabular-nums text-ink">{format(value)}</Text>
      </Pressable>
      <Pressable onPress={() => onChange(value + step)} className="rounded-md bg-surface-elevated p-1.5" accessibilityLabel={`Increase ${label}`}>
        <Plus size={12} color={colors.ink} />
      </Pressable>
    </View>
  );
}

