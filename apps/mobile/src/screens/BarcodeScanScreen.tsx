import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, X } from 'lucide-react-native';
import { MEALS, toLocalDateKey, type FoodRow, type Meal } from '@gym/shared';
import { findFoodByBarcode, logFood, normaliseBarcode, quickAdd } from '../db/repositories/food';
import { lookupBarcode } from '../services/openFoodFacts';
import { useFoodFormDraftStore } from '../state/foodFormDraftStore';
import { showToast } from '../state/toastStore';
import { colors } from '../theme';
import { PortionSheet } from '../components/food/PortionSheet';
import { QuickAddSheet } from '../components/food/QuickAddSheet';

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;
const isMeal = (m: unknown): m is Meal => typeof m === 'string' && (MEALS as readonly string[]).includes(m);
type Status = { kind: 'scanning' } | { kind: 'looking' } | { kind: 'missing'; barcode: string; offline: boolean };

/**
 * Barcode scan (spec §6.2): your food → portion screen; found on Open Food Facts → check page (first scan only);
 * not found or offline → photograph the nutrition table. Quick add and name search stay available.
 */
export default function BarcodeScanScreen() {
  const params = useLocalSearchParams<{ meal?: string; date?: string }>();
  const meal: Meal = isMeal(params.meal) ? params.meal : 'breakfast';
  const date = typeof params.date === 'string' ? params.date : toLocalDateKey(new Date());
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<Status>({ kind: 'scanning' });
  const [typed, setTyped] = useState('');
  const [found, setFound] = useState<FoodRow | null>(null);
  const [quick, setQuick] = useState(false);
  const busy = useRef(false);

  const handle = async (raw: string) => {
    if (busy.current) return;
    busy.current = true;
    const barcode = normaliseBarcode(raw);
    const mine = await findFoodByBarcode(barcode);
    if (mine) {
      setFound(mine);
      return;
    }
    setStatus({ kind: 'looking' });
    const product = await lookupBarcode(barcode);
    if (product && product !== 'offline') {
      useFoodFormDraftStore.getState().set(
        { name: product.name, brand: product.brand, barcode, basis: product.basis, per100: product.per100, kcalKnown: product.kcalKnown, servings: product.serving ? [product.serving] : [], source: 'open_food_facts' },
        { meal, date },
      );
      router.replace({ pathname: '/food/edit', params: { mode: 'check' } });
      return;
    }
    setStatus({ kind: 'missing', barcode, offline: product === 'offline' });
  };

  const close = () => router.back();

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center gap-3 px-4 pt-3">
        <Pressable onPress={close} hitSlop={10} accessibilityLabel="Close">
          <X size={24} color={colors.ink} />
        </Pressable>
        <Text className="text-xl font-bold text-ink">Scan barcode</Text>
      </View>

      {status.kind === 'scanning' && (
        <View className="flex-1 gap-4 p-4">
          {permission?.granted ? (
            <View className="flex-1 overflow-hidden rounded-card">
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
                onBarcodeScanned={({ data }) => void handle(data)}
              />
            </View>
          ) : (
            <View className="flex-1 items-center justify-center gap-3">
              <Camera size={32} color={colors.muted} />
              <Text className="text-center text-ink-subtle">
                {permission?.canAskAgain === false ? 'Camera access is off. Turn it on in Settings, or type the barcode.' : 'Gym Log needs the camera to scan barcodes.'}
              </Text>
              <Pressable
                onPress={() => (permission?.canAskAgain === false ? void Linking.openSettings() : void requestPermission())}
                className="h-12 items-center justify-center rounded-xl bg-accent px-6 active:opacity-80"
              >
                <Text className="font-bold text-surface">{permission?.canAskAgain === false ? 'Open Settings' : 'Allow camera'}</Text>
              </Pressable>
            </View>
          )}
          <View className="flex-row gap-2">
            <TextInput
              value={typed}
              onChangeText={setTyped}
              placeholder="Or type the barcode"
              placeholderTextColor={colors.faint}
              keyboardType="number-pad"
              maxLength={14}
              className="flex-1 rounded-xl bg-surface-elevated px-3 py-3 text-base text-ink"
            />
            <Pressable
              disabled={typed.replace(/\D/g, '').length < 8}
              onPress={() => void handle(typed)}
              className={`items-center justify-center rounded-xl bg-accent px-5 ${typed.replace(/\D/g, '').length < 8 ? 'opacity-40' : 'active:opacity-80'}`}
            >
              <Text className="font-bold text-surface">Look up</Text>
            </Pressable>
          </View>
        </View>
      )}

      {status.kind === 'looking' && (
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator color={colors.accent} />
          <Text className="text-ink-subtle">Looking up product…</Text>
        </View>
      )}

      {status.kind === 'missing' && (
        <View className="flex-1 justify-center gap-3 p-6">
          <Text className="text-center text-lg font-bold text-ink">{status.offline ? 'You’re offline' : 'Product not found'}</Text>
          <Text className="mb-2 text-center text-ink-subtle">Photograph the nutrition table and we’ll fill in the details for you to check.</Text>
          <Pressable
            onPress={() => router.replace({ pathname: '/food/label', params: { barcode: status.barcode, meal, date } })}
            className="h-14 items-center justify-center rounded-xl bg-accent active:opacity-80"
          >
            <Text className="text-base font-bold text-surface">Photograph nutrition table</Text>
          </Pressable>
          <Pressable onPress={() => setQuick(true)} className="h-12 items-center justify-center rounded-xl bg-surface-elevated active:opacity-80">
            <Text className="font-semibold text-ink">Quick add</Text>
          </Pressable>
          <Pressable onPress={close} className="h-12 items-center justify-center rounded-xl bg-surface-elevated active:opacity-80">
            <Text className="font-semibold text-ink">Search by name</Text>
          </Pressable>
        </View>
      )}

      <PortionSheet
        visible={found !== null}
        food={found ? { name: found.name, per100: found, servings: found.servings, basis: found.basis } : null}
        defaultMeal={meal}
        mode="add"
        onSubmit={async ({ serving, servings, meal: m }) => {
          if (!found) return;
          await logFood({ ref: { kind: 'food', id: found.id }, name: found.name, per100: found, serving, servings, meal: m, localDate: date });
          showToast({ message: `Added ${found.name}` });
        }}
        onClose={close}
      />
      <QuickAddSheet
        visible={quick}
        defaultMeal={meal}
        onSubmit={async (v) => {
          await quickAdd({ ...v, localDate: date });
          showToast({ message: `Added ${v.name ?? 'Quick add'}` });
          close();
        }}
        onClose={() => setQuick(false)}
      />
    </SafeAreaView>
  );
}
