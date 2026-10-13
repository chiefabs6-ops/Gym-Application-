import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { create } from 'zustand';
import { Minus, Plus, Settings2 } from 'lucide-react-native';
import {
  DEFAULT_PLATE_PROFILES,
  computePlates,
  formatWeightNumber,
  fromDisplayWeight,
  weightUnitLabel,
  type PlateProfile,
} from '@gym/shared';
import { updateSet } from '../db/repositories/workouts';
import { useSettingsStore } from '../state/settingsStore';
import { colors } from '../theme';
import { BottomSheet } from './BottomSheet';

/** Open the calculator for a set (one sheet for the whole app, mounted in the root layout). */
export const usePlateSheet = create<{
  setId: string | null;
  weightKg: number | null;
  open: (setId: string, weightKg: number | null) => void;
  close: () => void;
}>()((set) => ({
  setId: null,
  weightKg: null,
  open: (setId, weightKg) => set({ setId, weightKg }),
  close: () => set({ setId: null, weightKg: null }),
}));

/** The gyms (profiles) and which one is active, with built-in defaults when none were saved. */
export function usePlateProfiles() {
  const unit = useSettingsStore((s) => s.unit);
  const saved = useSettingsStore((s) => s.plate_profiles);
  const activeId = useSettingsStore((s) => s.active_plate_profile);
  const update = useSettingsStore((s) => s.update);
  const profiles = saved.length > 0 ? saved : [DEFAULT_PLATE_PROFILES[unit]];
  const active = profiles.find((p) => p.id === activeId) ?? profiles[0]!;
  const save = (next: PlateProfile[], nextActive = active.id) =>
    void update({ plate_profiles: next, active_plate_profile: nextActive });
  return { profiles, active, save };
}

/** Plate colours by size (standard-ish bumper colours), in the profile's unit. */
const plateColor = (w: number, unit: PlateProfile['unit']) => {
  const kg = unit === 'imperial' ? w * 0.4536 : w;
  if (kg >= 24) return '#DC2626';
  if (kg >= 19) return '#2563EB';
  if (kg >= 14) return '#EAB308';
  if (kg >= 9) return '#16A34A';
  return '#A1A1AA';
};

/**
 * Plate calculator: plates per side for a target weight on the active gym's bar, the nearest loadable weight
 * when it can't be made exactly, and "Use" to put that weight in the set. "Plates" edits the gym's bar and
 * plate pairs; gyms can be added and switched.
 */
