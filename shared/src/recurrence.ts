import { addDays, addMonths, isWeekend } from './dateMath';
import type { Recurrence } from './models/tasks';

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

/** Due date for the next occurrence when a recurring task is completed. */
export function nextOccurrence(dueDate: string | null, rule: Recurrence, today: string): string | null {
  if (rule === 'none') return null;

  let next = stepRecurrence(dueDate ?? today, rule);
  while (next < today) next = stepRecurrence(next, rule); // ISO strings compare chronologically
  return next;
}
