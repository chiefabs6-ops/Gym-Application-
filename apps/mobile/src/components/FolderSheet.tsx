import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Folder, FolderMinus } from 'lucide-react-native';
import { colors } from '../theme';
import { BottomSheet } from './BottomSheet';

interface Props {
  /** Folder being renamed; null hides the sheet. */
  folder: string | null;
  routineCount: number;
  onClose: () => void;
  /** New name, or null to take the routines out of the folder. */
  onSave: (name: string | null) => void;
}

/** Routines tab → folder header "…": rename the folder, or remove it (its routines stay, unfiled). */
export function FolderSheet({ folder, routineCount, onClose, onSave }: Props) {
  const [name, setName] = useState('');
  useEffect(() => {
    if (folder !== null) setName(folder);
  }, [folder]);
  const trimmed = name.trim();

  return (
    <BottomSheet visible={folder !== null} onClose={onClose} avoidKeyboard className="px-5 pb-8 pt-3">
      <View className="mb-4 h-1 w-10 self-center rounded-full bg-surface-border" />
      <View className="mb-4 flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-accent-soft">
          <Folder size={20} color={colors.accent} />
        </View>
        <View className="flex-1">
          <Text className="text-xl font-bold text-ink">Rename folder</Text>
          <Text className="text-sm text-ink-subtle">
            {routineCount} routine{routineCount === 1 ? '' : 's'}. Using another folder’s name merges them.
          </Text>
        </View>
      </View>
      <TextInput
        value={name}
        onChangeText={setName}
        maxLength={60}
        autoFocus
        selectTextOnFocus
        placeholder="Folder name"
        placeholderTextColor={colors.faint}
        className="mb-4 rounded-xl bg-surface-elevated px-3 py-3 text-base text-ink"
      />
      <Pressable
        onPress={() => onSave(trimmed)}
        disabled={!trimmed}
        className={`mb-2 h-14 items-center justify-center rounded-xl bg-accent ${trimmed ? 'active:opacity-80' : 'opacity-40'}`}
      >
        <Text className="text-base font-bold text-surface">Save</Text>
      </Pressable>
      <View className="flex-row gap-2">
        <Pressable onPress={onClose} className="h-12 flex-1 items-center justify-center rounded-xl bg-surface-elevated active:opacity-70">
          <Text className="font-semibold text-ink">Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => onSave(null)}
          className="h-12 flex-row items-center justify-center gap-2 rounded-xl border border-surface-border px-4 active:opacity-70"
        >
          <FolderMinus size={16} color={colors.muted} />
          <Text className="font-semibold text-ink-muted">Remove folder</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
