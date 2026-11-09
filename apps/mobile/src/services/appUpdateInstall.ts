import { File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import type { AvailableUpdate } from './appUpdate';

const FLAG_GRANT_READ_URI_PERMISSION = 1;
const APK_MIME = 'application/vnd.android.package-archive';

/** Removes APKs left in the cache by earlier updates (each is ~60 MB). */
function deleteOldApks() {
  try {
    for (const item of Paths.cache.list()) {
      if (item instanceof File && /^gym-log-.*\.apk$/.test(item.name)) item.delete();
    }
  } catch {
    // Cleanup is best effort; a leftover file never blocks the update.
  }
}

/**
 * Downloads the release APK into the cache and opens Android's package installer on it. Android always asks the
 * user to confirm (and, the first time, to allow installs from Gym Log). Same signing key, so data is kept.
 */
export async function downloadAndInstall(update: AvailableUpdate): Promise<void> {
  deleteOldApks();
  const target = new File(Paths.cache, `gym-log-${update.version}.apk`);
  try {
    await File.downloadFileAsync(update.apkUrl, target, { idempotent: true });
  } catch {
    throw new Error('Download failed. Check your connection and try again.');
  }
  try {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: target.contentUri,
      type: APK_MIME,
      flags: FLAG_GRANT_READ_URI_PERMISSION,
    });
  } catch {
    throw new Error('Could not open the installer. Try again.');
  }
}
