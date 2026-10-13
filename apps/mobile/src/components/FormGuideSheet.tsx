import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { ExternalLink, Lightbulb, TriangleAlert, WifiOff, Youtube, X } from 'lucide-react-native';
import { getFormGuide } from '@gym/shared';
import { colors } from '../theme';
import { ExerciseIllustration } from './ExerciseIllustration';
import { BottomSheet } from './BottomSheet';

export interface FormGuideTarget {
  exerciseId: string;
  name: string;
  primaryMuscle: string;
  equipment: string;
}

const youtubeSearchUrl = (name: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} proper form`)}`;

/**
 * In-app form tips (work offline). The YouTube link is a clearly labelled, secondary
 * action so users know it leaves the app and needs internet.
 */
export function FormGuideSheet({ target, onClose }: { target: FormGuideTarget | null; onClose: () => void }) {
  const net = useNetInfo();
  const offline = net.isConnected === false || net.isInternetReachable === false;
  const guide = target ? getFormGuide(target.exerciseId) : null;

  return (
    <BottomSheet visible={target !== null} animationType="slide" onClose={onClose} className="max-h-[85%] pt-3">
      <View className="mb-3 h-1 w-10 self-center rounded-full bg-surface-border" />

      {/* Header */}
      <View className="flex-row items-start gap-3 px-5 pb-4">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-accent-soft">
          <Lightbulb size={20} color={colors.accent} />
        </View>
        <View className="flex-1">
          <Text className="text-[11px] font-semibold uppercase tracking-widest text-ink-subtle">Form guide</Text>
          <Text className="text-xl font-bold text-ink">{target?.name}</Text>
          <Text className="text-sm capitalize text-ink-subtle">
            {target?.primaryMuscle.replace('_', ' ')} · {target?.equipment}
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close form guide">
          <X size={22} color={colors.subtle} />
        </Pressable>
      </View>

      {/* flexShrink lets the list shrink to the sheet's max height and scroll; without it the
          ScrollView grows to its content and the overflow is just clipped. */}
      <ScrollView
        style={{ flexShrink: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
        showsVerticalScrollIndicator
      >
        {target && (
          <View className="mb-5">
            <ExerciseIllustration exerciseId={target.exerciseId} maxHeight={190} showPlaceholder showCredit />
          </View>
        )}
        {guide ? (
          <>
            <Text className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-subtle">How to do it</Text>
            <View className="mb-5 gap-2.5">
              {guide.steps.map((step, i) => (
                <View key={step} className="flex-row gap-3">
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-surface-elevated">
                    <Text className="text-xs font-bold text-accent">{i + 1}</Text>
                  </View>
                  <Text className="flex-1 text-[15px] leading-6 text-ink">{step}</Text>
                </View>
              ))}
            </View>

            {guide.avoid.length > 0 && (
              <View className="mb-5 rounded-xl border border-pr/25 bg-pr/10 p-3">
                <View className="mb-2 flex-row items-center gap-2">
                  <TriangleAlert size={14} color={colors.pr} />
                  <Text className="text-xs font-semibold uppercase tracking-widest text-pr">Common mistakes</Text>
                </View>
                <View className="gap-1.5">
                  {guide.avoid.map((mistake) => (
                    <Text key={mistake} className="text-sm leading-5 text-ink-muted">
                      •  {mistake}
                    </Text>
                  ))}
                </View>
              </View>
            )}
          </>
        ) : (
          <View className="mb-5 items-center gap-2 rounded-xl bg-surface-elevated p-5">
            <Text className="font-semibold text-ink">No tips for this exercise yet</Text>
            <Text className="text-center text-sm text-ink-subtle">
              Built-in tips cover the standard exercise library. Try a video instead.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* YouTube */}
      <View className="border-t border-surface-border px-5 pb-8 pt-4">
        <Pressable
          disabled={offline || !target}
          onPress={() => target && void Linking.openURL(youtubeSearchUrl(target.name))}
          className={`h-14 flex-row items-center justify-center gap-2 rounded-xl ${
            offline ? 'bg-surface-elevated' : 'bg-[#FF0033] active:opacity-80'
          }`}
          accessibilityLabel="Watch form videos on YouTube. Opens the YouTube app or browser."
        >
          {offline ? <WifiOff size={18} color={colors.subtle} /> : <Youtube size={20} color="#FFFFFF" />}
          <Text className={`text-base font-bold ${offline ? 'text-ink-subtle' : 'text-white'}`}>
            {offline ? 'Video needs internet' : 'Watch on YouTube'}
          </Text>
          {!offline && <ExternalLink size={16} color="#FFFFFF" />}
        </Pressable>
        <Text className="mt-2 text-center text-xs text-ink-faint">
          {offline
            ? 'You’re offline. The tips above work without a connection.'
            : 'Opens YouTube outside the app. Your workout and rest timer keep running.'}
        </Text>
      </View>
    </BottomSheet>
  );
}
