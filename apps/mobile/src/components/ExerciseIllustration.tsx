import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { Dumbbell } from 'lucide-react-native';
import { getExerciseImage } from '../generated/exerciseImages';
import { colors } from '../theme';

interface Props {
  exerciseId: string;
  /** Max rendered height; width follows the image's aspect ratio (start + end positions). */
  maxHeight?: number;
  /** Show a placeholder when no illustration exists (otherwise render nothing). */
  showPlaceholder?: boolean;
  /** RepDB attribution line under the image (licence requirement). */
  showCredit?: boolean;
}

/** Start/end position illustration for an exercise, on a soft inset panel. */
export function ExerciseIllustration({ exerciseId, maxHeight = 150, showPlaceholder = false, showCredit = false }: Props) {
  const image = getExerciseImage(exerciseId);
  // Size explicitly from the measured width: percentage width + aspectRatio lets RN fall back
  // to the bitmap's intrinsic height, which blows the panel up.
  const [panelWidth, setPanelWidth] = useState(0);

  if (!image) {
    if (!showPlaceholder) return null;
    return (
      <View className="items-center justify-center gap-2 rounded-xl bg-surface-elevated" style={{ height: maxHeight }}>
        <Dumbbell size={28} color={colors.faint} />
        <Text className="text-xs text-ink-faint">No illustration for this exercise yet</Text>
      </View>
    );
  }

  return (
    <View>
      <View
        className="items-center overflow-hidden rounded-xl bg-surface-elevated p-3"
        onLayout={(e) => setPanelWidth(e.nativeEvent.layout.width - 24)}
      >
        {panelWidth > 0 && (
          <Image
            source={image.source}
            resizeMode="contain"
            style={{
              height: Math.min(maxHeight, panelWidth / image.aspect),
              width: Math.min(panelWidth, maxHeight * image.aspect),
            }}
            accessibilityLabel="Exercise start and end positions"
          />
        )}
      </View>
      {showCredit && (
        <Text className="mt-1 text-right text-[10px] text-ink-faint">Exercise data by RepDB (repdb.co)</Text>
      )}
    </View>
  );
}
