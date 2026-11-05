import type { Task } from '@todo/shared';

/** A minimal task for tests. */
export function buildBlank(title: string, dueDate: string | null, extra: Partial<Task> = {}): Task {
  return {
    id: title,
    title,
    notes: null,
    dueDate,
    dueTime: null,
    priority: 'medium',
    calendarId: null,
    courseId: null,
    applicationId: null,
    reminders: [],
    status: 'todo',
    subtasks: [],
    recurrence: 'none',
    estimatedMinutes: null,
    source: 'manual',
    sourceSnippet: null,
    sortOrder: 0,
    createdAt: '2026-11-04T00:00:00.000Z',
    updatedAt: '2026-11-04T00:00:00.000Z',
    completedAt: null,
    nextOccurrenceId: null,
    ...extra,
  };
}
