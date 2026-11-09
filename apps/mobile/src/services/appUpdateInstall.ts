import { File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import type { AvailableUpdate } from './appUpdate';

const FLAG_GRANT_READ_URI_PERMISSION = 1;
const APK_MIME = 'application/vnd.android.package-archive';

/**
 * Downloads the release APK into the cache and opens Android's package installer on it. Android always asks the
 * user to confirm (and, the first time, to allow installs from Gym Log). Same signing key, so data is kept.
 */
export async function downloadAndInstall(update: AvailableUpdate): Promise<void> {
  const target = new File(Paths.cache, `gym-log-${update.version}.apk`);
  if (target.exists) target.delete();
  try {
    await File.downloadFileAsync(update.apkUrl, target, { idempotent: true });
  } catch {
    throw new Error('Download failed. Check your connection and try again.');
  }
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: target.contentUri,
    type: APK_MIME,
    flags: FLAG_GRANT_READ_URI_PERMISSION,
  });
}
