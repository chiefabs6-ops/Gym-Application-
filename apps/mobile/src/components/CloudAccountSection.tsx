import { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { CloudOff, RefreshCw } from 'lucide-react-native';
import { getToken } from '../db/sync/api';
import { getSyncStatus, runSync, subscribeSyncStatus } from '../db/sync/syncManager';
import { useLiveQuery } from '../db/useLiveQuery';
import { login, logout, register } from '../services/auth';
import { colors } from '../theme';

/**
 * Account sign-in + sync status. Only rendered when CLOUD_SYNC_ENABLED (ROADMAP Phase 8).
 * TODO(Phase 8): replace Alert.alert with an in-app sheet before enabling.
 */
export function CloudAccountSection() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const status = useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
  const { data: queue } = useLiveQuery<{ status: string; n: number }>(
    `SELECT status, COUNT(*) AS n FROM sync_queue GROUP BY status`,
    [],
    ['sync_queue'],
  );
  const pending = queue.find((q) => q.status === 'pending')?.n ?? 0;
  const dead = queue.find((q) => q.status === 'dead')?.n ?? 0;

  useEffect(() => {
    void getToken().then((t) => setSignedIn(!!t));
  }, [status.lastError]);

  return (
    <View className="gap-4">
      <View className="gap-2 rounded-card border border-surface-border bg-surface-raised p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-semibold text-ink">Sync</Text>
          {status.syncing ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Pressable onPress={() => void runSync()} hitSlop={8} accessibilityLabel="Sync now">
              <RefreshCw size={18} color={colors.accent} />
            </Pressable>
          )}
        </View>
        <Text className="text-sm text-ink-muted">Pending changes: {pending}</Text>
        {dead > 0 && <Text className="text-sm text-settype-failure">Rejected by server: {dead}</Text>}
        <Text className="text-sm text-ink-muted">
          Last synced: {status.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleTimeString() : 'never'}
        </Text>
        {status.lastError && (
          <View className="flex-row items-center gap-2">
            <CloudOff size={14} color={colors.danger} />
            <Text className="flex-1 text-xs text-settype-failure" numberOfLines={2}>
              {status.lastError}
              {status.nextRetryAt ? ` · retrying ${new Date(status.nextRetryAt).toLocaleTimeString()}` : ''}
            </Text>
          </View>
        )}
      </View>

      {signedIn === false && <AuthForm onSignedIn={() => setSignedIn(true)} />}
      {signedIn && (
        <Pressable
          onPress={() => void logout().then(() => setSignedIn(false))}
          className="items-center rounded-xl bg-surface-raised py-3"
        >
          <Text className="font-semibold text-settype-failure">Sign out</Text>
        </Pressable>
      )}
    </View>
  );
}

function AuthForm({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (mode: 'login' | 'register') => {
    setBusy(true);
    try {
      await (mode === 'login' ? login(email, password) : register(email, password));
      onSignedIn();
    } catch (err) {
      Alert.alert(mode === 'login' ? 'Sign in failed' : 'Registration failed', String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="gap-3 rounded-card border border-surface-border bg-surface-raised p-4">
      <Text className="font-semibold text-ink">Sign in to back up and sync</Text>
      <Text className="text-xs text-ink-muted">Everything works offline. Workouts logged now sync after you sign in.</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor={colors.subtle}
        autoCapitalize="none"
        keyboardType="email-address"
        className="rounded-lg bg-surface-elevated px-3 py-2.5 text-ink"
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password (min 8 chars)"
        placeholderTextColor={colors.subtle}
        secureTextEntry
        className="rounded-lg bg-surface-elevated px-3 py-2.5 text-ink"
      />
      <View className="flex-row gap-3">
        <Pressable disabled={busy} onPress={() => void submit('login')} className="flex-1 items-center rounded-lg bg-accent py-3">
          <Text className="font-bold text-surface">Sign in</Text>
        </Pressable>
        <Pressable
          disabled={busy}
          onPress={() => void submit('register')}
          className="flex-1 items-center rounded-lg border border-accent py-3"
        >
          <Text className="font-bold text-accent">Register</Text>
        </Pressable>
      </View>
    </View>
  );
}
