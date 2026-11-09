import { toLocalDateKey } from '@gym/shared';
import { formatDayKey } from './food/dayLabel';

/** Calendar days from the day of `ms` to today (local). */
export function daysAgo(ms: number, now = new Date()): number {
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((day(now) - day(new Date(ms))) / 86_400_000);
}

/** "Today", "Yesterday", else "Thu 22 Oct". */
export const shortDay = (ms: number, now = new Date()) => formatDayKey(toLocalDateKey(new Date(ms)), now);

/** "today", "yesterday", else "Thu 22 Oct, 5 days ago". */
export function whenText(ms: number, now = new Date()): string {
  const n = daysAgo(ms, now);
  if (n === 0) return 'today';
  if (n === 1) return 'yesterday';
  return `${shortDay(ms, now)}, ${n} days ago`;
}

/** "Sun 25" for compact strips. */
export const dayAndDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