export function PlateCalculatorSheet() {
  const { setId, weightKg, close } = usePlateSheet();
  const { profiles, active, save } = usePlateProfiles();
  const unit = useSettingsStore((s) => s.unit);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (setId) {
      setText(formatWeightNumber(weightKg ?? fromDisplayWeight(active.bar, active.unit), unit, 2));
      setEditing(false);
    }
  }, [setId]); // eslint-disable-line react-hooks/exhaustive-deps

  const targetKg = useMemo(() => {
    const n = Number(text.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? fromDisplayWeight(n, unit) : 0;
  }, [text, unit]);
  const load = computePlates(targetKg, active);
  const pu = weightUnitLabel(active.unit);

  const use = () => {
    if (setId) {
      void Haptics.selectionAsync();
      void updateSet(setId, { weight_kg: load.totalKg });
    }
    close();
  };

  const patchActive = (p: Partial<PlateProfile>) =>
    save(profiles.map((g) => (g.id === active.id ? { ...g, ...p } : g)));

  return (
    <BottomSheet visible={setId !== null} onClose={close} avoidKeyboard className="max-h-[90%] pt-3">
      <View className="mb-3 h-1 w-10 self-center rounded-full bg-surface-border" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-xl font-bold text-ink">Plate calculator</Text>
          <Pressable
            onPress={() => setEditing((v) => !v)}
            className={`flex-row items-center gap-1.5 rounded-lg px-3 py-1.5 ${editing ? 'bg-accent-soft' : 'bg-surface-elevated'}`}
          >
            <Settings2 size={14} color={editing ? colors.accent : colors.muted} />
            <Text className={`text-sm font-semibold ${editing ? 'text-accent' : 'text-ink-muted'}`}>Plates</Text>
          </Pressable>
        </View>

        {/* Gym switcher */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} className="mb-4">
          {profiles.map((g) => (
            <Pressable
              key={g.id}
              onPress={() => save(profiles, g.id)}
              className={`rounded-full border px-3 py-1.5 ${g.id === active.id ? 'border-accent bg-accent-soft' : 'border-surface-border'}`}
            >
              <Text className={`text-sm ${g.id === active.id ? 'font-semibold text-accent' : 'text-ink-muted'}`}>{g.name}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => {
              const id = `gym${Date.now().toString(36)}`;
              save([...profiles, { ...DEFAULT_PLATE_PROFILES[unit], id, name: `Gym ${profiles.length + 1}` }], id);
              setEditing(true);
            }}
            className="flex-row items-center gap-1 rounded-full border border-dashed border-surface-border px-3 py-1.5"
          >
            <Plus size={13} color={colors.muted} />
            <Text className="text-sm text-ink-muted">Gym</Text>
          </Pressable>
        </ScrollView>

        {editing ? (
          <GymEditor
            gym={active}
            canDelete={profiles.length > 1}
            onChange={patchActive}
            onDelete={() => {
              const rest = profiles.filter((g) => g.id !== active.id);
              save(rest, rest[0]!.id);
            }}
          />
        ) : (
          <>
            <View className="mb-4 flex-row items-center gap-3">
              <TextInput
                value={text}
                onChangeText={setText}
                keyboardType="decimal-pad"
                selectTextOnFocus
                className="flex-1 rounded-xl bg-surface-elevated px-4 py-3 text-center text-2xl font-bold tabular-nums text-ink"
                accessibilityLabel={`Target weight in ${weightUnitLabel(unit)}`}
              />
              <Text className="text-base text-ink-subtle">{weightUnitLabel(unit)}</Text>
            </View>

            {/* Bar drawing: plates on one side, heaviest nearest the middle */}
            <View className="mb-3 h-28 flex-row items-center justify-center rounded-xl bg-surface-elevated px-3">
              <View className="h-3 w-16 rounded-l-full bg-ink-faint" />
              <View className="h-8 w-2 bg-ink-subtle" />
              {load.perSide.map((w, i) => {
                const h = 30 + Math.min(1, w / (active.unit === 'imperial' ? 45 : 25)) * 60;
                return (
                  <View
                    key={i}
                    style={{ height: h, backgroundColor: plateColor(w, active.unit) }}
                    className="mx-px w-4 items-center justify-center rounded-sm"
                  />
                );
              })}
              <View className="h-3 w-10 rounded-r-full bg-ink-faint" />
            </View>

            <Text className="text-center text-lg font-bold text-ink">
              {load.perSide.length ? `${load.perSide.join(' + ')} ${pu}` : 'Just the bar'}
              {load.perSide.length > 0 && <Text className="text-sm font-normal text-ink-subtle"> per side</Text>}
            </Text>
            <Text className="mb-4 text-center text-sm text-ink-subtle">
              Bar {active.bar} {pu} · total {load.total} {pu}
            </Text>
            {!load.exact && targetKg > 0 && (
              <Text className="mb-4 rounded-xl bg-pr/10 px-3 py-2 text-center text-sm text-pr">
                Can’t load that exactly here. Nearest: {load.total} {pu}
              </Text>
            )}

            <Pressable onPress={use} className="mb-2 h-14 items-center justify-center rounded-xl bg-accent active:opacity-80">
              <Text className="text-base font-bold text-surface">
                Use {formatWeightNumber(load.totalKg, unit, 2)} {weightUnitLabel(unit)}
              </Text>
            </Pressable>
            <Pressable onPress={close} className="h-12 items-center justify-center rounded-xl bg-surface-elevated active:opacity-70">
              <Text className="font-semibold text-ink">Close</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

/** Edit one gym: name, unit, bar weight and how many pairs of each plate it has. */
function GymEditor({
  gym,
  canDelete,
  onChange,
  onDelete,
}: {
  gym: PlateProfile;
  canDelete: boolean;
  onChange: (p: Partial<PlateProfile>) => void;
  onDelete: () => void;
}) {
  const pu = weightUnitLabel(gym.unit);
  const [name, setName] = useState(gym.name);
  const [bar, setBar] = useState(String(gym.bar));
  useEffect(() => {
    setName(gym.name);
    setBar(String(gym.bar));
  }, [gym.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPairs = (weight: number, pairs: number) =>
    onChange({ plates: gym.plates.map((p) => (p.weight === weight ? { ...p, pairs: Math.max(0, Math.min(20, pairs)) } : p)) });

  return (
    <View>
      <View className="mb-3 flex-row gap-2">
        <TextInput
          value={name}
          onChangeText={(t) => {
            setName(t);
            if (t.trim()) onChange({ name: t.trim().slice(0, 40) });
          }}
          placeholder="Gym name"
          placeholderTextColor={colors.faint}
          className="flex-1 rounded-xl bg-surface-elevated px-3 py-2.5 text-base text-ink"
        />
        {(['metric', 'imperial'] as const).map((u) => (
          <Pressable
            key={u}
            onPress={() => u !== gym.unit && onChange({ ...DEFAULT_PLATE_PROFILES[u], id: gym.id, name: gym.name })}
            className={`items-center justify-center rounded-xl border px-3 ${gym.unit === u ? 'border-accent bg-accent-soft' : 'border-surface-border'}`}
          >
            <Text className={`font-semibold ${gym.unit === u ? 'text-accent' : 'text-ink-muted'}`}>{weightUnitLabel(u)}</Text>
          </Pressable>
        ))}
      </View>
      <View className="mb-3 flex-row items-center gap-3">
        <Text className="flex-1 text-sm text-ink-muted">Bar weight</Text>
        <TextInput
          value={bar}
          onChangeText={(t) => {
            setBar(t);
            const n = Number(t.replace(',', '.'));
            if (Number.isFinite(n) && n >= 0 && n <= 100) onChange({ bar: n });
          }}
          keyboardType="decimal-pad"
          selectTextOnFocus
          className="w-20 rounded-lg bg-surface-elevated px-2 py-2 text-center tabular-nums text-ink"
        />
        <Text className="text-sm text-ink-subtle">{pu}</Text>
      </View>
      <Text className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-subtle">Plates (pairs)</Text>
      {gym.plates.map((p) => (
        <View key={p.weight} className="flex-row items-center gap-3 py-1.5">
          <View style={{ backgroundColor: plateColor(p.weight, gym.unit) }} className="h-5 w-2 rounded-sm" />
          <Text className="flex-1 text-base tabular-nums text-ink">
            {p.weight} {pu}
          </Text>
          <Pressable onPress={() => setPairs(p.weight, p.pairs - 1)} className="rounded-md bg-surface-elevated p-2">
            <Minus size={14} color={colors.ink} />
          </Pressable>
          <Text className={`w-8 text-center tabular-nums ${p.pairs === 0 ? 'text-ink-faint' : 'text-ink'}`}>{p.pairs}</Text>
          <Pressable onPress={() => setPairs(p.weight, p.pairs + 1)} className="rounded-md bg-surface-elevated p-2">
            <Plus size={14} color={colors.ink} />
          </Pressable>
        </View>
      ))}
      <Text className="mt-2 text-xs text-ink-faint">Set a plate to 0 if your gym doesn’t have it.</Text>
      {canDelete && (
        <Pressable onPress={onDelete} className="mt-4 h-11 items-center justify-center rounded-xl border border-settype-failure/30">
          <Text className="font-semibold text-settype-failure">Delete this gym</Text>
        </Pressable>
      )}
    </View>
  );
}
