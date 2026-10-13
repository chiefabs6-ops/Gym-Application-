import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Offline crash log (ROADMAP 1.6). Errors are appended to a small JSON-lines file in the app's
 * document folder (kept across restarts, never sent anywhere). The user can share it from Settings
 * or the crash screen. Only the newest MAX_ENTRIES are kept.
 */
const MAX_ENTRIES = 20;
const FILE_NAME = 'crash-log.jsonl';

export interface CrashEntry {
  at: number;
  where: string;
  message: string;
  stack?: string;
  appVersion: string;
}

const logFile = () => new File(Paths.document, FILE_NAME);

export async function readCrashLog(): Promise<CrashEntry[]> {
  try {
    const f = logFile();
    if (!f.exists) return [];
    return (await f.text())
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as CrashEntry);
  } catch {
    return [];
  }
}

/** Never throws: logging a crash must not cause another one. */
export async function recordCrash(error: unknown, where: string): Promise<void> {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const entry: CrashEntry = {
      at: Date.now(),
      where,
      message: err.message.slice(0, 500),
      stack: err.stack?.split('\n').slice(0, 15).join('\n'),
      appVersion: Constants.expoConfig?.version ?? 'unknown',
    };
    const entries = [...(await readCrashLog()), entry].slice(-MAX_ENTRIES);
    const f = logFile();
    if (!f.exists) f.create();
    f.write(entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
  } catch {
    // ignore
  }
}

export async function shareCrashLog(): Promise<boolean> {
  const entries = await readCrashLog();
  if (entries.length === 0) return false;
  const report = new File(Paths.cache, 'gymlog-error-report.txt');
  if (report.exists) report.delete();
  report.create();
  report.write(
    entries
      .map((e) => `[${new Date(e.at).toISOString()}] v${e.appVersion} ${e.where}\n${e.message}\n${e.stack ?? ''}`)
      .join('\n\n---\n\n'),
  );
  await Sharing.shareAsync(report.uri, { mimeType: 'text/plain', dialogTitle: 'Share Gym Log error report' });
  return true;
}

export async function clearCrashLog(): Promise<void> {
  try {
    const f = logFile();
    if (f.exists) f.delete();
  } catch {
    // ignore
  }
}

/**
 * Also log errors that happen outside React rendering (e.g. in an async handler) before RN's
 * default handler shows the red box (dev) or closes the app (release).
 */
export function installGlobalErrorLogging(): void {
  const errorUtils = (globalThis as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } }).ErrorUtils;
  if (!errorUtils) return;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    void recordCrash(error, isFatal ? 'fatal (global)' : 'global');
    previous(error, isFatal);
  });
}
