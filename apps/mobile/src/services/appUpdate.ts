/**
 * In-app update check (sideloaded APK, no Play Store). The newest GitHub release of the public repo carries the
 * APK as an asset named exactly `gym-log.apk` (see docs/release-apk.md). This module only reads release info;
 * downloading and opening the installer lives in appUpdateInstall.ts (native modules).
 */
export const RELEASES_LATEST_URL = 'https://api.github.com/repos/chiefabs6-ops/Gym-Application-/releases/latest';
export const APK_ASSET_NAME = 'gym-log.apk';
const DOWNLOAD_URL_PREFIX = 'https://github.com/chiefabs6-ops/Gym-Application-/releases/download/';
const TIMEOUT_MS = 15_000;

export interface AvailableUpdate {
  version: string;
  apkUrl: string;
  /** Release title, e.g. "Gym Log 0.3.2: fixes". */
  title: string;
  sizeBytes: number | null;
}

/** Parses "v0.3.2" / "0.3.2" into numbers; null when it isn't a plain dotted version. */
export function parseVersion(v: string): number[] | null {
  const m = /^v?(\d+(?:\.\d+)*)$/.exec(v.trim());
  return m ? m[1]!.split('.').map(Number) : null;
}

/** Negative when a < b, 0 when equal, positive when a > b. Missing parts count as 0 (0.3 == 0.3.0). */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a) ?? [0];
  const pb = parseVersion(b) ?? [0];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

interface ReleaseJson {
  tag_name?: unknown;
  name?: unknown;
  draft?: unknown;
  prerelease?: unknown;
  assets?: { name?: unknown; browser_download_url?: unknown; size?: unknown }[];
}

/** Picks the APK out of a GitHub "latest release" reply; null when the release has no usable APK. */
export function parseLatestRelease(json: unknown): AvailableUpdate | null {
  const r = json as ReleaseJson | null;
  if (!r || typeof r.tag_name !== 'string' || r.draft === true || r.prerelease === true) return null;
  if (!parseVersion(r.tag_name)) return null;
  const asset = Array.isArray(r.assets) ? r.assets.find((a) => a?.name === APK_ASSET_NAME) : undefined;
  const url = asset?.browser_download_url;
  if (typeof url !== 'string' || !url.startsWith(DOWNLOAD_URL_PREFIX)) return null;
  return {
    version: r.tag_name.trim().replace(/^v/, ''),
    apkUrl: url,
    title: typeof r.name === 'string' && r.name ? r.name : r.tag_name,
    sizeBytes: typeof asset?.size === 'number' ? asset.size : null,
  };
}

export type UpdateCheck = { kind: 'up-to-date'; latest: string } | { kind: 'available'; update: AvailableUpdate };

/** Asks GitHub for the newest release. Throws a short, user-readable Error when offline or GitHub fails. */
export async function checkForUpdate(currentVersion: string, fetchImpl: typeof fetch = fetch): Promise<UpdateCheck> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  let json: unknown;
  try {
    res = await fetchImpl(RELEASES_LATEST_URL, { headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal });
    json = res.ok ? await res.json() : null;
  } catch {
    throw new Error('No internet connection.');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(res.status === 403 ? 'GitHub is busy, try again later.' : `GitHub error ${res.status}.`);
  const update = parseLatestRelease(json);
  if (!update) throw new Error('No installable update found on GitHub.');
  return compareVersions(update.version, currentVersion) > 0
    ? { kind: 'available', update }
    : { kind: 'up-to-date', latest: update.version };
}
