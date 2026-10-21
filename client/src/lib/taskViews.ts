import type { Priority, Task } from '@todo/shared';

/*
 * Views are computed on the client from the full task list. For a single
 * user with hundreds (even thousands) of tasks this is instant, and switching
 * views needs no network round-trip. If the data ever grew huge, these
 * filters would move into SQL queries behind the repository.
 */

export type ViewId = 'today' | 'all';

export const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'all', label: 'All tasks' },
];

export function filterForView(tasks: Task[], view: ViewId, today: string): Task[] {
  switch (view) {
    case 'today':
      return tasks.filter((t) => t.dueDate === today);
    case 'all':
      return tasks;
  }
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/** Open tasks first, then by due date (no date last), due time, priority, and manual order. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      Number(a.status === 'done') - Number(b.status === 'done') ||
      compareNullableLast(a.dueDate, b.dueDate) ||
      compareNullableLast(a.dueTime, b.dueTime) ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      a.sortOrder - b.sortOrder,
  );
}

// "YYYY-MM-DD" and "HH:mm" strings sort correctly as plain strings, which is
// one more reason to store them in that format.
function compareNullableLast(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}
