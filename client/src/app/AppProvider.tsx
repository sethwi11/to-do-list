import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { nextOccurrence, type Calendar, type EventType, type CalendarColor, type CreateTaskInput, type Task, type UpdateCalendarInput, type UpdateTaskInput } from '@todo/shared';
import { DeleteFilesDialog, useFileDeletionPrompt } from '../features/attachments/DeleteFilesDialog';
import { newEventSpan } from '../features/calendar/calendarModel';
import { ScopeDialog } from '../features/calendar/ScopeDialog';
import { CalendarDialog } from '../features/calendars/CalendarDialog';
import { EventDialog } from '../features/events/EventDialog';
import { SettingsDialog } from '../features/settings/SettingsDialog';
import { ShortcutsDialog } from '../features/settings/ShortcutsDialog';
import { ImportLayer } from '../features/import/ImportLayer';
import { ImportReview } from '../features/import/ImportReview';
import { useImportSession } from '../features/import/useImportSession';
import { TaskDialog } from '../features/tasks/TaskDialog';
import { usePersistedState } from '../hooks/usePersistedState';
import { useTodoData } from '../hooks/useTodoData';
import { useToday } from '../hooks/useToday';
import { formatDueDate } from '../lib/dates';
import { computeMove } from '../lib/ordering';
import { ToastHost, useToast } from '../ui/Toast';
import { AppContext, type AppApi, type DialogState } from './AppContext';
import { useEventActions } from './useEventActions';

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
  const { confirmFiles, dialog: fileDialog } = useFileDeletionPrompt();
  const { events, eventTypes, eventsLoading, scopeDialog, actions: eventActions } = useEventActions(showToast, confirmFiles);

  // Which calendars show on the calendar page. Remembered per device, so hiding "Work" on the laptop doesn't hide it on the phone.
  const [hiddenIds, setHiddenIds] = usePersistedState<string[]>('voice-todo.calendar.hidden', [], isStringArray);
  const hiddenCalendarIds = useMemo(() => new Set(hiddenIds), [hiddenIds]);
  const toggleCalendarHidden = useCallback(
    (id: string) => setHiddenIds(hiddenIds.includes(id) ? hiddenIds.filter((x) => x !== id) : [...hiddenIds, id]),
    [hiddenIds, setHiddenIds],
  );

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
      // Files only this to-do uses can go with it, if the person says so (once Undo is no longer possible).
      const files = await confirmFiles([{ ownerType: 'task', ownerId: task.id }], task.title);
      if (!files.proceed) return;
      if (await deleteTask(task.id)) showToast(`Deleted “${task.title}”`, () => void restoreTask(task.id), files.commit);
    },
    [confirmFiles, deleteTask, restoreTask, showToast],
  );

  const addTasks = useCallback(
    async (inputs: CreateTaskInput[]) => {
      const ids: string[] = [];
      for (const input of inputs) {
        const task = await data.createTask({ ...input, id: input.id ?? crypto.randomUUID() });
        if (task) ids.push(task.id);
      }
      return {
        ids,
        undo: async () => {
          for (const id of ids) await deleteTask(id);
        },
      };
    },
    [data, deleteTask],
  );

  const moveTask = useCallback(
    (movedId: string, before: Task | undefined, after: Task | undefined) => {
      const result = computeMove(tasks, movedId, before, after);
      if (result.kind === 'single') void updateTask(movedId, { sortOrder: result.sortOrder });
      else void reorderAll(result.orderedIds);
    },
    [tasks, updateTask, reorderAll],
  );

  const rescheduleTask = useCallback(
    async (task: Task, when: { dueDate: string; dueTime: string | null }) => {
      const previous = { dueDate: task.dueDate, dueTime: task.dueTime };
      if (!(await updateTask(task.id, when))) return false;
      showToast(`Moved “${task.title}” to ${formatDueDate(when.dueDate, today)}`, () => void updateTask(task.id, previous));
      return true;
    },
    [updateTask, showToast, today],
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

  // Finding events in files: the session, and the small pieces (drop, paste, picker) that start it.
  const importer = useImportSession({ eventTypes, events, tasks, createEvents: eventActions.createEvents, addTasks, showToast });
  const openPicker = useRef<() => void>(() => undefined);
  const registerPicker = useCallback((open: () => void) => {
    openPicker.current = open;
  }, []);

  const eventTypesById = useMemo(() => new Map<string, EventType>(eventTypes.map((t) => [t.id, t])), [eventTypes]);

  const value: AppApi = {
    ...eventActions,
    events,
    eventTypes,
    eventTypesById,
    eventsLoading,
    hiddenCalendarIds,
    toggleCalendarHidden,
    rescheduleTask,
    addTasks,
    startImport: importer.start,
    chooseFilesToImport: () => openPicker.current(),
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
        <EventDialog />
        <ScopeDialog {...scopeDialog} />
        <DeleteFilesDialog {...fileDialog} />
        <ImportLayer onFiles={importer.start} registerPicker={registerPicker} busy={importer.session !== null} />
        <ImportReview
          importer={importer}
          onManual={(files) => {
            importer.cancel();
            // Nothing was found to fill in, so open a blank event with the file already attached.
            setDialog({ kind: 'event', mode: 'new', defaults: { ...newEventSpan(null, new Date()), files } });
          }}
        />
        <CalendarDialog />
        <SettingsDialog />
        <ShortcutsDialog />
        <ToastHost toast={toast} onDismiss={dismissToast} />
      </div>
    </AppContext.Provider>
  );
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
