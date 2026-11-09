import { addMonths } from './dateMath';
import type { PathSettings } from './models/path';

/** Stage 2 opens on this birthday. */
export const STAGE_2_AGE = 20;

/** The date you turn `age` (Feb 29 birthdays count as Feb 28 in other years). */
export const ageDate = (birthday: string, age: number) => addMonths(birthday, age * 12);

/** The day Stage 2 unlocks; null until a birthday is set. */
export const stageTwoDate = (birthday: string | null) => (birthday ? ageDate(birthday, STAGE_2_AGE) : null);

/** Locked the day before the birthday, open on it. With no birthday it stays locked. */
export function isStageUnlocked(birthday: string | null, today: string): boolean {
  const opens = stageTwoDate(birthday);
  return opens !== null && today >= opens;
}

/** Each north-star line with the date you'll be that age (null without a birthday). */
export const northStarDates = (path: PathSettings) => path.northStar.map((n) => ({ ...n, date: path.birthday ? ageDate(path.birthday, n.age) : null }));

const count = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

/** A distance in days as a person says it: "12 days", "8 months", "3 years, 5 months". */
export function countdown(days: number): string {
  if (days < 100) return count(Math.max(0, days), 'day');
  const months = Math.round(days / 30.4375);
  if (months < 24) return count(months, 'month');
  const years = Math.floor(months / 12);
  return months % 12 === 0 ? count(years, 'year') : `${count(years, 'year')}, ${count(months % 12, 'month')}`;
}
