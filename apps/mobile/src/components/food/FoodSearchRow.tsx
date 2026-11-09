import { Pressable, Text, View } from 'react-native';
import { Check, Plus } from 'lucide-react-native';
import { colors } from '../../theme';

/** One row of the add-food lists: name, a detail line, optional "+" for one-tap logging. */
export function FoodSearchRow({
  title,
  detail,
  onPress,
  onLongPress,
  onAdd,
  added = false,
}: {
  title: string;
  detail: string;
  onPress: () => void;
  onLongPress?: () => void;
  onAdd?: () => void;
  /** Already logged on this visit: the + becomes a filled tick (tapping it still adds another). */
  added?: boolean;
}) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} className="flex-row items-center gap-3 border-t border-surface-raised px-4 py-3 active:bg-surface-elevated">
      <View className="flex-1">
        <Text className="text-ink" numberOfLines={2}>
          {title}
        </Text>
        <Text className="text-xs text-ink-muted" numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {onAdd && (
        <Pressable
          onPress={onAdd}
          hitSlop={8}
          className={`h-9 w-9 items-center justify-center rounded-full active:opacity-70 ${added ? 'bg-accent' : 'bg-accent-soft'}`}
          accessibilityLabel={added ? `${title} added. Add another` : `Add ${title}`}
        >
          {added ? <Check size={16} strokeWidth={3} color={colors.bg} /> : <Plus size={18} color={colors.accent} />}
        </Pressable>
      )}
    </Pressable>
  );
}

export function SectionTitle({ title }: { title: string }) {
  return <Text className="px-4 pb-1.5 pt-4 text-[13px] font-semibold text-ink-muted">{title}</Text>;
}
