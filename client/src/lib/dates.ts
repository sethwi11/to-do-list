/*
 * Date helpers that work with *local* calendar dates ("YYYY-MM-DD").
 *
 * Pitfall to avoid: `new Date('2026-10-24')` is parsed as UTC midnight, so in
 * a US timezone it displays as Oct 23. These helpers build dates from their
 * year/month/day parts in local time instead.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** Formats a Date as a local "YYYY-MM-DD" string. */
export function toLocalISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayLocalISO(now: Date = new Date()): string {
  return toLocalISODate(now);
}

/** Parses "YYYY-MM-DD" as local midnight (not UTC). */
export function parseLocalISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  // Math.round absorbs the 23/25-hour days around daylight saving changes.
  return Math.round((parseLocalISODate(to).getTime() - parseLocalISODate(from).getTime()) / 86_400_000);
}

/** Short, human label for a due date relative to today: "Today", "Tomorrow", "Fri", "Oct 30". */
export function formatDueDate(dueDate: string, today: string = todayLocalISO()): string {
  const diff = daysBetween(today, dueDate);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';

  const date = parseLocalISODate(dueDate);
  if (diff > 1 && diff < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });

  const sameYear = date.getFullYear() === parseLocalISODate(today).getFullYear();
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** "14:30" -> "2:30 PM" in the user's locale. */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "2h 15m", "45m", "1d 3h": a live countdown label. Returns "now" once the time has arrived. */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'now';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return hours % 24 ? `${days}d ${hours % 24}h` : `${days}d`;
}
