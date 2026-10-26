import { Pressable, Text, View } from 'react-native';
import { BottomSheet } from '../BottomSheet';

export interface Choice {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'neutral';
}

/** A bottom sheet with a title, optional message and a list of buttons (meal ⋯ menu, late-night day choice). */
export function ChoiceSheet({
  visible,
  title,
  message,
  choices,
  dismissable = true,
  onClose,
}: {
  visible: boolean;
  title: string;
  message?: string;
  choices: Choice[];
  dismissable?: boolean;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} dismissable={dismissable} className="px-5 pb-8 pt-3">
      <View className="mb-4 h-1 w-10 self-center rounded-full bg-surface-border" />
      <Text className="mb-1 text-xl font-bold text-ink">{title}</Text>
      {message && <Text className="mb-4 text-sm text-ink-subtle">{message}</Text>}
      <View className="mt-2 gap-2">
        {choices.map((c) => (
          <Pressable
            key={c.label}
            onPress={() => {
              onClose();
              c.onPress();
            }}
            className={`h-13 min-h-[52px] items-center justify-center rounded-xl active:opacity-80 ${c.tone === 'primary' ? 'bg-accent' : 'bg-surface-elevated'}`}
          >
            <Text className={`text-base font-semibold ${c.tone === 'primary' ? 'text-surface' : 'text-ink'}`}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}
