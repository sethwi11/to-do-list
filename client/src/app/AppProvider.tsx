import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { nextOccurrence, type Calendar, type CalendarColor, type CreateTaskInput, type Task, type UpdateCalendarInput, type UpdateTaskInput } from '@todo/shared';
import { CalendarDialog } from '../features/calendars/CalendarDialog';
import { SettingsDialog } from '../features/settings/SettingsDialog';
import { ShortcutsDialog } from '../features/settings/ShortcutsDialog';
import { TaskDialog } from '../features/tasks/TaskDialog';
import { useTodoData } from '../hooks/useTodoData';
import { useToday } from '../hooks/useToday';
import { formatDueDate } from '../lib/dates';
import { computeMove } from '../lib/ordering';
import { ToastHost, useToast } from '../ui/Toast';
import { AppContext, type AppApi, type DialogState } from './AppContext';

/**
 * Holds everything the screens share: the data, the actions that change it, the open dialog,
 * and the toast. Screens read it with useApp() instead of passing props down through
 * the layout. The dialogs and toast are rendered here so any screen can open them.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  const data = useTodoData();
  const { tasks, calendars, updateTask, deleteTask, restoreTask, reorderAll } = data;
  const today = useToday();
  const { toast, show: showToast, dismiss: dismissToast } = useToast();
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const calendarsById = useMemo(() => new Map<string, Calendar>(calendars.map((c) => [c.id, c])), [calendars]);

  const addTask = useCallback(
    async (input: CreateTaskInput) => {
      const task = await data.createTask(input);
      if (task) showToast(`Added “${task.title}”`, () => void deleteTask(task.id));
      return task;
    },
    [data, showToast, deleteTask],
  );

  const toggleTask = useCallback(
    async (task: Task) => {
      if (task.status === 'done') {
        await updateTask(task.id, { status: 'todo' });
        return;
      }
      const saved = await updateTask(task.id, { status: 'done' });
      if (!saved) return;

      let message = `Completed “${task.title}”`;
      // The same shared function the server used to schedule it, so the date matches.
      const nextDue = nextOccurrence(task.dueDate, task.recurrence, today);
      if (saved.nextOccurrenceId && nextDue) message += `. Next: ${formatDueDate(nextDue, today)}`;
      // Undo = reopen; the server also removes the occurrence it just created.
      showToast(message, () => void updateTask(task.id, { status: 'todo' }));
    },
    [updateTask, showToast, today],
  );

  const saveTask = useCallback((id: string, changes: UpdateTaskInput) => updateTask(id, changes), [updateTask]);

  const removeTask = useCallback(
    async (task: Task) => {
      if (await deleteTask(task.id)) showToast(`Deleted “${task.title}”`, () => void restoreTask(task.id));
    },
    [deleteTask, restoreTask, showToast],
  );

  const moveTask = useCallback(
    (movedId: string, before: Task | undefined, after: Task | undefined) => {
      const result = computeMove(tasks, movedId, before, after);
      if (result.kind === 'single') void updateTask(movedId, { sortOrder: result.sortOrder });
      else void reorderAll(result.orderedIds);
    },
    [tasks, updateTask, reorderAll],
  );

  const createCalendar = useCallback((name: string, color: CalendarColor) => data.createCalendar({ name, color }), [data]);
  const updateCalendar = useCallback((id: string, changes: UpdateCalendarInput) => data.updateCalendar(id, changes), [data]);

  const openDialog = useCallback((next: DialogState) => setDialog(next), []);
  const closeDialog = useCallback((kind?: DialogState['kind']) => setDialog((cur) => (kind && cur?.kind !== kind ? cur : null)), []);

  const undoLast = useCallback(() => {
    if (!toast?.onUndo) return false;
    toast.onUndo();
    dismissToast();
    return true;
  }, [toast, dismissToast]);

  const value: AppApi = {
    tasks,
    calendars,
    calendarsById,
    loading: data.loading,
    error: data.error,
    dismissError: data.dismissError,
    reload: data.reload,
    today,
    addTask,
    toggleTask,
    saveTask,
    removeTask,
    moveTask,
    createCalendar,
    updateCalendar,
    removeCalendar: data.deleteCalendar,
    dialog,
    openDialog,
    closeDialog,
    showToast,
    undoLast,
  };

  return (
    <AppContext.Provider value={value}>
      {/* Dialogs and the toast sit inside the same .paper-page wrapper as the pages, so they get the same base styles. */}
      <div className="paper-page">
        {children}
        <TaskDialog />
        <CalendarDialog />
        <SettingsDialog />
        <ShortcutsDialog />
        <ToastHost toast={toast} onDismiss={dismissToast} />
      </div>
    </AppContext.Provider>
  );
}
