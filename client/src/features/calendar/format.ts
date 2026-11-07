import { addDays, datePart, timePart, type Clash, type EventRecurrence } from '@todo/shared';
import { formatTime, parseLocalISODate } from '../../lib/dates';

const day = (date: string, withYear = false) =>
  parseLocalISODate(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) });

/** "10:00 AM – 11:15 AM": drops the first AM/PM when both are the same. */
export function formatTimeRange(startTime: string, endTime: string): string {
  const a = formatTime(startTime);
  const b = formatTime(endTime);
  const meridiem = (s: string) => s.slice(-2);
  return meridiem(a) === meridiem(b) && /AM|PM/i.test(meridiem(a)) ? `${a.slice(0, -3)} – ${b}` : `${a} – ${b}`;
}

/** A human line for when something happens: "Wed, Nov 4 · 10:00 – 11:15 AM", "Nov 4 – Nov 6 · All day". */
export function formatWhen(start: string, end: string, allDay: boolean): string {
  const startDate = datePart(start);
  if (allDay) {
    const last = addDays(datePart(end), -1); // all-day ends are exclusive
    return last > startDate ? `${day(startDate)} – ${day(last)} · All day` : `${day(startDate)} · All day`;
  }
  const endDate = datePart(end);
  if (endDate === startDate) return `${day(startDate)} · ${formatTimeRange(timePart(start), timePart(end))}`;
  return `${day(startDate)}, ${formatTime(timePart(start))} – ${day(endDate)}, ${formatTime(timePart(end))}`;
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Every week on Mon, Wed, until Dec 1". */
export function describeRepeat(rule: EventRecurrence): string {
  const base = { daily: 'Every day', weekdays: 'Every weekday', monthly: 'Every month', weekly: 'Every week' }[rule.freq];
  const on = rule.freq === 'weekly' && rule.byWeekday ? ` on ${rule.byWeekday.map((d) => WEEKDAY_SHORT[d]).join(', ')}` : '';
  const until = rule.until ? `, until ${parseLocalISODate(rule.until).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : '';
  return base + on + until;
}

/** A very short clock for tight spaces: "9a", "2:30p". */
export function formatClockShort(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h! >= 12 ? 'p' : 'a';
  const hour = h! % 12 === 0 ? 12 : h! % 12;
  return m ? `${hour}:${String(m).padStart(2, '0')}${suffix}` : `${hour}${suffix}`;
}

/** "Overlaps with “A”", "...“A” and “B”", "...“A” and 2 more": for a toast, where there's room for one short line. */
export function describeConflicts(conflicts: Clash[]): string {
  const names = conflicts.map((c) => (c.kind === 'block' ? `time for “${c.title}”` : `“${c.title}”`));
  if (names.length === 0) return '';
  if (names.length === 1) return `Overlaps with ${names[0]}`;
  if (names.length === 2) return `Overlaps with ${names[0]} and ${names[1]}`;
  return `Overlaps with ${names[0]} and ${names.length - 1} more`;
}

/** What to show in a time column for an event on a given day: its hours, "All day", or how it continues across midnight. */
export function formatEventTimeOnDay(start: string, end: string, allDay: boolean, date: string): string {
  if (allDay) return 'All day';
  if (datePart(end) === datePart(start)) return formatTimeRange(timePart(start), timePart(end));
  if (datePart(start) === date) return `${formatTime(timePart(start))} →`;
  return datePart(end) === date ? `until ${formatTime(timePart(end))}` : 'All day';
}
