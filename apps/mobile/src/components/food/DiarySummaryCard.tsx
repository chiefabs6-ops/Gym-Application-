import { Pressable, Text, View } from 'react-native';
import type { MacroTotals, Targets } from '@gym/shared';

const n0 = (v: number) => Math.round(v).toLocaleString();

/** "Calories remaining" as Goal − Food = Left, then protein / carbs / fat bars (spec §5.1). Over target = red. */
export function DiarySummaryCard({
  totals,
  targets,
  hasProfile,
  onSetUp,
}: {
  totals: MacroTotals;
  targets: Targets | null;
  hasProfile: boolean;
  onSetUp: () => void;
}) {
  if (!targets) {
    return (
      <View className="gap-3 rounded-card bg-surface-raised p-4">
        <View className="flex-row items-end justify-between">
          <Text className="text-sm text-ink-muted">Eaten</Text>
          <Text className="text-2xl font-bold tabular-nums text-ink">{n0(totals.kcal)} kcal</Text>
        </View>
        <Text className="text-sm text-ink-subtle">
          P {n0(totals.protein_g)} g · C {n0(totals.carbs_g)} g · F {n0(totals.fat_g)} g
        </Text>
        {hasProfile ? (
          <Text className="text-xs text-ink-subtle">No targets for this day yet.</Text>
        ) : (
          <Pressable onPress={onSetUp} className="h-11 items-center justify-center rounded-xl bg-accent active:opacity-80">
            <Text className="font-bold text-surface">Set up your targets</Text>
          </Pressable>
        )}
      </View>
    );
  }
  const left = targets.kcal - totals.kcal;
  return (
    <View className="gap-3 rounded-card bg-surface-raised p-4">
      <Text className="text-xs text-ink-muted">Calories remaining</Text>
      {/* Goal − Food = Left, centred, with what's left as the big figure. */}
      <View className="flex-row items-end justify-center gap-3.5">
        <Figure value={n0(targets.kcal)} label="Goal" />
        <Text className="pb-[18px] text-ink-subtle">−</Text>
        <Figure value={n0(totals.kcal)} label="Food" />
        <Text className="pb-[18px] text-ink-subtle">=</Text>
        <Figure value={n0(left)} label="Left" big className={left < 0 ? 'text-settype-failure' : 'text-accent'} />
      </View>
      <View className="mt-0.5 flex-row gap-3">
        <MacroBar label="Protein" eaten={totals.protein_g} target={targets.protein_g} color="bg-macro-protein" redWhenOver={false} />
        <MacroBar label="Carbs" eaten={totals.carbs_g} target={targets.carbs_g} color="bg-macro-carbs" />
        <MacroBar label="Fat" eaten={totals.fat_g} target={targets.fat_g} color="bg-macro-fat" />
      </View>
    </View>
  );
}

function Figure({ value, label, big = false, className = 'text-ink' }: { value: string; label: string; big?: boolean; className?: string }) {
  return (
    <View className="items-center">
      <Text className={`font-bold tabular-nums ${big ? 'text-[34px] leading-[38px]' : 'text-xl'} ${className}`}>{value}</Text>
      <Text className="text-[11px] text-ink-muted">{label}</Text>
    </View>
  );
}

/** One of three side-by-side columns. Over target turns red, except protein (going over on protein isn't a problem; user decision). */
function MacroBar({
  label,
  eaten,
  target,
  color,
  redWhenOver = true,
}: {
  label: string;
  eaten: number;
  target: number;
  color: string;
  redWhenOver?: boolean;
}) {
  const over = redWhenOver && eaten > target;
  const pct = target > 0 ? Math.min(100, (eaten / target) * 100) : 0;
  return (
    <View className="flex-1 gap-1">
      <Text className="text-xs text-ink-muted">{label}</Text>
      <Text className={`text-[15px] font-semibold tabular-nums ${over ? 'text-settype-failure' : 'text-ink'}`}>
        {n0(eaten)}
        <Text className="text-xs font-normal text-ink-muted"> / {n0(target)} g</Text>
      </Text>
      <View className="h-[5px] overflow-hidden rounded-full bg-surface-elevated">
        <View className={`h-full rounded-full ${over ? 'bg-settype-failure' : color}`} style={{ width: `${pct}%` }} />
      </View>
    </View>
  );
}
