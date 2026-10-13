import { Text, View } from 'react-native';
import { Trophy } from 'lucide-react-native';
import { PR_LABELS, type PRKind } from '@gym/shared';

export function PRBadge({ kinds }: { kinds: PRKind[] }) {
  if (kinds.length === 0) return null;
  return (
    <View className="flex-row flex-wrap gap-1 pl-10 pb-1">
      {kinds.map((kind) => (
        <View key={kind} className="flex-row items-center gap-1 rounded-full bg-pr/20 px-2 py-0.5">
          <Trophy size={12} color="#f59e0b" />
          <Text className="text-xs font-semibold text-pr">PR · {PR_LABELS[kind]}</Text>
        </View>
      ))}
    </View>
  );
}
