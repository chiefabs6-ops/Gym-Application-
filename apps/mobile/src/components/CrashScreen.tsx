import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RotateCcw, Share2, ShieldCheck, TriangleAlert } from 'lucide-react-native';
import { recordCrash, shareCrashLog } from '../services/crashLog';
import { colors } from '../theme';

/**
 * Friendly full-screen error page (ROADMAP 1.6), used by the root ErrorBoundary and when startup
 * fails. Records the error to the offline crash log once.
 */
export function CrashScreen({ error, where, onRetry }: { error: unknown; where: string; onRetry?: () => void }) {
  const [shared, setShared] = useState<'idle' | 'ok' | 'empty'>('idle');
  const message = error instanceof Error ? error.message : String(error);

  useEffect(() => {
    void recordCrash(error, where);
  }, [error, where]);

  return (
    <View className="flex-1 justify-center bg-surface p-6">
      <View className="items-center gap-4 rounded-card border border-surface-border bg-surface-raised p-6">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-pr/15">
          <TriangleAlert size={30} color={colors.pr} />
        </View>
        <Text className="text-center text-2xl font-bold text-ink">Something went wrong</Text>
        <View className="flex-row items-start gap-2 rounded-xl bg-accent-soft p-3">
          <ShieldCheck size={18} color={colors.accent} />
          <Text className="flex-1 text-sm leading-5 text-ink">
            Your workouts are safe. They’re saved on this phone, and nothing was deleted.
          </Text>
        </View>
        <Text className="text-center text-xs text-ink-subtle" numberOfLines={3}>
          {message}
        </Text>

        {onRetry && (
          <Pressable onPress={onRetry} className="h-14 w-full flex-row items-center justify-center gap-2 rounded-xl bg-accent active:opacity-80">
            <RotateCcw size={18} color={colors.bg} />
            <Text className="text-base font-bold text-surface">Try again</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => void shareCrashLog().then((ok) => setShared(ok ? 'ok' : 'empty'))}
          className="h-12 w-full flex-row items-center justify-center gap-2 rounded-xl bg-surface-elevated active:opacity-70"
        >
          <Share2 size={16} color={colors.ink} />
          <Text className="font-semibold text-ink">Share error report</Text>
        </Pressable>
        {shared === 'empty' && <Text className="text-xs text-ink-subtle">No saved errors to share.</Text>}
        <Text className="text-center text-[11px] leading-4 text-ink-faint">
          The report stays on your phone unless you choose to share it.
        </Text>
      </View>
    </View>
  );
}
