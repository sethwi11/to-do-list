import { useCallback, useMemo, useState } from 'react';
import { CircleAlert, RotateCw, X } from 'lucide-react';
import { nextOccurrence, type Calendar, type CalendarColor, type Task, type UpdateTaskInput } from '@todo/shared';
import { AddTaskForm } from './components/AddTaskForm';
import { AppShell } from './components/AppShell';
import { EmptyState } from './components/EmptyState';
import { FilterBar } from './components/FilterBar';
import { MorningBrief } from './components/MorningBrief';
import { SettingsDialog } from './components/SettingsDialog';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { Sidebar } from './components/Sidebar';
import { StatsCard } from './components/StatsCard';
import { TaskList } from './components/TaskList';
import { UndoToast, useToast } from './components/UndoToast';
import { useDueNotifications } from './hooks/useDueNotifications';
import { useSettings } from './hooks/useSettings';
import { useShortcuts } from './hooks/useShortcuts';
import { useTheme } from './hooks/useTheme';
import { useTodoData } from './hooks/useTodoData';
import { formatDueDate, todayLocalISO } from './lib/dates';
import { applyFilters, DEFAULT_FILTERS, isFiltering, sortByCompletedDesc, sortTasks, type Filters, type SortMode } from './lib/filters';
import { computeMove } from './lib/ordering';
import { computeStats } from './lib/stats';
import { defaultDueDateFor, inView, openCount, viewTitle, type View } from './lib/views';

// The sort choice is a per-browser preference, so localStorage is the right
// place for it (task data lives on the server). Wrapped in try/catch because
// storage can throw in private windows.
const SORT_KEY = 'voice-todo.sortMode';
function loadSortMode(): SortMode {
  try {
    const saved = localStorage.getItem(SORT_KEY);
    if (saved === 'due' || saved === 'priority' || saved === 'manual') return saved;
  } catch {
    /* ignore */
  }
  return 'due';
}

const BRIEF_KEY = 'voice-todo.lastBrief';
function briefSeenToday(today: string): boolean {
  try {
    return localStorage.getItem(BRIEF_KEY) === today;
  } catch {
    return true; // no storage: don't nag on every load
  }
}

