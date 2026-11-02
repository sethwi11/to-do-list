import { addDays, type Category, type Task } from '@todo/shared';

/*
 * Views are computed on the client from the full task list. For a single
 * user with hundreds (even thousands) of tasks this is instant, and switching
 * views needs no network round-trip. If the data ever grew huge, these
 * filters would move into SQL queries behind the repository.
 */

export type SmartViewId = 'today' | 'upcoming' | 'overdue' | 'all' | 'completed';

/** A discriminated union: TypeScript narrows `id` based on `type`. */
export type View = { type: 'smart'; id: SmartViewId } | { type: 'category'; id: string };

export const SMART_VIEWS: { id: SmartViewId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'all', label: 'All tasks' },
  { id: 'completed', label: 'Completed' },
];

export const sameView = (a: View, b: View) => a.type === b.type && a.id === b.id;

/** Whether a task belongs in a view (before search/filters are applied). */
export function inView(task: Task, view: View, today: string): boolean {
  if (view.type === 'category') return task.categoryId === view.id;

  switch (view.id) {
    case 'today':
      return task.dueDate === today;
    case 'upcoming': // the next 7 days, not counting today
      return task.dueDate !== null && task.dueDate > today && task.dueDate <= addDays(today, 7);
    case 'overdue':
      return task.status === 'todo' && task.dueDate !== null && task.dueDate < today;
    case 'all':
      return true;
    case 'completed':
      return task.status === 'done';
  }
}

export function viewTitle(view: View, categories: Category[]): string {
  if (view.type === 'smart') return SMART_VIEWS.find((v) => v.id === view.id)!.label;
  return categories.find((c) => c.id === view.id)?.name ?? 'List';
}

/** Default due date for the "add task" form in each view. */
export function defaultDueDateFor(view: View, today: string): string | null {
  if (view.type !== 'smart') return null;
  if (view.id === 'today') return today;
  if (view.id === 'upcoming') return addDays(today, 1);
  return null;
}

/** Number of open tasks in a view, shown as the badge in the sidebar. */
export function openCount(tasks: Task[], view: View, today: string): number {
  return tasks.filter((t) => t.status === 'todo' && inView(t, view, today)).length;
}
