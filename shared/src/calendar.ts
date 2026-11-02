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
