import { addDaysToKey, toLocalDateKey } from '@gym/shared';

/** "Today", "Yesterday", "Tomorrow", else "Thu 23 Oct". */
export function formatDayKey(key: string, now = new Date()): string {
  const today = toLocalDateKey(now);
  if (key === today) return 'Today';
  if (key === addDaysToKey(today, -1)) return 'Yesterday';
  if (key === addDaysToKey(today, 1)) return 'Tomorrow';
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
