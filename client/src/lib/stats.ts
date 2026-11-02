import { addDays, type Task } from '@todo/shared';
import { toLocalISODate } from './dates';

export interface DayCount {
  date: string;
  label: string;
  count: number;
}

export interface Stats {
  /** The last 7 days, oldest first, ending today. */
  week: DayCount[];
  completedToday: number;
  /** Consecutive days with at least one completion, ending today (or yesterday, if nothing yet today). */
  streak: number;
}

/**
 * completedAt is a UTC timestamp; a completion belongs to the user's *local*
 * day, so convert before bucketing (11 PM in California is tomorrow in UTC).
 */
export function computeStats(tasks: Task[], today: string): Stats {
  const perDay = new Map<string, number>();
  for (const t of tasks) {
    if (t.status !== 'done' || !t.completedAt) continue;
    const day = toLocalISODate(new Date(t.completedAt));
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  const week: DayCount[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = addDays(today, -i);
    const [y, m, d] = date.split('-').map(Number);
    week.push({
      date,
      label: new Date(y!, m! - 1, d!).toLocaleDateString(undefined, { weekday: 'narrow' }),
      count: perDay.get(date) ?? 0,
    });
  }

  // A streak isn't broken just because you haven't finished anything *yet* today.
  let day = perDay.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (perDay.has(day)) {
    streak++;
    day = addDays(day, -1);
  }

  return { week, completedToday: perDay.get(today) ?? 0, streak };
}
