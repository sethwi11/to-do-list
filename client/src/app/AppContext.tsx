import { createContext, useContext } from 'react';
import type { Calendar, CalendarColor, Course, CreateTaskInput, Event, EventOccurrence, EventType, Semester, Task, UpdateCalendarInput, UpdateTaskInput } from '@todo/shared';
import type { CourseActions } from './useCourseActions';
import type { EventActions } from './useEventActions';

/** Starting values for a new task, e.g. "due today" when added from the Today page. */
export type TaskDefaults = Partial<Pick<CreateTaskInput, 'dueDate' | 'calendarId' | 'priority'>>;

/** Starting values for a new event (e.g. the time range a person dragged out on the calendar). `end` is exclusive for an all-day event. */
export interface EventDefaults {
  start: string;
  end: string;
  allDay?: boolean;
  calendarId?: string | null;
  title?: string;
  /** Files to attach once the event is saved (e.g. the file an import found nothing in). */
  files?: File[];
}

/** What an import should start out as, e.g. from a course page: "this is a syllabus, for this course". */
export interface ImportOptions {
  syllabus?: boolean;
  courseId?: string;
}

/** Which dialog is open. Only one at a time, so the whole app shares one slot. */
export type DialogState =
  | { kind: 'task'; mode: 'new'; defaults: TaskDefaults }
  | { kind: 'task'; mode: 'edit'; id: string }
  | { kind: 'event'; mode: 'new'; defaults: EventDefaults }
  | { kind: 'event'; mode: 'edit'; occurrence: EventOccurrence }
  | { kind: 'semester'; id: string | 'new' }
  | { kind: 'course'; id: string | 'new'; semesterId?: string }
  | { kind: 'calendar'; id: string | 'new' }
  | { kind: 'settings' }
  | { kind: 'shortcuts' };

export interface AppApi extends EventActions, CourseActions {
  // ---- data ----
  tasks: Task[];
  calendars: Calendar[];
  calendarsById: Map<string, Calendar>;
  loading: boolean;
  error: string | null;
  dismissError: () => void;
  reload: () => Promise<void>;
  /** Today's local date, which rolls over at midnight. */
  today: string;

  courses: Course[];
  semesters: Semester[];
  coursesById: Map<string, Course>;
  coursesLoading: boolean;
  /** Events, except the class meetings of archived semesters (archiving hides them everywhere). */
  events: Event[];
  eventTypes: EventType[];
  eventTypesById: Map<string, EventType>;
  eventsLoading: boolean;

  // ---- which calendars show on the calendar page (a per-device preference) ----
  hiddenCalendarIds: ReadonlySet<string>;
  toggleCalendarHidden: (id: string) => void;

  // ---- task actions (the ones that show an Undo toast do so themselves) ----
  addTask: (input: CreateTaskInput) => Promise<Task | null>;
  toggleTask: (task: Task) => Promise<void>;
  /** Save changes with no toast (used by the edit dialog, which has its own Save button). */
  saveTask: (id: string, changes: UpdateTaskInput) => Promise<Task | null>;
  removeTask: (task: Task) => Promise<void>;
  moveTask: (movedId: string, before: Task | undefined, after: Task | undefined) => void;
  /** Add several to-dos at once with no toast of their own. Resolves to their ids and a way to undo. */
  addTasks: (inputs: CreateTaskInput[]) => Promise<{ ids: string[]; undo: () => Promise<void> }>;
  /** Find events in these files (pictures, PDFs, Word, text, calendar files) and open the review. */
  startImport: (files: File[], options?: ImportOptions) => void;
  /** Open the file picker for the same. */
  chooseFilesToImport: (options?: ImportOptions) => void;
  /** Change a task's due date (and time), e.g. by dragging it on the calendar. Shows an Undo toast. */
  rescheduleTask: (task: Task, when: { dueDate: string; dueTime: string | null }) => Promise<boolean>;

  // ---- calendar actions ----
  createCalendar: (name: string, color: CalendarColor) => Promise<Calendar | null>;
  updateCalendar: (id: string, changes: UpdateCalendarInput) => Promise<boolean>;
  removeCalendar: (id: string) => Promise<boolean>;

  // ---- dialogs and toasts ----
  dialog: DialogState | null;
  openDialog: (dialog: DialogState) => void;
  /** Close the open dialog. Pass its kind so a dialog that is closing doesn't also close the next one that just opened. */
  closeDialog: (kind?: DialogState['kind']) => void;
  /** `onCommit` runs when the undo window closes without Undo (for permanent follow-ups, like deleting files). */
  showToast: (message: string, onUndo?: () => void, onCommit?: () => void) => void;
  /** Run the current toast's Undo, if it has one. Returns whether it did. */
  undoLast: () => boolean;
}

export const AppContext = createContext<AppApi | null>(null);

export function useApp(): AppApi {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
