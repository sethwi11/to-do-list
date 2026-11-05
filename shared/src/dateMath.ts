/*
 * Calendar arithmetic on "YYYY-MM-DD" strings.
 *
 * These are pure date-only calculations with no timezone involved. Internally
 * we use the Date object's *UTC* methods purely as a calendar calculator: UTC
 * has no daylight-saving jumps, so "add 1 day" is always exactly one day.
 * The result never gets interpreted as an instant in time.
 */

function toUTC(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function fromUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTC(d);
}

/**
 * Same day-of-month N months later, clamped to the month's last day
 * (Jan 31 + 1 month = Feb 28, not Mar 3 like naive Date math gives).
 */
export function addMonths(iso: string, months: number): string {
  const d = toUTC(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return fromUTC(d);
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(iso: string): number {
  return toUTC(iso).getUTCDay();
}

export function isWeekend(iso: string): boolean {
  const dow = dayOfWeek(iso);
  return dow === 0 || dow === 6;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export function weekdayName(iso: string): string {
  return WEEKDAYS[dayOfWeek(iso)]!;
}

export function lastDayOfMonth(iso: string): string {
  return addDays(addMonths(iso.slice(0, 8) + '01', 1), -1);
}

/**
 * ISO 8601 week number (weeks start on Monday; week 1 is the week containing the
 * year's first Thursday). Late-December dates can belong to week 1 of the next year,
 * and early-January dates to week 52 or 53 of the last.
 */
export function isoWeekNumber(iso: string): number {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3); // this week's Thursday decides the year
  const firstThursday = toUTC(`${d.getUTCFullYear()}-01-04`); // Jan 4 is always in week 1
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}
