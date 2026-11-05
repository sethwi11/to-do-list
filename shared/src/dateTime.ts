import { addDays } from './dateMath';

/*
 * Arithmetic on "floating" local datetimes ("YYYY-MM-DDTHH:mm").
 *
 * Like dateMath.ts, this treats the numbers as a calendar calculator: no timezone and
 * no daylight saving. "10:00 plus 90 minutes" is 11:30 even on the day clocks change,
 * which is what a paper planner would say. (A real instant would be an hour off.)
 */

const MS_PER_MINUTE = 60_000;

function toMs(dt: string): number {
  const [date, time = '00:00'] = dt.split('T');
  const [y, m, d] = date!.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return Date.UTC(y!, m! - 1, d!, hh, mm);
}

function fromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16);
}

/** "2026-11-04T14:30" -> "2026-11-04". */
export const datePart = (dt: string): string => dt.slice(0, 10);

/** "2026-11-04T14:30" -> "14:30". */
export const timePart = (dt: string): string => dt.slice(11, 16);

/** "2026-11-04" + "14:30" -> "2026-11-04T14:30". A missing time means midnight. */
export const combine = (date: string, time = '00:00'): string => `${date}T${time}`;

/** Minutes since midnight: "14:30" -> 870. */
export function minutesOfDay(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h! * 60 + m!;
}

/** Inverse of minutesOfDay: 870 -> "14:30". */
export function timeOfMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  return `${String(h).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function addMinutes(dt: string, minutes: number): string {
  return fromMs(toMs(dt) + minutes * MS_PER_MINUTE);
}

/** How many minutes from `a` to `b` (negative if b is earlier). */
export function minutesBetween(a: string, b: string): number {
  return Math.round((toMs(b) - toMs(a)) / MS_PER_MINUTE);
}

/** Whole days from one date to another ("YYYY-MM-DD"), negative if b is earlier. */
export function daysBetween(a: string, b: string): number {
  return Math.round((toMs(combine(b)) - toMs(combine(a))) / (24 * 60 * MS_PER_MINUTE));
}

/** Dates (YYYY-MM-DD) from `start` up to but not including `end`. Capped so a bad range can't hang the app. */
export function eachDate(start: string, end: string, cap = 2000): string[] {
  const out: string[] = [];
  for (let d = start; d < end && out.length < cap; d = addDays(d, 1)) out.push(d);
  return out;
}
