import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { findClashes, INTERVIEW_EVENT_TYPE, nextOccurrence, scheduledMinutesByTask, type Application, type Calendar, type Course, type EventType, type Semester, type TimeBlock, type CalendarColor, type CreateTaskInput, type Task, type UpdateCalendarInput, type UpdateTaskInput } from '@todo/shared';
import { DeleteFilesDialog, useFileDeletionPrompt } from '../features/attachments/DeleteFilesDialog';
import { newEventSpan } from '../features/calendar/calendarModel';
import { ScopeDialog } from '../features/calendar/ScopeDialog';
import { ApplicationDialog } from '../features/applications/ApplicationDialog';
import { InterviewDialog } from '../features/applications/InterviewDialog';
import { ScheduleDialog } from '../features/calendar/ScheduleDialog';
import { CalendarDialog } from '../features/calendar/CalendarDialog';
import { CourseDialog } from '../features/courses/CourseDialog';
import { SemesterDialog } from '../features/courses/SemesterDialog';
import { EventDialog } from '../features/events/EventDialog';
import { SettingsDialog } from '../features/settings/SettingsDialog';
import { ShortcutsDialog } from '../features/settings/ShortcutsDialog';
import { ImportLayer } from '../features/import/ImportLayer';
import { ImportReview } from '../features/import/ImportReview';
import { useImportSession } from '../features/import/useImportSession';
import { TaskDialog } from '../features/tasks/TaskDialog';
import { usePersistedState } from '../hooks/usePersistedState';
import { useTodoData } from '../data/useTodoData';
import { useToday } from '../hooks/useToday';
import { formatDueDate } from '../lib/dates';
import { computeMove } from '../lib/ordering';
import { ToastHost, useToast } from '../ui/Toast';
import { AppContext, type AppApi, type DialogState, type ImportOptions } from './AppContext';
import { applicationHooks } from '../data/useApplications';
import { timeBlockHooks } from '../data/useTimeBlocks';
import { courseHooks, semesterHooks } from '../data/useCourses';
import { useApplicationActions } from '../actions/useApplicationActions';
import { useCourseActions } from '../actions/useCourseActions';
import { useTimeBlockActions } from '../actions/useTimeBlockActions';
import { useEventActions, type EventActions } from '../actions/useEventActions';

