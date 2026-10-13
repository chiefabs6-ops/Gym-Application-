import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { saveSessionAsRoutine, type SavePrompt } from '../db/repositories/plan';
import { listFolders } from '../db/repositories/templates';
import { FolderPicker } from '../screens/RoutineBuilderScreen';
import { useSettingsStore } from '../state/settingsStore';
import { colors } from '../theme';
import { BottomSheet } from './BottomSheet';
import { PlanDayPicker } from './PlanDayPicker';

/** After finishing a workout that wasn't from a routine: keep what was logged as a new routine. */
export function SaveRoutineSheet({ prompt, onClose }: { prompt: SavePrompt | null; onClose: () => void }) {
  const plan = useSettingsStore((s) => s.training_plan);
  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState<string | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [planDayId, setPlanDayId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!prompt) return;
    const dayName = plan?.days.find((d) => d.id === prompt.planDayId)?.name;
    setTitle(prompt.title ?? (dayName ? `${dayName} day` : 'Workout'));
    setFolder(null);
    setPlanDayId(prompt.planDayId);
    void listFolders().then(setFolders);
  }, [prompt]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!prompt) return;
    setSaving(true);
    try {
      await saveSessionAsRoutine(prompt.sessionId, { title, folder, planDayId });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet visible={prompt !== null} onClose={onClose} avoidKeyboard className="gap-4 p-5">
      <Text className="text-xl font-bold text-ink">Save as routine?</Text>
      <Text className="text-sm text-ink-subtle">Keeps the exercises and sets you logged, so you can start it next time.</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        maxLength={120}
        placeholder="Routine name"
        placeholderTextColor={colors.subtle}
        className="rounded-xl bg-surface-elevated px-4 py-3.5 text-base text-ink"
      />
      <FolderPicker value={folder} folders={folders} onChange={setFolder} />
      <PlanDayPicker value={planDayId} onChange={setPlanDayId} />
      <View className="flex-row gap-3">
        <Pressable onPress={onClose} className="flex-1 items-center rounded-card border border-surface-border py-4 active:opacity-80">
          <Text className="text-base font-semibold text-ink-muted">Not now</Text>
        </Pressable>
        <Pressable
          onPress={() => void save()}
          disabled={saving}
          className="flex-1 items-center rounded-card bg-accent py-4 active:opacity-80"
        >
          <Text className="text-base font-bold text-surface">Save routine</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
