import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Calendar, CreateCalendarInput, CreateTaskInput, Task, UpdateCalendarInput, UpdateTaskInput } from '@todo/shared';
import { ApiError } from '../api/client';
import { calendarHooks } from '../data/useCalendars';
import { keys } from '../data/queryClient';
import { useTaskMutations, useTasksQuery } from '../data/useTasks';

const messageOf = (err: unknown) => (err instanceof ApiError ? err.message : 'Unexpected error');
const NONE: never[] = [];

/**
 * The current screen's view of the data: tasks and calendars plus the actions on
 * them, with the same shape it had before TanStack Query arrived. The caching,
 * optimistic updates, and rollback now live in src/data/; this file only adapts
 * them (each action resolves to the saved row, or null/false if it failed and
 * has been rolled back, with the reason shown in the error banner).
 *
 * The planner screens being built next will use the hooks in src/data/ directly,
 * and this adapter goes away once the task screens move over.
 */
export function useTodoData() {
  const qc = useQueryClient();
  const tasksQuery = useTasksQuery();
  const calendarsQuery = calendarHooks.useList();
  const task = useTaskMutations();
  const createCal = calendarHooks.useCreate();
  const updateCal = calendarHooks.useUpdate();
  const deleteCal = calendarHooks.useDelete();

  // A failed action shows in the banner until dismissed. A failed *load* does too, but is
  // dismissed by remembering that specific error object, so a new failure shows again.
  const [actionError, setActionError] = useState<string | null>(null);
  const [dismissedLoadError, setDismissedLoadError] = useState<unknown>(null);
  const loadError = tasksQuery.error ?? calendarsQuery.error;
  const error = actionError ?? (loadError && loadError !== dismissedLoadError ? messageOf(loadError) : null);

  /** Runs an action; on failure, shows the reason and resolves to null instead of throwing. */
  const attempt = useCallback(async <R,>(action: () => Promise<R>): Promise<R | null> => {
    try {
      return await action();
    } catch (err) {
      setActionError(messageOf(err));
      return null;
    }
  }, []);

  const { mutateAsync: createTaskAsync } = task.create;
  const { mutateAsync: updateTaskAsync } = task.update;
  const { mutateAsync: removeTaskAsync } = task.remove;
  const { mutateAsync: restoreTaskAsync } = task.restore;
  const { mutateAsync: reorderAsync } = task.reorder;
  const { mutateAsync: createCalAsync } = createCal;
  const { mutateAsync: updateCalAsync } = updateCal;
  const { mutateAsync: deleteCalAsync } = deleteCal;

  return {
    tasks: tasksQuery.data ?? NONE,
    calendars: calendarsQuery.data ?? NONE,
    loading: tasksQuery.isPending || calendarsQuery.isPending,
    error,
    dismissError: () => {
      setActionError(null);
      setDismissedLoadError(loadError);
    },
    reload: async () => {
      setActionError(null);
      await Promise.all([tasksQuery.refetch(), calendarsQuery.refetch()]);
    },

    createTask: useCallback((input: CreateTaskInput) => attempt<Task>(() => createTaskAsync(input)), [attempt, createTaskAsync]),
    updateTask: useCallback(
      (id: string, changes: UpdateTaskInput) => attempt<Task>(() => updateTaskAsync({ id, changes })),
      [attempt, updateTaskAsync],
    ),
    deleteTask: useCallback(async (id: string) => (await attempt(() => removeTaskAsync(id))) !== null, [attempt, removeTaskAsync]),
    restoreTask: useCallback(async (id: string) => void (await attempt(() => restoreTaskAsync(id))), [attempt, restoreTaskAsync]),
    reorderAll: useCallback(async (ids: string[]) => void (await attempt(() => reorderAsync(ids))), [attempt, reorderAsync]),

    createCalendar: useCallback(
      (input: CreateCalendarInput) => attempt<Calendar>(() => createCalAsync(input)),
      [attempt, createCalAsync],
    ),
    updateCalendar: useCallback(
      async (id: string, changes: UpdateCalendarInput) => (await attempt(() => updateCalAsync({ id, changes }))) !== null,
      [attempt, updateCalAsync],
    ),
    deleteCalendar: useCallback(
      async (id: string) => {
        const ok = (await attempt(() => deleteCalAsync(id))) !== null;
        // The server un-assigns the calendar's tasks; refetch so the screen matches.
        if (ok) void qc.invalidateQueries({ queryKey: keys.tasks });
        return ok;
      },
      [attempt, deleteCalAsync, qc],
    ),
  };
}
