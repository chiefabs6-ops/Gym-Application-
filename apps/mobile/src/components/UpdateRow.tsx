import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Download, RefreshCw } from 'lucide-react-native';
import { checkForUpdate, type AvailableUpdate } from '../services/appUpdate';
import { downloadAndInstall } from '../services/appUpdateInstall';
import { colors } from '../theme';

type State =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'up-to-date' }
  | { kind: 'available'; update: AvailableUpdate }
  | { kind: 'downloading'; update: AvailableUpdate }
  | { kind: 'error'; message: string; update?: AvailableUpdate };

const mb = (bytes: number | null) => (bytes ? ` (${(bytes / 1_000_000).toFixed(0)} MB)` : '');

/**
 * Settings → About: checks the newest GitHub release and installs it. Only goes online when tapped.
 * Android shows its own install prompt; data is kept because the APK is signed with the same key.
 */
export function UpdateRow() {
  const current = Constants.expoConfig?.version ?? '0.0.0';
  const [state, setState] = useState<State>({ kind: 'idle' });

  const check = async () => {
    setState({ kind: 'checking' });
    try {
      const r = await checkForUpdate(current);
      setState(r.kind === 'available' ? { kind: 'available', update: r.update } : { kind: 'up-to-date' });
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message });
    }
  };

  const install = async (update: AvailableUpdate) => {
    setState({ kind: 'downloading', update });
    try {
      await downloadAndInstall(update);
      setState({ kind: 'available', update });
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message, update });
    }
  };

  const busy = state.kind === 'checking' || state.kind === 'downloading';
  const update = state.kind === 'available' || state.kind === 'downloading' || state.kind === 'error' ? state.update : undefined;

  const message =
    state.kind === 'up-to-date'
      ? 'You have the latest version.'
      : state.kind === 'available'
        ? `Version ${state.update.version} is ready${mb(state.update.sizeBytes)}. Your data is kept.`
        : state.kind === 'downloading'
          ? `Downloading ${state.update.version}…`
          : state.kind === 'error'
            ? state.message
            : null;

  return (
    <View className="gap-2 rounded-xl bg-surface-elevated p-3">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-sm text-ink-muted">Gym Log {current}</Text>
        {update ? (
          <Pressable
            onPress={() => void install(update)}
            disabled={busy}
            className={`flex-row items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 ${busy ? 'opacity-60' : 'active:opacity-70'}`}
          >
            {state.kind === 'downloading' ? <ActivityIndicator size="small" color={colors.surface} /> : <Download size={14} color={colors.surface} />}
            <Text className="text-xs font-bold text-surface">Update to {update.version}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => void check()}
            disabled={busy}
            className={`flex-row items-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 ${busy ? 'opacity-60' : 'active:opacity-70'}`}
          >
            {state.kind === 'checking' ? <ActivityIndicator size="small" color={colors.accent} /> : <RefreshCw size={14} color={colors.accent} />}
            <Text className="text-xs font-semibold text-ink">Check for update</Text>
          </Pressable>
        )}
      </View>
      {message && (
        <Text className={`text-xs ${state.kind === 'error' ? 'text-settype-failure' : 'text-ink-subtle'}`}>{message}</Text>
      )}
    </View>
  );
}
