import { useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Archive, Pencil, Plus, Search, X } from 'lucide-react-native';
import type { ExerciseDefinitionRow } from '@gym/shared';
import { useLiveQuery } from '../db/useLiveQuery';
import { colors } from '../theme';
import { ExerciseEditorSheet, type ExerciseEditorTarget } from './ExerciseEditorSheet';

export type ExerciseListItem = Pick<ExerciseDefinitionRow, 'id' | 'name' | 'primary_muscle' | 'equipment' | 'tracking_type'>;
type Row = ExerciseListItem & Pick<ExerciseDefinitionRow, 'archived_at'> & { custom: number };

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: ExerciseListItem) => void;
}

/**
 * Exercise picker: search, pick; create a custom exercise (also straight from a search with no match);
 * edit / archive custom ones via the pencil; "Show archived" lists archived ones so they can be restored.
 */
export function ExerciseSelector({ visible, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editor, setEditor] = useState<ExerciseEditorTarget | null>(null);

  const { data } = useLiveQuery<Row>(
    `SELECT id, name, primary_muscle, equipment, tracking_type, archived_at, (user_id IS NOT NULL) AS custom
     FROM exercise_definitions
     WHERE deleted_at IS NULL AND name LIKE ? AND (archived_at IS NOT NULL) = ?
     ORDER BY name COLLATE NOCASE LIMIT 300`,
    [`%${query.trim()}%`, showArchived ? 1 : 0],
    ['exercise_definitions'],
  );
  const { data: archivedCount } = useLiveQuery<{ n: number }>(
    `SELECT COUNT(*) AS n FROM exercise_definitions WHERE deleted_at IS NULL AND archived_at IS NOT NULL`,
    [],
    ['exercise_definitions'],
  );
  const archived = archivedCount[0]?.n ?? 0;

  const close = () => {
    setQuery('');
    setShowArchived(false);
    onClose();
  };
  const pick = (e: ExerciseListItem) => {
    onSelect(e);
    close();
  };
  const edit = (item: Row) => setEditor({ mode: 'edit', exercise: item });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View className="flex-1 bg-surface pt-12">
        <View className="flex-row items-center gap-3 px-4 pb-3">
          <View className="flex-1 flex-row items-center gap-2 rounded-lg bg-surface-raised px-3">
            <Search size={16} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={showArchived ? 'Search archived' : 'Search exercises'}
              placeholderTextColor={colors.subtle}
              autoFocus
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
          renderItem={({ item }) => (
            <Pressable
              onPress={() => (showArchived ? edit(item) : pick(item))}
              className="flex-row items-center gap-3 border-b border-surface-border px-4 py-3 active:bg-surface-raised"
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
                <Text className="text-xs capitalize text-ink-muted">
                  {item.primary_muscle.replace('_', ' ')} · {item.equipment}
                </Text>
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
            </Pressable>
          )}
        />
      </View>

      <ExerciseEditorSheet
        target={editor}
        onClose={() => setEditor(null)}
        onSaved={(e) => {
          // A brand-new exercise is picked straight away; edits just update the list.
          if (editor?.mode === 'new') pick(e);
        }}
      />
    </Modal>
  );
}
