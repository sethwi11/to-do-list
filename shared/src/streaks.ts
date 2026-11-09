import { addDays } from './dateMath';
import { eachDate } from './dateTime';
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

export const GYM = /\bgym\b/i;
export const LEETCODE = /leetcode/i;

const titled = (pattern: RegExp) => (items: readonly PlanItem[]) => items.some((i) => i.kind === 'routine' && pattern.test(i.title));
/** A check-in for something matching `pattern` that wasn't skipped. */
export const didIt = (pattern: RegExp, c: CheckIn) => pattern.test(c.title) && c.status !== 'skipped';
const checkedIn = (pattern: RegExp) => (checkIns: readonly CheckIn[]) => checkIns.some((c) => didIt(pattern, c));

/** What counts for each streak, read from the planned day, its check-ins, and whether a focus session happened. */
export const STREAKS: { id: string; label: string; planned: (items: readonly PlanItem[]) => boolean; done: (checkIns: readonly CheckIn[], focused: boolean) => boolean }[] = [
  { id: 'gym', label: 'Gym', planned: titled(GYM), done: checkedIn(GYM) },
  { id: 'leetcode', label: 'LeetCode', planned: titled(LEETCODE), done: checkedIn(LEETCODE) },
  { id: 'focus', label: 'Focus', planned: (items) => items.some((i) => i.kind === 'routine' && i.focus), done: (_c, focused) => focused },
  { id: 'checkin', label: 'Check-in', planned: (items) => items.some((i) => i.kind !== 'open'), done: (c) => c.length > 0 },
];

export interface Streak {
  id: string;
  label: string;
  days: number;
}

/** Each streak's planned/done flags for every day in [from, to]. `focusDates` are the local dates with a focus session. */
function streakDays(src: PlanSources, checkIns: readonly CheckIn[], focusDates: ReadonlySet<string>, from: string, to: string) {
  const days = eachDate(from, addDays(to, 1));
  const plans = days.map((d) => planDay(src, d).items);
  return STREAKS.map((s) => ({
    streak: s,
    days: days.map((d, i): StreakDay => ({ date: d, planned: s.planned(plans[i]!), done: s.done(checkIns.filter((c) => c.date === d), focusDates.has(d)) })),
  }));
}

/** Every streak as of `today`, looking back up to `lookback` days. */
export function streaksFor(src: PlanSources, checkIns: readonly CheckIn[], focusDates: ReadonlySet<string>, today: string, lookback = 120): Streak[] {
  return streakDays(src, checkIns, focusDates, addDays(today, -lookback), today).map(({ streak, days }) => ({ id: streak.id, label: streak.label, days: streakLength(days) }));
}

export interface StreakMilestone extends Streak {
  /** The day the streak first got this long. */
  on: string;
}

/** Every milestone length each streak has ever reached, and the first day it did, replayed from the first check-in or focus session. */
export function streakMilestones(src: PlanSources, checkIns: readonly CheckIn[], focusDates: ReadonlySet<string>, today: string): StreakMilestone[] {
  const first = [...checkIns.map((c) => c.date), ...focusDates].reduce((min, d) => (d < min ? d : min), today);
  return streakDays(src, checkIns, focusDates, first, today).flatMap(({ streak, days }) => {
    const out: StreakMilestone[] = [];
    let run = 0;
    for (const d of days) {
      if (!d.planned) continue;
      if (!d.done) {
        // Today isn't over yet, so it doesn't break the streak.
        if (d.date !== today) run = 0;
        continue;
      }
      run++;
      if (isMilestone(run) && !out.some((m) => m.days === run)) out.push({ id: streak.id, label: streak.label, days: run, on: d.date });
    }
    return out;
  });
}
