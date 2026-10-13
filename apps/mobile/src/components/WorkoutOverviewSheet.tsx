import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { ArrowLeftRight, CheckCircle2, ChevronDown, ChevronUp, Circle, Link2, Plus, Trash2, Unlink } from 'lucide-react-native';
import { isLinkedWithNext } from '@gym/shared';
import { colors } from '../theme';
import { ConfirmSheet, type ConfirmRequest } from './ConfirmSheet';
import { BottomSheet } from './BottomSheet';

export interface OverviewItem {
  id: string;
  name: string;
  done: number;
  total: number;
  /** Superset label (A1, A2…) or null. */
  label?: string | null;
}

interface Props {
  visible: boolean;
  items: OverviewItem[];
  currentIndex: number;
  onClose: () => void;
  onJump: (index: number) => void;
  onAddExercise: () => void;
  onRemove: (sessionExerciseId: string) => void;
  /** Superset group per exercise (same order as items) and a handler to link/unlink i with i + 1. */
  groups?: readonly (string | null)[];
  onToggleLink?: (index: number) => void;
  onMove?: (index: number, delta: -1 | 1) => void;
  onReplace?: (sessionExerciseId: string) => void;
}

/** Drawer listing the whole workout: jump to any exercise, add or remove exercises. */
export function WorkoutOverviewSheet({
  visible,
  items,
  currentIndex,
  onClose,
  onJump,
  onAddExercise,
  onRemove,
  groups = [],
  onToggleLink,
  onMove,
  onReplace,
}: Props) {
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const confirmRemove = (item: OverviewItem) =>
    setConfirm({
      title: `Remove ${item.name}?`,
      message:
        item.done > 0
          ? `${item.done} completed set${item.done === 1 ? '' : 's'} in this workout will be deleted.`
          : 'Its sets in this workout will be deleted.',
      confirmLabel: 'Remove exercise',
      tone: 'destructive',
      onConfirm: () => onRemove(item.id),
    });

  return (
    <>
    <BottomSheet visible={visible} animationType="slide" onClose={onClose} className="max-h-[80%] pb-6">
      <View className="my-3 h-1 w-10 self-center rounded-full bg-surface-border" />
      <View className="flex-row items-center justify-between px-5 pb-3">
        <Text className="text-lg font-bold text-ink">Workout overview</Text>
        <Text className="text-sm text-ink-subtle">
          {items.reduce((n, i) => n + i.done, 0)}/{items.reduce((n, i) => n + i.total, 0)} sets
        </Text>
      </View>

      <FlatList
        style={{ flexShrink: 1 }}
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 12 }}
        renderItem={({ item, index }) => {
          const current = index === currentIndex;
          const complete = item.total > 0 && item.done === item.total;
          const linked = isLinkedWithNext(groups, index);
          return (
            <View>
            <Pressable
              onPress={() => onJump(index)}
              onLongPress={() => confirmRemove(item)}
              className={`flex-row items-center gap-3 rounded-xl px-3 py-3 ${
                current ? 'border border-accent/40 bg-accent-soft' : 'bg-surface-elevated'
              }`}
            >
              {complete ? <CheckCircle2 size={20} color={colors.accent} /> : <Circle size={20} color={colors.faint} />}
              <View className="flex-1">
                <Text className={`font-semibold ${current ? 'text-accent' : 'text-ink'}`} numberOfLines={1}>
                  {item.label ? <Text className="text-superset">{item.label} </Text> : `${index + 1}. `}
                  {item.name}
                </Text>
                <Text className="text-xs text-ink-subtle">
                  {item.done}/{item.total} sets done
                </Text>
              </View>
              {onMove && (
                <View className="flex-row gap-1">
                  <RowIcon label={`Move ${item.name} up`} disabled={index === 0} onPress={() => onMove(index, -1)}>
                    <ChevronUp size={16} color={colors.muted} />
                  </RowIcon>
                  <RowIcon label={`Move ${item.name} down`} disabled={index === items.length - 1} onPress={() => onMove(index, 1)}>
                    <ChevronDown size={16} color={colors.muted} />
                  </RowIcon>
                </View>
              )}
              {onReplace && (
                <RowIcon label={`Replace ${item.name}`} onPress={() => onReplace(item.id)}>
                  <ArrowLeftRight size={15} color={colors.muted} />
                </RowIcon>
              )}
              <Pressable onPress={() => confirmRemove(item)} hitSlop={10} accessibilityLabel={`Remove ${item.name}`}>
                <Trash2 size={16} color={colors.faint} />
              </Pressable>
            </Pressable>
            {onToggleLink && index < items.length - 1 ? (
              <Pressable
                onPress={() => onToggleLink(index)}
                hitSlop={4}
                className="flex-row items-center justify-center gap-1.5 py-1.5"
                accessibilityLabel={linked ? 'Unlink superset' : 'Superset with next exercise'}
              >
                {linked ? <Unlink size={13} color={colors.superset} /> : <Link2 size={13} color={colors.faint} />}
                <Text className={`text-xs ${linked ? 'text-superset' : 'text-ink-faint'}`}>
                  {linked ? 'Superset · tap to unlink' : 'Superset with next'}
                </Text>
              </Pressable>
            ) : (
              <View className="h-1.5" />
            )}
            </View>
          );
        }}
        ListFooterComponent={
          <Pressable
            onPress={onAddExercise}
            className="mt-2 flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-accent/50 py-3"
          >
            <Plus size={18} color={colors.accent} />
            <Text className="font-semibold text-accent">Add exercise</Text>
          </Pressable>
        }
      />
    </BottomSheet>
      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}

function RowIcon({ label, disabled, onPress, children }: { label: string; disabled?: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      className={`h-8 w-8 items-center justify-center rounded-lg bg-surface ${disabled ? 'opacity-30' : 'active:opacity-70'}`}
      accessibilityLabel={label}
    >
      {children}
    </Pressable>
  );
}
