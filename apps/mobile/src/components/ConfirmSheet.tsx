import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CircleAlert, Trash2 } from 'lucide-react-native';
import { colors } from '../theme';
import { BottomSheet } from './BottomSheet';

export interface ConfirmRequest {
  title: string;
  message?: string;
  confirmLabel: string;
  /** destructive = red confirm button + trash icon */
  tone?: 'destructive' | 'neutral';
  /** Hide the cancel button for plain notices ("Give the routine a name"). */
  notice?: boolean;
  onConfirm?: () => void;
}

/** In-app replacement for Alert.alert: a bottom sheet in the app's design language. */
export function ConfirmSheet({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  const destructive = request?.tone === 'destructive';
  return (
    <BottomSheet visible={request !== null} animationType="slide" onClose={onClose} className="px-5 pb-8 pt-3">
      <View className="mb-4 h-1 w-10 self-center rounded-full bg-surface-border" />
      {request && (
        <>
          <View className="mb-4 items-center gap-3">
            <View
              className={`h-14 w-14 items-center justify-center rounded-full ${destructive ? 'bg-settype-failure/15' : 'bg-pr/15'}`}
            >
              {destructive ? <Trash2 size={24} color={colors.danger} /> : <CircleAlert size={24} color={colors.pr} />}
            </View>
            <Text className="text-center text-xl font-bold text-ink">{request.title}</Text>
            {request.message && <Text className="text-center text-sm leading-5 text-ink-subtle">{request.message}</Text>}
          </View>
          <Pressable
            onPress={() => {
              if (destructive) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              onClose();
              request.onConfirm?.();
            }}
            className={`h-14 items-center justify-center rounded-xl active:opacity-80 ${
              destructive ? 'bg-settype-failure' : 'bg-accent'
            } ${request.notice ? '' : 'mb-2'}`}
          >
            <Text className="text-base font-bold text-surface">{request.confirmLabel}</Text>
          </Pressable>
          {!request.notice && (
            <Pressable onPress={onClose} className="h-12 items-center justify-center rounded-xl bg-surface-elevated">
              <Text className="font-semibold text-ink">Cancel</Text>
            </Pressable>
          )}
        </>
      )}
    </BottomSheet>
  );
}
