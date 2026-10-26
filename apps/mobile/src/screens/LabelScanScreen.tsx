import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, X } from 'lucide-react-native';
import { MEALS, parseNutritionLabel, rowsFromOcrLines, toLocalDateKey, type Meal } from '@gym/shared';
import { useFoodFormDraftStore } from '../state/foodFormDraftStore';
import { colors } from '../theme';

const isMeal = (m: unknown): m is Meal => typeof m === 'string' && (MEALS as readonly string[]).includes(m);

/**
 * Label photo for products not found (spec §6.4): photograph the nutrition table, read it on the phone (Google ML Kit,
 * offline), then the confirmation page opens pre-filled. The food keeps the scanned barcode.
 */
export default function LabelScanScreen() {
  const params = useLocalSearchParams<{ barcode?: string; meal?: string; date?: string }>();
  const meal: Meal = isMeal(params.meal) ? params.meal : 'breakfast';
  const date = typeof params.date === 'string' ? params.date : toLocalDateKey(new Date());
  const [permission, requestPermission] = useCameraPermissions();
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const camera = useRef<CameraView>(null);

  const capture = async () => {
    if (!camera.current) return;
    setReading(true);
    setError(null);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.8 });
      if (!photo) throw new Error('no photo');
      const result = await TextRecognition.recognize(photo.uri);
      const lines = result.blocks.flatMap((b) => b.lines.map((l) => ({ text: l.text, frame: l.frame })));
      const parsed = parseNutritionLabel(rowsFromOcrLines(lines));
      if (parsed.found.length === 0) {
        setError('Couldn’t read a nutrition table. Fill the frame with the table, in good light, and try again.');
        setReading(false);
        return;
      }
      const p = parsed.per100;
      useFoodFormDraftStore.getState().set(
        {
          name: '',
          brand: null,
          barcode: params.barcode ?? null,
          basis: 'g',
          per100: {
            kcal: p.kcal ?? 0,
            protein_g: p.protein_g ?? null,
            carbs_g: p.carbs_g ?? null,
            fat_g: p.fat_g ?? null,
            fibre_g: p.fibre_g ?? null,
            sugars_g: p.sugars_g ?? null,
            sat_fat_g: p.sat_fat_g ?? null,
            salt_g: p.salt_g ?? null,
          },
          kcalKnown: p.kcal !== undefined,
          servings: parsed.servingGrams ? [{ label: '1 serving', grams: parsed.servingGrams }] : [],
          source: 'label',
        },
        { meal, date },
      );
      router.replace({ pathname: '/food/edit', params: { mode: 'label' } });
    } catch {
      setError('Couldn’t read the photo. Try again.');
      setReading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center gap-3 px-4 pt-3">
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Close">
          <X size={24} color={colors.ink} />
        </Pressable>
        <Text className="text-xl font-bold text-ink">Photograph nutrition table</Text>
      </View>
      <View className="flex-1 gap-4 p-4">
        {permission?.granted ? (
          <View className="flex-1 overflow-hidden rounded-card">
            <CameraView ref={camera} style={{ flex: 1 }} facing="back" />
            {reading && (
              <View className="absolute inset-0 items-center justify-center bg-black/50">
                <ActivityIndicator color={colors.accent} />
                <Text className="mt-2 text-ink">Reading label…</Text>
              </View>
            )}
          </View>
        ) : (
          <View className="flex-1 items-center justify-center gap-3">
            <Camera size={32} color={colors.muted} />
            <Text className="text-center text-ink-subtle">Gym Log needs the camera to read the label.</Text>
            <Pressable
              onPress={() => (permission?.canAskAgain === false ? void Linking.openSettings() : void requestPermission())}
              className="h-12 items-center justify-center rounded-xl bg-accent px-6 active:opacity-80"
            >
              <Text className="font-bold text-surface">{permission?.canAskAgain === false ? 'Open Settings' : 'Allow camera'}</Text>
            </Pressable>
          </View>
        )}
        <Text className="text-center text-xs text-ink-subtle">Photograph the nutrition table (not the ingredients). Keep it flat and well lit.</Text>
        {error && <Text className="text-center text-sm text-settype-failure">{error}</Text>}
        <Pressable
          disabled={!permission?.granted || reading}
          onPress={() => void capture()}
          className={`h-14 items-center justify-center rounded-xl bg-accent ${!permission?.granted || reading ? 'opacity-40' : 'active:opacity-80'}`}
        >
          <Text className="text-base font-bold text-surface">Take photo</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
