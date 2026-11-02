import { addDays, addMonths, isWeekend } from './calendar';
import type { Recurrence } from './task';

/** One step of a recurrence rule: the next date strictly after `from`. */
export function stepRecurrence(from: string, rule: Exclude<Recurrence, 'none'>): string {
  switch (rule) {
    case 'daily':
      return addDays(from, 1);
    case 'weekly':
      return addDays(from, 7);
    case 'monthly':
      return addMonths(from, 1);
    case 'weekdays': {
      let next = addDays(from, 1);
      while (isWeekend(next)) next = addDays(next, 1);
      return next;
    }
  }
}

/**
 * Due date for the next occurrence when a recurring task is completed.
 *
 * Design choices:
 * - Anchor on the *due date*, not on when you finished it. Finishing a
 *   "weekly on Monday" task on Wednesday should give next Monday, not
 *   next Wednesday, so the schedule doesn't drift.
 * - If you finish late, skip ahead past occurrences already in the past, so
 *   completing a daily task that's 5 days overdue gives today's occurrence
 *   instead of 4 more overdue copies. The next one can be today.
 * - No due date? Anchor on today.
 *
 * Known trade-off: monthly clamping drifts (Jan 31 -> Feb 28 -> Mar 28),
 * because we only remember the previous due date, not the original day.
 */
export function nextOccurrence(dueDate: string | null, rule: Recurrence, today: string): string | null {
  if (rule === 'none') return null;

  let next = stepRecurrence(dueDate ?? today, rule);
  while (next < today) next = stepRecurrence(next, rule); // ISO strings compare chronologically
  return next;
}
