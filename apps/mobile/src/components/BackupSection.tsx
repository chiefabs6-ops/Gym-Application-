import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  ChevronDown,
  CircleAlert,
  CircleCheck,
  DatabaseBackup,
  FileSpreadsheet,
  FolderOpen,
  HardDriveDownload,
  Share2,
} from 'lucide-react-native';
import {
  chooseAutoBackupFolder,
  getBackupStatus,
  pickBackupFile,
  restoreBackup,
  runAutoBackup,
  setAutoBackupEnabled,
  shareBackup,
  shareWorkoutsCsv,
  type BackupStatus,
  type BackupSummary,
  type RestoreStats,
} from '../services/backup';
import { skippedDataMessage, type BackupFile } from '@gym/shared';
import { useActiveWorkoutStore } from '../state/activeWorkoutStore';
import { useSettingsStore } from '../state/settingsStore';
import { colors } from '../theme';
import { BottomSheet } from './BottomSheet';

const DAY = 24 * 60 * 60 * 1000;

function relative(ms: number | null): string {
  if (!ms) return 'Never';
  const days = Math.floor((Date.now() - ms) / DAY);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

type Busy = null | 'share' | 'csv' | 'auto' | 'pick' | 'restore';

/** Settings card: backup status, automatic backups, export and restore. */
export function BackupSection() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ backup: BackupFile; summary: BackupSummary; skippedTables: string[] } | null>(null);
  const [result, setResult] = useState<RestoreStats | null>(null);
  const activeSession = useActiveWorkoutStore((s) => s.sessionId);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(() => {
    void getBackupStatus().then(setStatus);
  }, []);
  useFocusEffect(refresh);

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<unknown>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const stale = !status?.lastBackupAt || Date.now() - status.lastBackupAt > 14 * DAY;

  return (
    <View className="gap-3 rounded-card border border-surface-border bg-surface-raised p-4">
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center gap-3"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-accent-soft">
          <DatabaseBackup size={18} color={colors.accent} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-ink">Backup & data</Text>
          <Text className={`text-xs ${stale ? 'text-pr' : 'text-ink-subtle'}`}>
            Last backup: {relative(status?.lastBackupAt ?? null)}
            {status?.lastBackupKind && status.lastBackupAt ? ` (${status.lastBackupKind})` : ''}
          </Text>
        </View>
        <ChevronDown size={18} color={colors.subtle} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Pressable>

      {open && (
        <>

      <Text className="text-xs leading-5 text-ink-subtle">
        Your workouts are stored only on this phone. Keep a backup somewhere else (Google Drive, email, or a folder
        that syncs) so you don’t lose them if the phone is lost or reset.
      </Text>

      {/* Automatic backups */}
      <View className="gap-2 rounded-xl bg-surface-elevated p-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="font-semibold text-ink">Automatic backups</Text>
            <Text className="text-xs text-ink-subtle" numberOfLines={2}>
              {status?.autoFolderLabel
                ? `After each workout → ${status.autoFolderLabel}`
                : 'Save a backup to a folder of your choice after every workout'}
            </Text>
          </View>
          <Pressable
            onPress={() =>
              status?.autoFolderLabel
                ? void run('auto', () => setAutoBackupEnabled(!status.autoEnabled))
                : void run('auto', chooseAutoBackupFolder)
            }
            className={`h-8 w-14 justify-center rounded-full px-1 ${status?.autoEnabled ? 'bg-accent' : 'bg-surface-border'}`}
            accessibilityRole="switch"
            accessibilityState={{ checked: !!status?.autoEnabled }}
            accessibilityLabel="Automatic backups"
          >
            <View className={`h-6 w-6 rounded-full bg-ink ${status?.autoEnabled ? 'self-end' : 'self-start'}`} />
          </Pressable>
        </View>
        {status?.autoError && (
          <View className="flex-row items-start gap-2">
            <CircleAlert size={14} color={colors.danger} />
            <Text className="flex-1 text-xs text-settype-failure">{status.autoError}</Text>
          </View>
        )}
        {status?.autoFolderLabel && (
          <View className="flex-row gap-2">
            <SmallButton label="Change folder" icon={<FolderOpen size={14} color={colors.muted} />} onPress={() => void run('auto', chooseAutoBackupFolder)} />
            <SmallButton
              label="Back up now"
              icon={<HardDriveDownload size={14} color={colors.muted} />}
              onPress={() => void run('auto', () => runAutoBackup({ force: true }))}
            />
          </View>
        )}
      </View>

      <ActionRow
        icon={<Share2 size={16} color={colors.ink} />}
        label="Share backup file"
        hint="Full backup (.json): save to Drive, email it to yourself…"
        busy={busy === 'share'}
        onPress={() => void run('share', shareBackup)}
      />
      <ActionRow
        icon={<FileSpreadsheet size={16} color={colors.ink} />}
        label="Export spreadsheet"
        hint="Every set as a row (.csv): opens in Excel or Google Sheets"
        busy={busy === 'csv'}
        onPress={() => void run('csv', shareWorkoutsCsv)}
      />
      <ActionRow
        icon={<HardDriveDownload size={16} color={colors.ink} />}
        label="Restore from backup"
        hint={activeSession ? 'Finish your current workout first' : 'Merge a .json backup into this phone'}
        disabled={!!activeSession}
        busy={busy === 'pick' || busy === 'restore'}
        onPress={() =>
          void run('pick', async () => {
            const picked = await pickBackupFile();
            if (picked.ok) setPending({ backup: picked.backup, summary: picked.summary, skippedTables: picked.skippedTables });
            else if ('error' in picked) setError(picked.error);
          })
        }
      />

      {error && (
        <View className="flex-row items-start gap-2 rounded-xl border border-settype-failure/30 bg-settype-failure/10 p-3">
          <CircleAlert size={16} color={colors.danger} />
          <Text className="flex-1 text-sm text-settype-failure">{error}</Text>
        </View>
      )}
        </>
      )}

      <RestoreSheet
        pending={pending}
        result={result}
        busy={busy === 'restore'}
        onCancel={() => {
          setPending(null);
          setResult(null);
        }}
        onConfirm={() => {
          if (!pending) return;
          void run('restore', async () => {
            const stats = await restoreBackup(pending.backup);
            await useSettingsStore.getState().load(); // restored units/preferences take effect immediately
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setResult(stats);
          });
        }}
      />
    </View>
  );
}

