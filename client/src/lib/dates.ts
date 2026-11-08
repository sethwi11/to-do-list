// Date helpers that work with *local* calendar dates ("YYYY-MM-DD").

const pad = (n: number) => String(n).padStart(2, '0');

export const WEEKDAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

const show = (iso: string, options: Intl.DateTimeFormatOptions) => parseLocalISODate(iso).toLocaleDateString(undefined, options);
/** "Nov 4" */
export const shortDate = (iso: string) => show(iso, { month: 'short', day: 'numeric' });
/** "Mon, Nov 9": for lists of specific days, where "Monday" alone can't say which one. */
export const plainDate = (iso: string) => show(iso, { weekday: 'short', month: 'short', day: 'numeric' });
/** "Nov 4, 2026" */
export const longDate = (iso: string) => show(iso, { month: 'short', day: 'numeric', year: 'numeric' });
/** "Monday, November 9" */
export const fullDate = (iso: string) => show(iso, { weekday: 'long', month: 'long', day: 'numeric' });

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

/** "14:30" -> "2:30 PM": always 12-hour, whatever the device's region uses. */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
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
