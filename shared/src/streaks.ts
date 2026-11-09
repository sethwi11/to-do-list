import { addDays } from './dateMath';
import type { CheckIn } from './models/checkins';
import { planDay, type PlanItem, type PlanSources } from './planDay';

// Streaks: consecutive days you did what was planned. A day with nothing planned for a streak doesn't break it.

export interface StreakDay {
  date: string;
  planned: boolean;
  done: boolean;
}

/** Days done in a row, counting back from the last day given (today). Unplanned days are skipped; today, if not done yet, is still in progress. */
export function streakLength(days: readonly StreakDay[]): number {
  let n = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i]!;
    if (!d.planned) continue;
    if (d.done) n++;
    else if (i === days.length - 1) continue;
    else break;
  }
  return n;
}

/** 7, 14, 30, 50 and 100 days, then every 100. */
export const isMilestone = (n: number) => [7, 14, 30, 50].includes(n) || (n >= 100 && n % 100 === 0);

const titled = (pattern: RegExp) => (items: readonly PlanItem[]) => items.some((i) => i.kind === 'routine' && pattern.test(i.title));
const checkedIn = (pattern: RegExp) => (checkIns: readonly CheckIn[]) => checkIns.some((c) => pattern.test(c.title) && c.status !== 'skipped');

/** What counts for each streak, read from the planned day, its check-ins, and whether a focus session happened. */
export const STREAKS: { id: string; label: string; planned: (items: readonly PlanItem[]) => boolean; done: (checkIns: readonly CheckIn[], focused: boolean) => boolean }[] = [
  { id: 'gym', label: 'Gym', planned: titled(/\bgym\b/i), done: (c) => checkedIn(/\bgym\b/i)(c) },
  { id: 'leetcode', label: 'LeetCode', planned: titled(/leetcode/i), done: (c) => checkedIn(/leetcode/i)(c) },
  { id: 'focus', label: 'Focus', planned: (items) => items.some((i) => i.kind === 'routine' && i.focus), done: (_c, focused) => focused },
  { id: 'checkin', label: 'Check-in', planned: (items) => items.some((i) => i.kind !== 'open'), done: (c) => c.length > 0 },
];

export interface Streak {
  id: string;
  label: string;
  days: number;
}

/** Every streak as of `today`, looking back up to `lookback` days. `focusDates` are the local dates with a focus session. */
export function streaksFor(src: PlanSources, checkIns: readonly CheckIn[], focusDates: ReadonlySet<string>, today: string, lookback = 120): Streak[] {
  const days = Array.from({ length: lookback + 1 }, (_, i) => addDays(today, i - lookback));
  const plans = days.map((d) => planDay(src, d).items);
  return STREAKS.map((s) => ({
    id: s.id,
    label: s.label,
    days: streakLength(days.map((d, i) => {
      const day = checkIns.filter((c) => c.date === d);
      return { date: d, planned: s.planned(plans[i]!), done: s.done(day, focusDates.has(d)) };
    })),
  }));
}
