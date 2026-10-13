import { Pressable, Text, View } from 'react-native';
import { Check, Link2 } from 'lucide-react-native';
import { colors } from '../theme';

export interface SupersetMember {
  index: number;
  label: string;
  name: string;
  done: number;
  total: number;
}

/**
 * Shown on each page of a superset: every member with its label (A1, A2…) and progress, the current one
 * highlighted. Tap a member to jump to it. Ticking a set moves on to the next member automatically.
 */
export function SupersetStrip({
  members,
  currentIndex,
  onJump,
}: {
  members: SupersetMember[];
  currentIndex: number;
  onJump: (index: number) => void;
}) {
  const letter = members[0]?.label.charAt(0) ?? '';
  const circuit = members.length > 2;
  return (
    <View className="mb-3 rounded-xl border border-superset/30 bg-superset/10 p-2.5">
      <View className="mb-2 flex-row items-center gap-1.5 px-1">
        <Link2 size={14} color={colors.superset} />
        <Text className="text-xs font-bold uppercase tracking-widest text-superset">
          {circuit ? 'Circuit' : 'Superset'} {letter}
        </Text>
        <Text className="flex-1 text-right text-[11px] text-ink-subtle">Rest after the last one</Text>
      </View>
      <View className="flex-row flex-wrap gap-1.5">
        {members.map((m) => {
          const current = m.index === currentIndex;
          const complete = m.total > 0 && m.done === m.total;
          return (
            <Pressable
              key={m.index}
              onPress={() => onJump(m.index)}
              className={`flex-row items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${current ? 'bg-superset/25' : 'bg-surface-elevated'}`}
              accessibilityLabel={`${m.label} ${m.name}, ${m.done} of ${m.total} sets`}
            >
              <Text className={`text-xs font-bold ${current ? 'text-superset' : 'text-ink-muted'}`}>{m.label}</Text>
              <Text className={`max-w-32 text-xs ${current ? 'text-ink' : 'text-ink-muted'}`} numberOfLines={1}>
                {m.name}
              </Text>
              {complete ? (
                <Check size={12} color={colors.accent} strokeWidth={3} />
              ) : (
                <Text className="text-[11px] tabular-nums text-ink-subtle">
                  {m.done}/{m.total}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