export default function App() {
  const data = useTodoData();
  const { tasks, calendars, updateTask, deleteTask, restoreTask, reorderAll } = data;
  const [view, setView] = useState<View>({ type: 'smart', id: 'today' });
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sortMode, setSortMode] = useState<SortMode>(loadSortMode);
  const { toast, show: showToast, dismiss: dismissToast } = useToast();
  const { settings, update: updateSettings } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useTheme(settings.theme);

  // Recomputed each render, so the app rolls over to the new day if left open past midnight.
  const today = todayLocalISO();

  const calendarsById = useMemo(() => new Map(calendars.map((c) => [c.id, c])), [calendars]);

  const isCompletedView = view.type === 'smart' && view.id === 'completed';
  const isOverdueView = view.type === 'smart' && view.id === 'overdue';

  const { openTasks, doneTasks, inViewCount } = useMemo(() => {
    const base = tasks.filter((t) => inView(t, view, today));
    const filtered = applyFilters(base, filters, today);
    return {
      openTasks: sortTasks(filtered.filter((t) => t.status === 'todo'), sortMode),
      doneTasks: sortByCompletedDesc(filtered.filter((t) => t.status === 'done')),
      inViewCount: base.length,
    };
  }, [tasks, view, today, filters, sortMode]);

  const doneAsSection = !isCompletedView && filters.status === 'any';
  const draggable = sortMode === 'manual' && doneAsSection;
  const visibleCount = openTasks.length + doneTasks.length;

  const countFor = useCallback((v: View) => openCount(tasks, v, today), [tasks, today]);
  const stats = useMemo(() => computeStats(tasks, today), [tasks, today]);
  const [showBrief, setShowBrief] = useState(() => !briefSeenToday(today));

  useDueNotifications(tasks, settings.notifications);

  // ---- task actions, with undo where it matters ---------------------------

  const handleToggle = useCallback(
    async (task: Task) => {
      if (task.status === 'done') {
        await updateTask(task.id, { status: 'todo' });
        return;
      }
      const saved = await updateTask(task.id, { status: 'done' });
      if (!saved) return;

      let message = `Completed "${task.title}"`;
      // Same shared function the server used to schedule it, so the date matches.
      const nextDue = nextOccurrence(task.dueDate, task.recurrence, today);
      if (saved.nextOccurrenceId && nextDue) message += ` · next: ${formatDueDate(nextDue, today)}`;
      // Undo = reopen; the server also removes the occurrence it just created.
      showToast(message, () => void updateTask(task.id, { status: 'todo' }));
    },
    [updateTask, showToast, today],
  );

  const handleDelete = useCallback(
    async (task: Task) => {
      if (await deleteTask(task.id)) {
        showToast(`Deleted "${task.title}"`, () => void restoreTask(task.id));
      }
    },
    [deleteTask, restoreTask, showToast],
  );

  const handleUpdate = useCallback(
    (id: string, changes: UpdateTaskInput) => void updateTask(id, changes),
    [updateTask],
  );

  const handleMove = useCallback(
    (movedId: string, before: Task | undefined, after: Task | undefined) => {
      const result = computeMove(tasks, movedId, before, after);
      if (result.kind === 'single') void updateTask(movedId, { sortOrder: result.sortOrder });
      else void reorderAll(result.orderedIds);
    },
    [tasks, updateTask, reorderAll],
  );

  // ---- calendar actions -------------------------------------------

  const handleCreateCalendar = async (name: string, color: CalendarColor) => {
    const created = await data.createCalendar({ name, color });
    if (created) setView({ type: 'calendar', id: created.id });
    return created !== null;
  };

  const handleUpdateCalendar = (id: string, name: string, color: CalendarColor) =>
    data.updateCalendar(id, { name, color });

  const handleDeleteCalendar = async (calendar: Calendar) => {
    const count = tasks.filter((t) => t.calendarId === calendar.id).length;
    const detail = count > 0 ? ` Its ${count} task${count === 1 ? '' : 's'} will be kept, without a calendar.` : '';
    // A native confirm dialog is accessible and adequate here; deleting a calendar is rare.
    if (!window.confirm(`Delete the calendar "${calendar.name}"?${detail}`)) return;
    if (await data.deleteCalendar(calendar.id)) {
      if (view.type === 'calendar' && view.id === calendar.id) setView({ type: 'smart', id: 'all' });
    }
  };

  function handleSortChange(mode: SortMode) {
    setSortMode(mode);
    try {
      localStorage.setItem(SORT_KEY, mode);
    } catch {
      /* ignore */
    }
  }

  function selectView(v: View) {
    setView(v);
    setFilters(DEFAULT_FILTERS); // filters are per-visit; carrying them over is confusing
  }

  function dismissBrief() {
    setShowBrief(false);
    try {
      localStorage.setItem(BRIEF_KEY, today);
    } catch {
      /* ignore */
    }
  }

  useShortcuts({
    newTask: () => {
      if (isCompletedView) selectView({ type: 'smart', id: 'today' });
      // Wait a frame in case the form had to render first.
      requestAnimationFrame(() => document.getElementById('new-task-title')?.focus());
    },
    search: () => document.getElementById('task-search')?.focus(),
    undo: () => {
      if (toast?.onUndo) {
        toast.onUndo();
        dismissToast();
      }
    },
    showHelp: () => setShortcutsOpen(true),
  });

  return (
    <>
      <AppShell
        sidebar={
          <Sidebar
            view={view}
            onSelect={selectView}
            countFor={countFor}
            calendars={calendars}
            onCreateCalendar={handleCreateCalendar}
            onUpdateCalendar={handleUpdateCalendar}
            onDeleteCalendar={handleDeleteCalendar}
            onOpenSettings={() => setSettingsOpen(true)}
            stats={stats}
          />
        }
        main={
          <div className="flex flex-col gap-4">
            <header className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold tracking-tight">{viewTitle(view, calendars)}</h1>
                <p className="text-sm text-slate-500">
                  {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </header>

            {showBrief && !data.loading && (
              <MorningBrief tasks={tasks} today={today} onDismiss={dismissBrief} />
            )}

            {data.error && (
              <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
                <CircleAlert className="h-4 w-4 shrink-0" aria-hidden />
                <span className="flex-1">{data.error}</span>
                <button type="button" onClick={() => void data.reload()} className="pill text-red-800 hover:bg-red-100 dark:text-red-200 dark:hover:bg-red-900">
                  <RotateCw className="h-3.5 w-3.5" aria-hidden /> Retry
                </button>
                <button type="button" onClick={data.dismissError} aria-label="Dismiss error" className="icon-btn h-7 w-7 text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            )}

            {!isCompletedView && (
              <AddTaskForm
                calendars={calendars}
                today={today}
                defaultDueDate={defaultDueDateFor(view, today)}
                defaultCalendarId={view.type === 'calendar' ? view.id : null}
                onCreate={async (input) => (await data.createTask(input)) !== null}
              />
            )}

            <FilterBar
              filters={filters}
              onChange={setFilters}
              sortMode={sortMode}
              onSortChange={handleSortChange}
              calendars={calendars}
              hideCalendar={view.type === 'calendar'}
              hideStatus={isCompletedView || isOverdueView}
            />

            {data.loading ? (
              <p className="py-8 text-center text-sm text-slate-500" aria-live="polite">
                Loading tasks…
              </p>
            ) : visibleCount === 0 ? (
              <EmptyState
                view={view}
                filtered={isFiltering(filters) && inViewCount > 0}
                onClearFilters={() => setFilters(DEFAULT_FILTERS)}
              />
            ) : (
              <TaskList
                openTasks={openTasks}
                doneTasks={doneTasks}
                doneAsSection={doneAsSection}
                draggable={draggable}
                calendarsById={calendarsById}
                calendars={calendars}
                today={today}
                onToggle={(t) => void handleToggle(t)}
                onUpdate={handleUpdate}
                onDelete={(t) => void handleDelete(t)}
                onMove={handleMove}
              />
            )}

            {/* On phones the sidebar is a compact row, so stats live down here instead. */}
            <div className="card py-4 md:hidden">
              <StatsCard stats={stats} />
            </div>
          </div>
        }
      />
      <UndoToast toast={toast} onDismiss={dismissToast} />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={updateSettings}
        onImported={() => void data.reload()}
        onShowShortcuts={() => {
          setSettingsOpen(false);
          setShortcutsOpen(true);
        }}
      />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}
