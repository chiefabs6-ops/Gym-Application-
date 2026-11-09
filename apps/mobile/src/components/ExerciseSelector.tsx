import { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Archive, Pencil, Plus, Search, X } from 'lucide-react-native';
import { MUSCLE_GROUPS, type ExerciseDefinitionRow, type MuscleGroup } from '@gym/shared';
import { useLiveQuery } from '../db/useLiveQuery';
import { colors } from '../theme';
import { shortDay } from './dates';
import { ExerciseEditorSheet, type ExerciseEditorTarget } from './ExerciseEditorSheet';

export type ExerciseListItem = Pick<ExerciseDefinitionRow, 'id' | 'name' | 'primary_muscle' | 'equipment' | 'tracking_type'>;
type Row = ExerciseListItem & Pick<ExerciseDefinitionRow, 'archived_at'> & { custom: number };
type RecentRow = Row & { last_at: number };

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Single pick (e.g. replacing an exercise): tapping one picks it and closes. */
  onSelect?: (exercise: ExerciseListItem) => void;
  /**
   * Pick several: tapping toggles a numbered tick, and "Add N exercises" hands them over in the order they were
   * ticked. When set, this is used instead of onSelect.
   */
  onSelectMany?: (exercises: ExerciseListItem[]) => void;
}