/** Holds everything the screens share: the data, the actions that change it, the open dialog, and the toast. */
export function AppProvider({ children }: { children: ReactNode }) {
  const data = useTodoData();
  const { tasks, calendars, updateTask, deleteTask, restoreTask, reorderAll } = data;
  const today = useToday();
  const { toast, show: showToast, dismiss: dismissToast } = useToast();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const { confirmFiles, dialog: fileDialog } = useFileDeletionPrompt();
  const { events: allEvents, eventTypes, eventsLoading, scopeDialog, actions: eventActions } = useEventActions(showToast, confirmFiles);
  const coursesQuery = courseHooks.useList();
  const semestersQuery = semesterHooks.useList();
  const courses: Course[] = coursesQuery.data ?? NO_COURSES;
  const semesters: Semester[] = semestersQuery.data ?? NO_SEMESTERS;
  const applicationsQuery = applicationHooks.useList();
  const applications: Application[] = applicationsQuery.data ?? NO_APPLICATIONS;
  const timeBlocksQuery = timeBlockHooks.useList();

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

  // Archiving a semester hides its courses' class meetings everywhere (calendar, Today, conflicts), without deleting them.
  const coursesById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const events = useMemo(() => {
    const archivedSemesters = new Set(semesters.filter((s) => s.archived).map((s) => s.id));
    if (archivedSemesters.size === 0) return allEvents;
    const archivedCourses = new Set(courses.filter((c) => archivedSemesters.has(c.semesterId)).map((c) => c.id));
    return allEvents.filter((e) => !e.courseId || !archivedCourses.has(e.courseId));
  }, [allEvents, courses, semesters]);
  const courseActions = useCourseActions({ showToast, confirmFiles, applyEventPlan: eventActions.applyEventPlan, eventTypes, tasks, updateTask });
  const applicationActions = useApplicationActions({
    showToast,
    confirmFiles,
    applyEventPlan: eventActions.applyEventPlan,
    calendars,
    today,
    addTasks,
    updateTask,
    deleteTask,
    restoreTask,
  });
  const applicationsById = useMemo(() => new Map(applications.map((a) => [a.id, a])), [applications]);

  // Time blocks belong to a to-do.
  const timeBlockActions = useTimeBlockActions({ showToast });
  const timeBlocks = useMemo<TimeBlock[]>(() => {
    const live = new Set(tasks.map((t) => t.id));
    return (timeBlocksQuery.data ?? NO_BLOCKS).filter((b) => live.has(b.taskId));
  }, [timeBlocksQuery.data, tasks]);
  const scheduledMinutesByTaskMap = useMemo(() => scheduledMinutesByTask(timeBlocks), [timeBlocks]);

  // A new Interview event raises a question (which application? add the prep checklist?), however it was made: the form, a drag on the calendar, or an import.
  const interviewTypeId = useMemo(() => eventTypes.find((t) => t.name.toLowerCase() === INTERVIEW_EVENT_TYPE.toLowerCase())?.id ?? null, [eventTypes]);
  const offerInterviewLink = useCallback((ids: string[]) => {
    if (ids.length > 0) setDialog({ kind: 'interview', eventIds: ids });
  }, []);
  const { createEvent: createEventBase, createEvents: createEventsBase } = eventActions;
  const createEvent = useCallback<EventActions['createEvent']>(
    async (input, options) => {
      const id = input.id ?? crypto.randomUUID();
      const saved = await createEventBase({ ...input, id }, options);
      if (saved && interviewTypeId && input.typeId === interviewTypeId) offerInterviewLink([id]);
      return saved;
    },
    [createEventBase, interviewTypeId, offerInterviewLink],
  );
  const createEvents = useCallback<EventActions['createEvents']>(
    async (inputs) => {
      const withIds = inputs.map((i) => ({ ...i, id: i.id ?? crypto.randomUUID() }));
      const result = await createEventsBase(withIds);
      if (result && interviewTypeId) offerInterviewLink(withIds.filter((i) => i.typeId === interviewTypeId).map((i) => i.id));
      return result;
    },
    [createEventsBase, interviewTypeId, offerInterviewLink],
  );

  // Finding events in files: the session, and the small pieces (drop, paste, picker) that start it.
  const importer = useImportSession({ eventTypes, events, tasks, courses, createEvents, addTasks, showToast });
  // What the next file pick should start out as (set by e.g. a course page's "Import syllabus"; drops and pastes never use it).
  const nextPickOptions = useRef<ImportOptions | undefined>(undefined);
  const openPicker = useRef<() => void>(() => undefined);
  const registerPicker = useCallback((open: () => void) => {
    openPicker.current = open;
  }, []);

  const clashesFor = useCallback<AppApi['clashesFor']>(
    (span, ignore) => findClashes({ events, blocks: timeBlocks, titleOf: (id) => tasks.find((t) => t.id === id)?.title }, span, ignore),
    [events, timeBlocks, tasks],
  );

  const eventTypesById = useMemo(() => new Map<string, EventType>(eventTypes.map((t) => [t.id, t])), [eventTypes]);

  const value: AppApi = {
    ...eventActions,
    createEvent,
    createEvents,
    ...courseActions,
    ...applicationActions,
    ...timeBlockActions,
    timeBlocks,
    scheduledMinutesByTask: scheduledMinutesByTaskMap,
    clashesFor,
    applications,
    applicationsById,
    applicationsLoading: applicationsQuery.isPending,
    courses,
    semesters,
    coursesById,
    coursesLoading: coursesQuery.isPending || semestersQuery.isPending,
    events,
    eventTypes,
    eventTypesById,
    eventsLoading,
    hiddenCalendarIds,
    toggleCalendarHidden,
    rescheduleTask,
    addTasks,
    startImport: importer.start,
    chooseFilesToImport: (options) => {
      nextPickOptions.current = options;
      openPicker.current();
    },
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
        <CourseDialog />
        <SemesterDialog />
        <ApplicationDialog />
        <InterviewDialog />
        <ScheduleDialog />
        <ScopeDialog {...scopeDialog} />
        <DeleteFilesDialog {...fileDialog} />
        <ImportLayer
          onFiles={(files, source) => importer.start(files, source === 'picker' ? nextPickOptions.current : undefined)}
          registerPicker={registerPicker}
          busy={importer.session !== null}
        />
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

const NO_COURSES: Course[] = [];
const NO_SEMESTERS: Semester[] = [];
const NO_APPLICATIONS: Application[] = [];
const NO_BLOCKS: TimeBlock[] = [];
