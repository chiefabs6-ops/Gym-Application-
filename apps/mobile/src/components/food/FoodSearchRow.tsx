import { Pressable, Text, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { colors } from '../../theme';

/** One row of the add-food lists: name, a detail line, optional "+" for one-tap logging. */
export function FoodSearchRow({
  title,
  detail,
  onPress,
  onLongPress,
  onAdd,
}: {
  title: string;
  detail: string;
  onPress: () => void;
  onLongPress?: () => void;
  onAdd?: () => void;
}) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} className="flex-row items-center gap-3 border-t border-surface-border px-4 py-3 active:bg-surface-elevated">
      <View className="flex-1">
        <Text className="text-ink" numberOfLines={2}>
          {title}
        </Text>
        <Text className="text-xs text-ink-subtle" numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {onAdd && (
        <Pressable onPress={onAdd} hitSlop={8} className="h-8 w-8 items-center justify-center rounded-full bg-accent-soft active:opacity-70" accessibilityLabel={`Add ${title}`}>
          <Plus size={18} color={colors.accent} />
        </Pressable>
      )}
    </Pressable>
  );
}

export function SectionTitle({ title }: { title: string }) {
  return <Text className="px-4 pb-1 pt-4 text-xs uppercase tracking-wider text-ink-subtle">{title}</Text>;
}
