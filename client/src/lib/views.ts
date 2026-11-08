import { addDays, type Task } from '@todo/shared';

export type SmartViewId = 'today' | 'upcoming' | 'overdue' | 'all' | 'completed';
export type View = { type: 'smart'; id: SmartViewId } | { type: 'calendar'; id: string };

/** Whether a task belongs in a view, before search and filters. (Client-side: instant for a single user's tasks.) */
export function inView(task: Task, view: View, today: string): boolean {
  if (view.type === 'calendar') return task.calendarId === view.id;
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
