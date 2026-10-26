import { beforeEach, describe, expect, it } from 'vitest';
import { SYNC_TABLES, parseBackup } from '@gym/shared';
import { Directory, File, resetFileSystem } from './mocks/expoFileSystem';
import { shared } from './mocks/expoSharing';
import { getMeta, setMeta } from '../src/db/meta';
import { getLocalUser } from '../src/db/repositories/user';
import { buildBackup, needsBackupReminder, pickBackupFile, restoreBackup, runAutoBackup, shareWorkoutsCsv, summarize } from '../src/services/backup';
import { createRecord } from '../src/db/mutate';
import { useSettingsStore } from '../src/state/settingsStore';
import { BENCH, SQUAT, freshApp, logWorkout, rows } from './helpers';

const FOLDER = 'content://test/tree/primary%3ADocuments';

async function snapshot() {
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const t of SYNC_TABLES) if (t !== 'users') out[t] = await rows(t);
  return out;
}

beforeEach(async () => {
  resetFileSystem();
  await freshApp();
});

describe('backup → wipe → restore', () => {
  it('restores identical data on a fresh install (re-owned by the new device user)', async () => {
    await logWorkout(BENCH, [{ weight: 60, reps: 10 }, { weight: 65, reps: 8, type: 'drop' }]);
    await logWorkout(SQUAT, [{ weight: 100, reps: 5 }], { finish: false });
    const oldUser = (await getLocalUser())!.id;
    const before = await snapshot();

    const parsed = parseBackup(JSON.stringify(await buildBackup()));
    expect(parsed.ok).toBe(true);

    const newUser = await freshApp(); // "uninstall + reinstall"
    const stats = await restoreBackup(parsed.ok ? parsed.backup : (null as never));
    expect(stats.added).toBeGreaterThan(0);

    const after = await snapshot();
    const reowned = JSON.parse(JSON.stringify(before).replaceAll(oldUser, newUser));
    expect(after).toEqual(reowned);
  });

  it('restores food, food log entries and weigh-ins, re-owned by the new user, and counts them', async () => {
    const userId = (await getLocalUser())!.id;
    const food = await createRecord('foods', { user_id: userId, name: 'Oats', brand: null, barcode: '5000000000001', source: 'custom', basis: 'g',
      kcal: 375, protein_g: 11, carbs_g: 60, fat_g: 8, fibre_g: null, sugars_g: null, sat_fat_g: null, salt_g: null, servings: [{ label: '1 bowl', grams: 60 }], archived_at: null });
    await createRecord('food_log_entries', { user_id: userId, local_date: '2026-10-26', meal: 'breakfast', logged_at: 1, kind: 'food',
      food_id: food.id, builtin_food_id: null, recipe_id: null, batch_id: null, name: 'Oats', serving_label: '1 bowl', servings: 1, grams: 60,
      kcal: 225, protein_g: 6.6, carbs_g: 36, fat_g: 4.8, fibre_g: null, sugars_g: null, sat_fat_g: null, salt_g: null });
    await createRecord('body_metrics', { user_id: userId, local_date: '2026-10-26', measured_at: 1, metric: 'weight', value: 80.4 });
    const before = await snapshot();
    const backup = await buildBackup();
    expect(summarize(backup)).toMatchObject({ foodEntries: 1, foods: 1, weighIns: 1 });

    const newUser = await freshApp();
    await restoreBackup(backup);
    expect(await snapshot()).toEqual(JSON.parse(JSON.stringify(before).replaceAll(userId, newUser)));
  });

  it('restoring the same backup twice changes nothing the second time', async () => {
    await logWorkout(BENCH, [{ weight: 60, reps: 10 }]);
    const backup = await buildBackup();
    await freshApp();
    await restoreBackup(backup);
    const second = await restoreBackup(backup);
    expect(second).toMatchObject({ added: 0, updated: 0 });
  });

  it('keeps newer local edits instead of older backup values (merge, not overwrite)', async () => {
    const { setIds } = await logWorkout(BENCH, [{ weight: 60, reps: 10 }]);
    const backup = await buildBackup();
    const { updateSet } = await import('../src/db/repositories/workouts');
    await updateSet(setIds[0]!, { weight_kg: 70 }); // edited after the backup
    await restoreBackup(backup);
    const set = (await rows('sets')).find((r) => r.id === setIds[0]);
    expect(set!.weight_kg).toBe(70);
  });

  it('brings settings back on a fresh install', async () => {
    await useSettingsStore.getState().update({ unit: 'imperial', default_rest_seconds: 135, rest_presets: [75] });
    const backup = await buildBackup();
    await freshApp();
    await restoreBackup(backup);
    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState()).toMatchObject({ unit: 'imperial', default_rest_seconds: 135, rest_presets: [75] });
  });
});

describe('automatic backups', () => {
  it('writes to the chosen folder and keeps only the newest 8 files', async () => {
    const dir = new Directory(FOLDER);
    for (let d = 1; d <= 9; d++) dir.createFile(`gymlog-backup-2026-01-0${d}_1200.json`).write('{}');
    dir.createFile('holiday-photo.jpg').write('x'); // not ours: never touched
    await setMeta('auto_backup_dir', FOLDER);
    await setMeta('auto_backup_enabled', '1');

    expect(await runAutoBackup({ force: true })).toBe(true);
    const names = dir.list().map((f) => f.name).sort();
    expect(names.filter((n) => n.startsWith('gymlog-backup-'))).toHaveLength(8);
    expect(names).toContain('holiday-photo.jpg');
    expect(names).not.toContain('gymlog-backup-2026-01-01_1200.json'); // oldest pruned
    expect(await getMeta('last_backup_kind')).toBe('automatic');
  });

  it('is skipped when not due, and records an error instead of throwing when the folder fails', async () => {
    await setMeta('auto_backup_dir', FOLDER);
    await setMeta('auto_backup_enabled', '1');
    await runAutoBackup({ force: true });
    expect(await runAutoBackup()).toBe(false); // < 7 days since the last one

    const original = Directory.prototype.createFile;
    Directory.prototype.createFile = () => {
      throw new Error('permission revoked');
    };
    try {
      expect(await runAutoBackup({ force: true })).toBe(false);
      expect(await getMeta('auto_backup_error')).toMatch(/Choose it again/);
    } finally {
      Directory.prototype.createFile = original;
    }
  });

  it('reminds only when there are finished workouts and no recent backup', async () => {
    expect(await needsBackupReminder()).toBe(false); // nothing logged yet
    await logWorkout(BENCH, [{ weight: 60, reps: 10 }]);
    expect(await needsBackupReminder()).toBe(true);
    await setMeta('last_backup_at', String(Date.now()));
    expect(await needsBackupReminder()).toBe(false);
  });
});

describe('picking and exporting files', () => {
  it('rejects a file that is not a Gym Log backup with a friendly message', async () => {
    const f = new File('file:///downloads/notes.json');
    f.write('{"hello":"world"}');
    File.nextPick = f;
    const result = await pickBackupFile();
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('isn’t a Gym Log backup') });
    File.nextPick = null;
  });

  it('shares a CSV with one row per logged set', async () => {
    await logWorkout(BENCH, [{ weight: 60, reps: 10 }, { weight: 62.5, reps: 8 }]);
    await shareWorkoutsCsv();
    const last = shared.at(-1)!;
    expect(last.mimeType).toBe('text/csv');
    const csv = await new File(last.url).text();
    expect(csv.trim().split('\r\n')).toHaveLength(3); // header + 2 sets
  });
});
