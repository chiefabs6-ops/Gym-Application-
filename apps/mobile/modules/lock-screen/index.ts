import { requireOptionalNativeModule } from 'expo';

/** Native side: modules/lock-screen/android (Kotlin). Missing in Expo Go / tests: everything no-ops. */
interface LockScreenNative {
  setShowWhenLocked(enabled: boolean): void;
  isLocked(): boolean;
  requestUnlock(): Promise<boolean>;
  addListener(event: 'onLockChange', cb: (e: { locked: boolean }) => void): { remove(): void };
}

const native = requireOptionalNativeModule<LockScreenNative>('LockScreen');

export const lockScreenAvailable = native !== null;
export const setShowWhenLocked = (enabled: boolean) => native?.setShowWhenLocked(enabled);
export const isDeviceLocked = () => native?.isLocked() ?? false;
export const requestUnlock = () => native?.requestUnlock() ?? Promise.resolve(true);
export const addLockListener = (cb: (locked: boolean) => void) =>
  native?.addListener('onLockChange', (e) => cb(e.locked)) ?? { remove: () => undefined };