function ActionRow({
  icon,
  label,
  hint,
  busy,
  disabled,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      className={`flex-row items-center gap-3 rounded-xl bg-surface-elevated px-3 py-3 ${disabled ? 'opacity-50' : 'active:opacity-70'}`}
    >
      {busy ? <ActivityIndicator size="small" color={colors.accent} /> : icon}
      <View className="flex-1">
        <Text className="font-semibold text-ink">{label}</Text>
        <Text className="text-xs text-ink-subtle">{hint}</Text>
      </View>
    </Pressable>
  );
}

function SmallButton({ label, icon, onPress }: { label: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-surface-border py-2 active:opacity-70">
      {icon}
      <Text className="text-xs font-semibold text-ink-muted">{label}</Text>
    </Pressable>
  );
}

function RestoreSheet({
  pending,
  result,
  busy,
  onCancel,
  onConfirm,
}: {
  pending: { summary: BackupSummary; skippedTables: string[] } | null;
  result: RestoreStats | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const s = pending?.summary;
  const skipped = skippedDataMessage(pending?.skippedTables ?? []);
  return (
    <BottomSheet visible={pending !== null} animationType="slide" onClose={onCancel} dismissable={!busy} className="px-5 pb-8 pt-3">
      <View className="mb-4 h-1 w-10 self-center rounded-full bg-surface-border" />
      {result ? (
        <View className="items-center gap-3">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-accent-soft">
            <CircleCheck size={26} color={colors.accent} />
          </View>
          <Text className="text-xl font-bold text-ink">Backup restored</Text>
          <Text className="text-center text-sm text-ink-subtle">
            {result.added} added · {result.updated} updated · {result.unchanged} already up to date
          </Text>
          {skipped && <Text className="text-center text-sm text-pr">{skipped}</Text>}
          <Pressable onPress={onCancel} className="mt-2 h-12 w-full items-center justify-center rounded-xl bg-accent">
            <Text className="font-bold text-surface">Done</Text>
          </Pressable>
        </View>
      ) : (
        s && (
          <>
            <Text className="mb-1 text-xl font-bold text-ink">Restore this backup?</Text>
            <Text className="mb-4 text-sm text-ink-subtle">
              Made {new Date(s.exportedAt).toLocaleString()} (app {s.appVersion})
            </Text>
            <View className="mb-4 flex-row gap-2">
              <Stat label="Workouts" value={s.workouts} />
              <Stat label="Sets" value={s.sets} />
              <Stat label="Routines" value={s.routines} />
              <Stat label="Custom ex." value={s.customExercises} />
            </View>
            {(s.foodEntries > 0 || s.foods > 0 || s.weighIns > 0) && (
              <View className="mb-4 flex-row gap-2">
                <Stat label="Food logs" value={s.foodEntries} />
                <Stat label="Foods" value={s.foods} />
                <Stat label="Weigh-ins" value={s.weighIns} />
              </View>
            )}
            <View className="mb-5 rounded-xl bg-surface-elevated p-3">
              <Text className="text-sm leading-5 text-ink-muted">
                The backup is <Text className="font-semibold text-ink">merged</Text> into this phone. Nothing is
                wiped, and anything you’ve changed here more recently than the backup is kept.
              </Text>
            </View>
            <Pressable
              onPress={onConfirm}
              disabled={busy}
              className="mb-2 h-14 flex-row items-center justify-center gap-2 rounded-xl bg-accent active:opacity-80"
            >
              {busy ? <ActivityIndicator color={colors.bg} /> : <Text className="text-base font-bold text-surface">Restore</Text>}
            </Pressable>
            <Pressable onPress={onCancel} disabled={busy} className="h-12 items-center justify-center rounded-xl bg-surface-elevated">
              <Text className="font-semibold text-ink">Cancel</Text>
            </Pressable>
          </>
        )
      )}
    </BottomSheet>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-1 rounded-xl bg-surface-elevated px-2 py-3">
      <Text className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle" numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
      <Text className="text-lg font-bold tabular-nums text-ink">{value}</Text>
    </View>
  );
}
