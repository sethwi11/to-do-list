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

/**
 * A lookup table of real dates for the extraction prompt.
 *
 * Language models are much more reliable at *looking up* "Friday" in a table
 * than at doing calendar arithmetic, so we do the arithmetic here (where it's
 * deterministic and unit-tested) and let the model pick from the table.
 * Conventions: "Friday" = the next Friday on or after today; "next Friday" =
 * the Friday in the following week; "end of the week" = this Friday;
 * "this weekend" = this Saturday.
 */
export function buildDateContext(today: string): string {
  const lines = [`Today: ${weekdayName(today)} ${today}`, `Tomorrow: ${weekdayName(addDays(today, 1))} ${addDays(today, 1)}`];

  const dow = dayOfWeek(today);
  // Each weekday's next occurrence (offset 0 = today), plus the one a week later.
  for (let offset = 0; offset < 7; offset++) {
    const date = addDays(today, offset);
    const name = weekdayName(date);
    lines.push(`"${name}" / "this ${name}": ${date}   |   "next ${name}": ${addDays(date, 7)}`);
  }

  const daysToFriday = (5 - dow + 7) % 7;
  const daysToSaturday = (6 - dow + 7) % 7;
  const daysToNextMonday = ((1 - dow + 7) % 7) || 7;
  lines.push(`"end of the week": ${addDays(today, daysToFriday)}`);
  lines.push(`"this weekend": ${addDays(today, daysToSaturday)}`);
  lines.push(`"next week" (start): ${addDays(today, daysToNextMonday)}`);
  lines.push(`"end of the month": ${lastDayOfMonth(today)}`);
  return lines.join('\n');
}

export function lastDayOfMonth(iso: string): string {
  return addDays(addMonths(iso.slice(0, 8) + '01', 1), -1);
}
