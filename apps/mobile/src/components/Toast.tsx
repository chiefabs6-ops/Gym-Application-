import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '../state/toastStore';

const DEFAULT_MS = 5000;
/** Clears the bottom tab bar. */
const TAB_BAR_HEIGHT = 64;

/** App-wide toast above the tab bar, with an optional action (Undo). Mounted once in the root layout. */
export function Toast() {
  const toast = useToastStore((s) => s.toast);
  const hide = useToastStore((s) => s.hide);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(hide, toast.durationMs ?? DEFAULT_MS);
    return () => clearTimeout(t);
  }, [toast, hide]);

  if (!toast) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + TAB_BAR_HEIGHT + 8 }}>
      <View className="flex-row items-center gap-3 rounded-xl border border-surface-border bg-surface-elevated px-4 py-3">
        <Text className="flex-1 text-sm text-ink" numberOfLines={2}>
          {toast.message}
        </Text>
        {toast.actionLabel && (
          <Pressable
            onPress={() => {
              hide();
              toast.onAction?.();
            }}
            hitSlop={8}
            className="active:opacity-70"
          >
            <Text className="font-bold text-accent">{toast.actionLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
