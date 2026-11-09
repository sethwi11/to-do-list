import { addDays, addMonths, dayOfWeek, isWeekend } from './dateMath';
import type { Recurrence, Task } from './models/tasks';

/** One step of a recurrence rule: the next date strictly after `from`. A weekly rule with `days` steps to the next of those weekdays. */
export function stepRecurrence(from: string, rule: Exclude<Recurrence, 'none'>, days: readonly number[] = []): string {
  switch (rule) {
    case 'daily':
      return addDays(from, 1);
    case 'weekly': {
      if (days.length === 0) return addDays(from, 7);
      let next = addDays(from, 1);
      while (!days.includes(dayOfWeek(next))) next = addDays(next, 1);
      return next;
    }
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
export function nextOccurrence(dueDate: string | null, rule: Recurrence, today: string, days: readonly number[] = []): string | null {
  if (rule === 'none') return null;

  let next = stepRecurrence(dueDate ?? today, rule, days);
  while (next < today) next = stepRecurrence(next, rule, days); // ISO strings compare chronologically
  return next;
}

type RollFields = Pick<Task, 'status' | 'dueDate' | 'recurrence' | 'rollsOver' | 'repeatDays' | 'missedAt'>;

/** A repeating task that rolls over: unfinished by its next occurrence, it is marked missed instead of going overdue. */
export const isRolling = (t: Pick<Task, 'recurrence' | 'rollsOver'>) => t.recurrence !== 'none' && t.rollsOver;

/** Open, past its due date, and not a rolling task (those are never overdue). */
export const isOverdue = (t: RollFields, today: string) => t.status === 'todo' && t.missedAt === null && t.dueDate !== null && t.dueDate < today && !isRolling(t);

/** The last day an open rolling task is still current: the day before its next occurrence. */
export const rollDeadline = (t: RollFields) => (t.dueDate && t.recurrence !== 'none' ? addDays(stepRecurrence(t.dueDate, t.recurrence, t.repeatDays), -1) : null);

/** When an open rolling task's next occurrence has arrived: the due date of the occurrence that replaces it (the latest one on or before today). */
export function rollTarget(t: RollFields, today: string): string | null {
  if (!isRolling(t) || t.status !== 'todo' || t.missedAt !== null || !t.dueDate || t.recurrence === 'none') return null;
  let next = stepRecurrence(t.dueDate, t.recurrence, t.repeatDays);
  if (next > today) return null;
  for (let after = stepRecurrence(next, t.recurrence, t.repeatDays); after <= today; after = stepRecurrence(after, t.recurrence, t.repeatDays)) next = after;
  return next;
}
