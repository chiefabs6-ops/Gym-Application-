import { describe, expect, it, vi } from 'vitest';
import { RELEASES_LATEST_URL, checkForUpdate, compareVersions, parseLatestRelease } from '../src/services/appUpdate';

const release = (over: Record<string, unknown> = {}) => ({
  tag_name: 'v0.3.2',
  name: 'Gym Log 0.3.2',
  draft: false,
  prerelease: false,
  assets: [
    { name: 'notes.txt', browser_download_url: 'https://github.com/x/notes.txt', size: 1 },
    { name: 'gym-log.apk', browser_download_url: 'https://github.com/chiefabs6-ops/Gym-Application-/releases/download/v0.3.2/gym-log.apk', size: 1234 },
  ],
  ...over,
});

const reply = (body: unknown, status = 200) =>
  vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));

describe('compareVersions', () => {
  it('compares numerically, not as text', () => {
    expect(compareVersions('0.10.0', '0.9.9')).toBeGreaterThan(0);
    expect(compareVersions('0.3.1', '0.3.2')).toBeLessThan(0);
  });
  it('ignores a leading v and missing parts', () => {
    expect(compareVersions('v0.3.2', '0.3.2')).toBe(0);
    expect(compareVersions('0.3', '0.3.0')).toBe(0);
  });
});

describe('parseLatestRelease', () => {
  it('picks the gym-log.apk asset', () => {
    expect(parseLatestRelease(release())).toEqual({
      version: '0.3.2',
      apkUrl: 'https://github.com/chiefabs6-ops/Gym-Application-/releases/download/v0.3.2/gym-log.apk',
      title: 'Gym Log 0.3.2',
      sizeBytes: 1234,
    });
  });
  it('rejects releases without the APK, drafts, prereleases, odd tags and non-GitHub links', () => {
    expect(parseLatestRelease(release({ assets: [] }))).toBeNull();
    expect(parseLatestRelease(release({ draft: true }))).toBeNull();
    expect(parseLatestRelease(release({ prerelease: true }))).toBeNull();
    expect(parseLatestRelease(release({ tag_name: 'latest' }))).toBeNull();
    expect(parseLatestRelease(release({ assets: [{ name: 'gym-log.apk', browser_download_url: 'https://evil.example/a.apk' }] }))).toBeNull();
    expect(parseLatestRelease(null)).toBeNull();
  });
});

describe('checkForUpdate', () => {
  it('reports a newer release', async () => {
    const f = reply(release());
    const r = await checkForUpdate('0.3.1', f as unknown as typeof fetch);
    expect(f.mock.calls[0]![0]).toBe(RELEASES_LATEST_URL);
    expect(r).toMatchObject({ kind: 'available', update: { version: '0.3.2' } });
  });
  it('is up to date on the same or an older release', async () => {
    expect(await checkForUpdate('0.3.2', reply(release()) as unknown as typeof fetch)).toEqual({ kind: 'up-to-date', latest: '0.3.2' });
    expect((await checkForUpdate('0.4.0', reply(release()) as unknown as typeof fetch)).kind).toBe('up-to-date');
  });
  it('gives readable errors', async () => {
    const offline = vi.fn(async () => {
      throw new TypeError('Network request failed');
    });
    await expect(checkForUpdate('0.3.1', offline as unknown as typeof fetch)).rejects.toThrow('No internet connection.');
    await expect(checkForUpdate('0.3.1', reply({}, 404) as unknown as typeof fetch)).rejects.toThrow('GitHub error 404.');
    await expect(checkForUpdate('0.3.1', reply(release({ assets: [] })) as unknown as typeof fetch)).rejects.toThrow('No installable update');
  });
});