const muscleLabel = (m: string) => {
  const s = m.replace('_', ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/**
 * Exercise picker: search or filter by muscle, recently done ones first, pick one or several; create a custom
 * exercise (also straight from a search with no match); edit / archive custom ones via the pencil; "Show archived"
 * lists archived ones so they can be restored.
 */
export function ExerciseSelector({ visible, onClose, onSelect, onSelectMany }: Props) {
  const multi = !!onSelectMany;
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [editor, setEditor] = useState<ExerciseEditorTarget | null>(null);
  const [picked, setPicked] = useState<ExerciseListItem[]>([]);

  const { data } = useLiveQuery<Row>(
    `SELECT id, name, primary_muscle, equipment, tracking_type, archived_at, (user_id IS NOT NULL) AS custom
     FROM exercise_definitions
     WHERE deleted_at IS NULL AND name LIKE ? AND (archived_at IS NOT NULL) = ? AND (? IS NULL OR primary_muscle = ?)
     ORDER BY name COLLATE NOCASE LIMIT 300`,
    [`%${query.trim()}%`, showArchived ? 1 : 0, muscle, muscle],
    ['exercise_definitions'],
  );
  // Done in finished workouts lately: what you'll most likely add again.
  const { data: recent } = useLiveQuery<RecentRow>(
    `SELECT e.id, e.name, e.primary_muscle, e.equipment, e.tracking_type, e.archived_at, (e.user_id IS NOT NULL) AS custom,
            MAX(ws.start_time) AS last_at
     FROM session_exercises se
     JOIN workout_sessions ws ON ws.id = se.session_id
     JOIN exercise_definitions e ON e.id = se.exercise_id
     WHERE se.deleted_at IS NULL AND ws.deleted_at IS NULL AND ws.end_time IS NOT NULL
       AND e.deleted_at IS NULL AND e.archived_at IS NULL AND (? IS NULL OR e.primary_muscle = ?)
     GROUP BY e.id ORDER BY last_at DESC LIMIT 5`,
    [muscle, muscle],
    ['session_exercises', 'workout_sessions', 'exercise_definitions'],
  );
  const { data: archivedCount } = useLiveQuery<{ n: number }>(
    `SELECT COUNT(*) AS n FROM exercise_definitions WHERE deleted_at IS NULL AND archived_at IS NOT NULL`,
    [],
    ['exercise_definitions'],
  );
  const archived = archivedCount[0]?.n ?? 0;
  const showRecent = !showArchived && query.trim() === '' && recent.length > 0;

  const close = () => {
    setQuery('');
    setMuscle(null);
    setShowArchived(false);
    setPicked([]);
    onClose();
  };
  const pickOne = (e: ExerciseListItem) => {
    onSelect?.(e);
    close();
  };
  const toggle = (e: ExerciseListItem) =>
    setPicked((list) => (list.some((p) => p.id === e.id) ? list.filter((p) => p.id !== e.id) : [...list, e]));
  const tap = (e: ExerciseListItem) => (multi ? toggle(e) : pickOne(e));
  const addPicked = () => {
    onSelectMany?.(picked);
    close();
  };
  const edit = (item: Row) => setEditor({ mode: 'edit', exercise: item });
  const order = (id: string) => picked.findIndex((p) => p.id === id) + 1;

  const renderRow = (item: Row, sub: string) => {
    const n = order(item.id);
    return (
      <Pressable
        key={item.id}
        onPress={() => (showArchived ? edit(item) : tap(item))}
        className={`flex-row items-center gap-3 border-b border-surface-border px-4 py-3 active:bg-surface-raised ${n ? 'bg-accent/5' : ''}`}
        accessibilityState={multi ? { checked: n > 0 } : undefined}
      >
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className={`text-base ${showArchived ? 'text-ink-muted' : 'text-ink'}`}>{item.name}</Text>
            {item.custom === 1 && (
              <View className="rounded-full bg-accent-soft px-2 py-0.5">
                <Text className="text-[10px] font-bold uppercase tracking-wider text-accent">Custom</Text>
              </View>
            )}
          </View>
          <Text className="text-xs capitalize text-ink-muted">{sub}</Text>
        </View>
        {item.custom === 1 && !showArchived && (
          <Pressable
            onPress={() => edit(item)}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-lg active:bg-surface-elevated"
            accessibilityLabel={`Edit ${item.name}`}
          >
            <Pencil size={16} color={colors.subtle} />
          </Pressable>
        )}
        {multi && !showArchived && (
          <View
            className={`h-[26px] w-[26px] items-center justify-center rounded-full border-2 ${n ? 'border-accent bg-accent' : 'border-ink-faint'}`}
          >
            {n > 0 && <Text className="text-[13px] font-bold text-surface">{n}</Text>}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View className="flex-1 bg-surface pt-12">
        <View className="flex-row items-center gap-3 px-4 pb-2.5">
          <View className="flex-1 flex-row items-center gap-2 rounded-lg bg-surface-raised px-3">
            <Search size={16} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={showArchived ? 'Search archived' : 'Search exercises'}
              placeholderTextColor={colors.subtle}
              autoFocus={!multi}
              className="flex-1 py-2.5 text-ink"
            />
          </View>
          <Pressable
            onPress={() => setEditor({ mode: 'new', name: query.trim() })}
            className="flex-row items-center gap-1 rounded-lg bg-accent-soft px-3 py-2.5 active:opacity-70"
            accessibilityLabel="Create a custom exercise"
          >
            <Plus size={16} color={colors.accent} />
            <Text className="font-semibold text-accent">New</Text>
          </Pressable>
          <Pressable onPress={close} accessibilityLabel="Close">
            <X size={22} color={colors.muted} />
          </Pressable>
        </View>

        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingBottom: 10 }}
          >
            {[null, ...MUSCLE_GROUPS].map((m) => {
              const active = m === muscle;
              return (
                <Pressable
                  key={m ?? 'all'}
                  onPress={() => setMuscle(m)}
                  className={`rounded-full border px-3 py-1.5 ${active ? 'border-accent bg-accent-soft' : 'border-surface-border bg-surface-raised'}`}
                  accessibilityState={{ selected: active }}
                >
                  <Text className={`text-[13px] ${active ? 'font-semibold text-accent' : 'text-ink-muted'}`}>
                    {m ? muscleLabel(m) : 'All'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {showArchived && (
          <View className="mx-4 mb-2 flex-row items-center gap-2 rounded-lg bg-surface-raised px-3 py-2">
            <Archive size={14} color={colors.muted} />
            <Text className="flex-1 text-sm text-ink-muted">Archived exercises. Tap one to restore or edit it.</Text>
          </View>
        )}

        <FlatList
          data={data}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: picked.length > 0 ? 96 : 16 }}
          ListHeaderComponent={
            showArchived ? null : (
              <View>
                {showRecent && (
                  <>
                    <Text className="px-4 pb-1.5 pt-2 text-[13px] font-semibold text-ink-muted">Recent</Text>
                    {recent.map((r) =>
                      renderRow(r, `${r.primary_muscle.replace('_', ' ')} · ${r.equipment} · last ${shortDay(r.last_at)}`),
                    )}
                  </>
                )}
                <Text className="px-4 pb-1.5 pt-3.5 text-[13px] font-semibold text-ink-muted">
                  {muscle ? `${muscleLabel(muscle)} · all exercises` : 'All exercises'}
                </Text>
              </View>
            )
          }
          ListEmptyComponent={
            showArchived ? (
              <Text className="p-6 text-center text-ink-subtle">No archived exercises match.</Text>
            ) : (
              <Pressable
                onPress={() => setEditor({ mode: 'new', name: query.trim() })}
                className="m-4 flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-accent/50 py-4 active:bg-accent-soft"
              >
                <Plus size={18} color={colors.accent} />
                <Text className="font-semibold text-accent">
                  {query.trim() ? `Create “${query.trim()}”` : 'Create a custom exercise'}
                </Text>
              </Pressable>
            )
          }
          ListFooterComponent={
            archived > 0 ? (
              <Pressable onPress={() => setShowArchived((v) => !v)} className="items-center py-5 active:opacity-70">
                <Text className="text-sm font-semibold text-ink-subtle">
                  {showArchived ? 'Back to all exercises' : `Show archived (${archived})`}
                </Text>
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => renderRow(item, `${item.primary_muscle.replace('_', ' ')} · ${item.equipment}`)}
        />

        {multi && picked.length > 0 && !showArchived && (
          <Pressable
            onPress={addPicked}
            className="absolute bottom-5 left-4 right-4 h-14 items-center justify-center rounded-full bg-accent active:opacity-80"
            style={{ shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 8 }}
          >
            <Text className="text-base font-bold text-surface">
              Add {picked.length} exercise{picked.length === 1 ? '' : 's'}
            </Text>
          </Pressable>
        )}
      </View>

      <ExerciseEditorSheet
        target={editor}
        onClose={() => setEditor(null)}
        onSaved={(e) => {
          // A brand-new exercise is picked straight away (ticked, when picking several); edits just update the list.
          if (editor?.mode !== 'new') return;
          if (multi) setPicked((list) => [...list, e]);
          else pickOne(e);
        }}
      />
    </Modal>
  );
}
