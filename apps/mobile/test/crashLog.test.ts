import { beforeEach, describe, expect, it } from 'vitest';
import { File } from './mocks/expoFileSystem';
import { shared } from './mocks/expoSharing';
import { clearCrashLog, readCrashLog, recordCrash, shareCrashLog } from '../src/services/crashLog';

beforeEach(async () => {
  await clearCrashLog();
});

describe('offline crash log', () => {
  it('records errors with where/message and keeps only the newest 20', async () => {
    for (let i = 1; i <= 25; i++) await recordCrash(new Error(`boom ${i}`), 'render');
    const log = await readCrashLog();
    expect(log).toHaveLength(20);
    expect(log[0]!.message).toBe('boom 6');
    expect(log.at(-1)).toMatchObject({ where: 'render', message: 'boom 25' });
  });

  it('accepts non-Error values and never throws', async () => {
    await expect(recordCrash('plain string', 'global')).resolves.toBeUndefined();
    expect((await readCrashLog())[0]!.message).toBe('plain string');
  });

  it('shares a readable text report, and reports nothing to share when empty', async () => {
    expect(await shareCrashLog()).toBe(false);
    await recordCrash(new Error('kaput'), 'startup');
    expect(await shareCrashLog()).toBe(true);
    const report = await new File(shared.at(-1)!.url).text();
    expect(report).toContain('startup');
    expect(report).toContain('kaput');
  });
});
