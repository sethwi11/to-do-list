import { createContext, useContext } from 'react';
import type { Calendar, CalendarColor, CreateTaskInput, Task, UpdateCalendarInput, UpdateTaskInput } from '@todo/shared';

/** Starting values for a new task, e.g. "due today" when added from the Today page. */
export type TaskDefaults = Partial<Pick<CreateTaskInput, 'dueDate' | 'calendarId' | 'priority'>>;

/** Which dialog is open. Only one at a time, so the whole app shares one slot. */
export type DialogState =
  | { kind: 'task'; mode: 'new'; defaults: TaskDefaults }
  | { kind: 'task'; mode: 'edit'; id: string }
  | { kind: 'calendar'; id: string | 'new' }
  | { kind: 'settings' }
  | { kind: 'shortcuts' };

export interface AppApi {
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

  // ---- task actions (the ones that show an Undo toast do so themselves) ----
  addTask: (input: CreateTaskInput) => Promise<Task | null>;
  toggleTask: (task: Task) => Promise<void>;
  /** Save changes with no toast (used by the edit dialog, which has its own Save button). */
  saveTask: (id: string, changes: UpdateTaskInput) => Promise<Task | null>;
  removeTask: (task: Task) => Promise<void>;
  moveTask: (movedId: string, before: Task | undefined, after: Task | undefined) => void;

  // ---- calendar actions ----
  createCalendar: (name: string, color: CalendarColor) => Promise<Calendar | null>;
  updateCalendar: (id: string, changes: UpdateCalendarInput) => Promise<boolean>;
  removeCalendar: (id: string) => Promise<boolean>;

  // ---- dialogs and toasts ----
  dialog: DialogState | null;
  openDialog: (dialog: DialogState) => void;
  /** Close the open dialog. Pass its kind so a dialog that is closing doesn't also close the next one that just opened. */
  closeDialog: (kind?: DialogState['kind']) => void;
  showToast: (message: string, onUndo?: () => void) => void;
  /** Run the current toast's Undo, if it has one. Returns whether it did. */
  undoLast: () => boolean;
}

export const AppContext = createContext<AppApi | null>(null);

export function useApp(): AppApi {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
