import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BookmarkPlus, X } from 'lucide-react-native';
import { BUILT_IN_REST_PRESETS, MAX_CUSTOM_REST_PRESETS, addRestPreset, removeRestPreset } from '@gym/shared';
import { useSettingsStore } from '../state/settingsStore';
import { BottomSheet } from './BottomSheet';
import { colors } from '../theme';

interface Props {
  visible: boolean;
  title: string;
  /** Current value in seconds. */
  value: number;
  min: number;
  max: number;
  onClose: () => void;
  onSave: (seconds: number) => void;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const digits = (t: string) => t.replace(/[^0-9]/g, '');

/**
 * Bottom sheet for picking a rest time: type minutes + seconds, or tap a preset.
 * Presets = built-in ones + the user's own (Settings → `rest_presets`), shared by Settings and the
 * routine builder. Typed times can be saved as a preset; long-press a custom preset to remove it.
 */
export function DurationInputSheet({ visible, title, value, min, max, onClose, onSave }: Props) {
  const customPresets = useSettingsStore((s) => s.rest_presets);
  const updateSettings = useSettingsStore((s) => s.update);
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const minutesRef = useRef<TextInput>(null);
  const secondsRef = useRef<TextInput>(null);

  // Each opening starts from the current value.
  useEffect(() => {
    if (!visible) return;
    setMinutes(String(Math.floor(value / 60)));
    setSeconds(String(value % 60).padStart(2, '0'));
  }, [visible, value]);

  const total = (Number(minutes || 0) * 60) + Number(seconds || 0);
  const secondsInvalid = Number(seconds || 0) > 59;
  const outOfRange = total < min || total > max;
  const invalid = secondsInvalid || outOfRange || (minutes === '' && seconds === '');

  const save = (s = total) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(s);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onShow={() => minutesRef.current?.focus()}
      avoidKeyboard
      className="px-5 pb-8 pt-3"
    >
      <View className="mb-4 h-1 w-10 self-center rounded-full bg-surface-border" />
      <Text className="mb-4 text-xl font-bold text-ink">{title}</Text>

      <View className="mb-2 flex-row items-end justify-center gap-3">
        <TimeField
          inputRef={minutesRef}
          label="min"
          value={minutes}
          maxLength={2}
          onChange={(t) => {
            setMinutes(digits(t));
            if (digits(t).length === 2) secondsRef.current?.focus();
          }}
          onSubmit={() => secondsRef.current?.focus()}
        />
        <Text className="pb-6 text-4xl font-bold text-ink-subtle">:</Text>
        <TimeField
          inputRef={secondsRef}
          label="sec"
          value={seconds}
          maxLength={2}
          invalid={secondsInvalid}
          onChange={(t) => setSeconds(digits(t))}
          onSubmit={() => !invalid && save()}
        />
      </View>

      <Text className={`mb-4 text-center text-xs ${invalid && (minutes !== '' || seconds !== '') ? 'text-settype-failure' : 'text-ink-subtle'}`}>
        {secondsInvalid ? 'Seconds must be 0–59' : `Between ${fmt(min)} and ${fmt(max)}`}
      </Text>

      <View className="mb-3 flex-row flex-wrap justify-center gap-2">
        {[...BUILT_IN_REST_PRESETS, ...customPresets]
          .filter((p) => p >= min && p <= max)
          .sort((a, b) => a - b)
          .map((p) => {
            const custom = customPresets.includes(p);
            const active = p === total;
            return (
              <Pressable
                key={p}
                onPress={() => save(p)}
                onLongPress={() => {
                  if (!custom) return;
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  void updateSettings({ rest_presets: removeRestPreset(customPresets, p) });
                }}
                className={`flex-row items-center gap-1 rounded-full border px-4 py-2 ${
                  active ? 'border-accent bg-accent-soft' : custom ? 'border-accent/40' : 'border-surface-border'
                }`}
                accessibilityLabel={custom ? `${fmt(p)}, custom preset. Long-press to remove` : fmt(p)}
              >
                <Text className={`font-semibold tabular-nums ${active || custom ? 'text-accent' : 'text-ink-muted'}`}>{fmt(p)}</Text>
                {custom && <X size={12} color={colors.subtle} />}
              </Pressable>
            );
          })}
      </View>
      {customPresets.length > 0 && (
        <Text className="mb-3 text-center text-[11px] text-ink-faint">Long-press a green-outlined preset to remove it</Text>
      )}

      {(() => {
        const alreadyPreset = (BUILT_IN_REST_PRESETS as readonly number[]).includes(total) || customPresets.includes(total);
        const full = customPresets.length >= MAX_CUSTOM_REST_PRESETS;
        const canAdd = !invalid && !alreadyPreset && !full;
        return (
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              void updateSettings({ rest_presets: addRestPreset(customPresets, total) });
            }}
            disabled={!canAdd}
            className={`mb-4 flex-row items-center justify-center gap-2 rounded-xl border border-dashed py-3 ${
              canAdd ? 'border-accent/50 active:bg-accent-soft' : 'border-surface-border opacity-50'
            }`}
          >
            <BookmarkPlus size={16} color={canAdd ? colors.accent : colors.subtle} />
            <Text className={`font-semibold ${canAdd ? 'text-accent' : 'text-ink-subtle'}`}>
              {full ? `Preset list full (${MAX_CUSTOM_REST_PRESETS})` : alreadyPreset && !invalid ? `${fmt(total)} is already a preset` : `Add ${invalid ? 'this time' : fmt(total)} to presets`}
            </Text>
          </Pressable>
        );
      })()}

      <Pressable
        onPress={() => save()}
        disabled={invalid}
        className={`mb-2 h-14 items-center justify-center rounded-xl ${invalid ? 'bg-surface-elevated' : 'bg-accent active:opacity-80'}`}
      >
        <Text className={`text-base font-bold ${invalid ? 'text-ink-faint' : 'text-surface'}`}>Save {invalid ? '' : fmt(total)}</Text>
      </Pressable>
      <Pressable onPress={onClose} className="h-12 items-center justify-center rounded-xl bg-surface-elevated">
        <Text className="font-semibold text-ink">Cancel</Text>
      </Pressable>
    </BottomSheet>
  );
}

function TimeField({
  inputRef,
  label,
  value,
  maxLength,
  invalid,
  onChange,
  onSubmit,
}: {
  inputRef: React.RefObject<TextInput | null>;
  label: string;
  value: string;
  maxLength: number;
  invalid?: boolean;
  onChange: (t: string) => void;
  onSubmit: () => void;
}) {
  return (
    <View className="items-center gap-1">
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        keyboardType="number-pad"
        maxLength={maxLength}
        selectTextOnFocus
        returnKeyType="next"
        className={`h-20 w-24 rounded-2xl border-2 bg-surface-elevated text-center text-4xl font-bold tabular-nums text-ink ${
          invalid ? 'border-settype-failure' : 'border-surface-border'
        }`}
        placeholderTextColor={colors.faint}
        accessibilityLabel={label === 'min' ? 'Minutes' : 'Seconds'}
      />
      <Text className="text-xs uppercase tracking-widest text-ink-subtle">{label}</Text>
    </View>
  );
}
