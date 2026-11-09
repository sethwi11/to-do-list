import { addDays, isOverdue, type Priority, type Task } from '@todo/shared';

export interface Filters {
  query: string;
  priority: Priority | 'any';
  /** A calendar id, 'none' for unassigned, or 'any'. */
  calendarId: string;
  status: 'any' | 'todo' | 'done';
  due: 'any' | 'overdue' | 'today' | 'tomorrow' | 'week' | 'none';
}

export const DEFAULT_FILTERS: Filters = { query: '', priority: 'any', calendarId: 'any', status: 'any', due: 'any' };

export const isFiltering = (f: Filters) =>
  (Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]).some((k) => f[k] !== DEFAULT_FILTERS[k]);

export function applyFilters(tasks: Task[], f: Filters, today: string): Task[] {
  const q = f.query.trim().toLowerCase();

  return tasks.filter((t) => {
    if (q) {
      // Search title, notes, and subtask titles.
      const haystack = [t.title, t.notes ?? '', ...t.subtasks.map((s) => s.title)].join('\n').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (f.priority !== 'any' && t.priority !== f.priority) return false;
    if (f.calendarId === 'none' && t.calendarId !== null) return false;
    if (f.calendarId !== 'any' && f.calendarId !== 'none' && t.calendarId !== f.calendarId) return false;
    if (f.status !== 'any' && t.status !== f.status) return false;

    switch (f.due) {
      case 'overdue':
        return isOverdue(t, today);
      case 'today':
        return t.dueDate === today;
      case 'tomorrow':
        return t.dueDate === addDays(today, 1);
      case 'week':
        return t.dueDate !== null && t.dueDate >= today && t.dueDate <= addDays(today, 7);
      case 'none':
        return t.dueDate === null;
      default:
        return true;
    }
  });
}

// ---- sorting ---------------------------------------------------------------

export type SortMode = 'due' | 'priority' | 'manual';

export const SORT_MODES: { id: SortMode; label: string }[] = [
  { id: 'due', label: 'Due date' },
  { id: 'priority', label: 'Priority' },
  { id: 'manual', label: 'Manual (drag)' },
];

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

// "YYYY-MM-DD" and "HH:mm" strings sort correctly as plain strings, which is one more reason to store them in that format.
function compareNullableLast(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

const byDue = (a: Task, b: Task) =>
  compareNullableLast(a.dueDate, b.dueDate) || compareNullableLast(a.dueTime, b.dueTime);
const byPriority = (a: Task, b: Task) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
const byManual = (a: Task, b: Task) => a.sortOrder - b.sortOrder;

/** Comparators chained with `||`: the first one that returns non-zero decides, and the later ones only break ties. */
export function sortTasks(tasks: Task[], mode: SortMode): Task[] {
  const compare = {
    due: (a: Task, b: Task) => byDue(a, b) || byPriority(a, b) || byManual(a, b),
    priority: (a: Task, b: Task) => byPriority(a, b) || byDue(a, b) || byManual(a, b),
    manual: byManual,
  }[mode];
  return [...tasks].sort(compare);
}

/** Most recently completed first (used by the Completed view and done sections). */
export const sortByCompletedDesc = (tasks: Task[]) =>
  [...tasks].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
