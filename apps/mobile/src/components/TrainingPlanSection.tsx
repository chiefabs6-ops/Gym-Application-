import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { CalendarDays, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react-native';
import {
  addPlanDay,
  MAX_PLAN_DAYS,
  movePlanDay,
  PLAN_PRESETS,
  planFromPreset,
  removedDayIds,
  removePlanDay,
  renamePlanDay,
  type TrainingPlan,
} from '@gym/shared';
import { countLinkedRoutines, setTrainingPlan } from '../db/repositories/plan';
import { useSettingsStore } from '../state/settingsStore';
import { colors } from '../theme';
import { ConfirmSheet, type ConfirmRequest } from './ConfirmSheet';
import { SettingsCard } from './SettingsControls';

/** Training split: pick a preset, then rename / add / remove / reorder its days. Days run as a rotation. */
export function TrainingPlanSection() {
  const plan = useSettingsStore((s) => s.training_plan);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  /** Applies a change, confirming first when routines would lose their day. */
  const apply = async (next: TrainingPlan | null, what: string, removed = removedDayIds(plan, next)) => {
    const linked = await countLinkedRoutines(removed);
    if (linked === 0) return void setTrainingPlan(next, removed);
    setConfirm({
      title: what,
      message: `${linked} routine${linked === 1 ? '' : 's'} will no longer be linked to a plan day.`,
      confirmLabel: 'Continue',
      tone: 'destructive',
      onConfirm: () => void setTrainingPlan(next, removed),
    });
  };

  return (
    <SettingsCard title="Training plan" icon={<CalendarDays size={18} color={colors.accent} />}>
      <Text className="mb-2 text-xs leading-4 text-ink-subtle">
        Days run in order. The Workout tab offers the day after your last finished one.
      </Text>
      <View className="flex-row flex-wrap gap-2 py-2">
        <PresetChip label="None" active={plan === null} onPress={() => void setTrainingPlan(null)} />
        {PLAN_PRESETS.map((p) => (
          <PresetChip
            key={p.id}
            label={p.name}
            active={plan?.preset === p.id}
            onPress={() => void apply(planFromPreset(p.id), `Switch to ${p.name}?`)}
          />
        ))}
      </View>

      {plan?.days.map((d, i) => (
        <View key={d.id} className="flex-row items-center gap-1 py-1.5">
          <Text className="w-6 text-sm text-ink-subtle">{i + 1}.</Text>
          <DayName name={d.name} onRename={(name) => void setTrainingPlan(renamePlanDay(plan, d.id, name))} />
          <IconBtn label="Move up" disabled={i === 0} onPress={() => void setTrainingPlan(movePlanDay(plan, d.id, -1))}>
            <ChevronUp size={16} color={colors.muted} />
          </IconBtn>
          <IconBtn
            label="Move down"
            disabled={i === plan.days.length - 1}
            onPress={() => void setTrainingPlan(movePlanDay(plan, d.id, 1))}
          >
            <ChevronDown size={16} color={colors.muted} />
          </IconBtn>
          <IconBtn label={`Delete ${d.name}`} onPress={() => void apply(removePlanDay(plan, d.id), `Delete “${d.name}”?`, [d.id])}>
            <Trash2 size={16} color={colors.danger} />
          </IconBtn>
        </View>
      ))}

      {plan && plan.days.length < MAX_PLAN_DAYS && (
        <Pressable
          onPress={() => void setTrainingPlan(addPlanDay(plan, ''))}
          className="mt-1 flex-row items-center gap-1 self-start rounded-full border border-dashed border-surface-border px-3 py-1.5 active:opacity-70"
        >
          <Plus size={14} color={colors.muted} />
          <Text className="text-sm text-ink-muted">Add day</Text>
        </Pressable>
      )}
      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
    </SettingsCard>
  );
}

/** Inline rename: saved on blur / submit; a blank name is ignored (keeps the old one). */
function DayName({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [text, setText] = useState(name);
  // Follow outside changes (e.g. switching preset) while not being edited.
  useEffect(() => setText(name), [name]);
  const commit = () => {
    if (text.trim() && text.trim() !== name) onRename(text);
    else setText(name);
  };
  return (
    <TextInput
      value={text}
      onChangeText={setText}
      onBlur={commit}
      onSubmitEditing={commit}
      maxLength={40}
      className="flex-1 rounded-xl bg-surface-elevated px-3 py-2 text-base text-ink"
    />
  );
}

function PresetChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`rounded-full border px-3 py-1.5 ${active ? 'border-accent bg-accent-soft' : 'border-surface-border bg-surface-raised'}`}
    >
      <Text className={`text-sm ${active ? 'font-semibold text-accent' : 'text-ink-muted'}`}>{label}</Text>
    </Pressable>
  );
}

function IconBtn({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`h-9 w-9 items-center justify-center rounded-full ${disabled ? 'opacity-30' : 'active:opacity-60'}`}
    >
      {children}
    </Pressable>
  );
}
