import { LocalDateSchema } from '@todo/shared';

// What the Tasks page is showing lives in the URL (/tasks?view=overdue&calendar=...), not in component state.

export const TASK_TABS = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'completed', label: 'Completed' },
] as const;

export type TaskTab = (typeof TASK_TABS)[number]['id'];

export interface TasksQuery {
  tab: TaskTab;
  /** Only tasks in this calendar. */
  calendarId: string | null;
  /** Only tasks due on this date ("YYYY-MM-DD"). */
  date: string | null;
}

/** Reads the query from the URL, ignoring anything malformed (a hand-edited URL can't break the page). */
export function parseTasksQuery(params: URLSearchParams): TasksQuery {
  const view = params.get('view');
  const date = params.get('date');
  return {
    tab: TASK_TABS.find((t) => t.id === view)?.id ?? 'all',
    calendarId: params.get('calendar') || null,
    date: date && LocalDateSchema.safeParse(date).success ? date : null,
  };
}

/** The URL for a query. Defaults are left out so the plain page is just /tasks. */
export function tasksUrl(query: Partial<TasksQuery> = {}): string {
  const params = new URLSearchParams();
  if (query.tab && query.tab !== 'all') params.set('view', query.tab);
  if (query.calendarId) params.set('calendar', query.calendarId);
  if (query.date) params.set('date', query.date);
  const qs = params.toString();
  return qs ? `/tasks?${qs}` : '/tasks';
}
