import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, Trash2 } from 'lucide-react-native';
import { SET_TYPES, type SetType } from '@gym/shared';
import { removeSet, updateSet, updateSetNotes } from '../db/repositories/workouts';
import { colors } from '../theme';
import { SET_TYPE_STYLE, type SetViewRow } from './SetRow';
import { BottomSheet } from './BottomSheet';

const DESCRIPTIONS: Record<SetType, { title: string; hint: string }> = {
  warmup: { title: 'Warm-up', hint: 'Excluded from volume and PRs' },
  working: { title: 'Working set', hint: 'Normal set' },
  drop: { title: 'Drop set', hint: 'Reduced weight straight after a set' },
  failure: { title: 'Failure', hint: 'Taken to muscular failure' },
};

/** Bottom sheet for one set: tag its type (W / D / F), add a note, or delete it. */
export function SetTypeSheet({ set, onClose }: { set: SetViewRow | null; onClose: () => void }) {
  const [note, setNote] = useState('');
  useEffect(() => {
    if (set) setNote(set.notes ?? '');
  }, [set]);

  /** Saves a changed note, then closes. Every way out of the sheet goes through here. */
  const close = () => {
    if (set && (note.trim() || null) !== set.notes) void updateSetNotes(set.id, note);
    onClose();
  };
  const choose = (type: SetType) => {
    if (set && type !== set.set_type) {
      void Haptics.selectionAsync();
      void updateSet(set.id, { set_type: type });
    }
    close();
  };

  return (
    <BottomSheet visible={set !== null} animationType="fade" onClose={close} avoidKeyboard className="gap-1 p-4 pb-8">
      <View className="mb-2 h-1 w-10 self-center rounded-full bg-surface-border" />
      <Text className="mb-2 px-2 text-xs font-semibold uppercase tracking-widest text-ink-subtle">Set</Text>
      {SET_TYPES.map((type) => {
        const style = SET_TYPE_STYLE[type];
        const active = set?.set_type === type;
        return (
          <Pressable
            key={type}
            onPress={() => choose(type)}
            className={`flex-row items-center gap-3 rounded-xl px-3 py-3 ${active ? 'bg-surface-elevated' : ''}`}
          >
            <View className={`h-8 w-8 items-center justify-center rounded-lg ${style.bg}`}>
              <Text className={`font-bold ${style.text}`}>{style.label || '1'}</Text>
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-ink">{DESCRIPTIONS[type].title}</Text>
              <Text className="text-xs text-ink-subtle">{DESCRIPTIONS[type].hint}</Text>
            </View>
            {active && <Check size={18} color={colors.accent} />}
          </Pressable>
        );
      })}
      <TextInput
        value={note}
        onChangeText={setNote}
        onSubmitEditing={close}
        maxLength={500}
        placeholder="Note for this set (optional)"
        placeholderTextColor={colors.faint}
        returnKeyType="done"
        className="mt-2 rounded-xl bg-surface-elevated px-3 py-2.5 text-sm text-ink"
      />
      <Pressable
        onPress={() => {
          if (set) void removeSet(set.id);
          onClose();
        }}
        className="mt-2 flex-row items-center gap-3 rounded-xl px-3 py-3"
      >
        <View className="h-8 w-8 items-center justify-center rounded-lg bg-settype-failure/15">
          <Trash2 size={16} color={colors.danger} />
        </View>
        <Text className="font-semibold text-settype-failure">Delete set</Text>
      </Pressable>
    </BottomSheet>
  );
}
