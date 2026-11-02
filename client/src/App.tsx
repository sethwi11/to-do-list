import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nextOccurrence, type Category, type CategoryColor, type QueryRange, type Task, type UpdateTaskInput } from '@todo/shared';
import { aiApi } from './api/ai';
import { AddTaskForm } from './components/AddTaskForm';
import { AppShell } from './components/AppShell';
import { EmptyState } from './components/EmptyState';
import { FilterBar } from './components/FilterBar';
import { MorningBrief } from './components/MorningBrief';
import { PlanDialog } from './components/PlanDialog';
import { ReviewPanel } from './components/ReviewPanel';
import { SettingsDialog } from './components/SettingsDialog';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { Sidebar } from './components/Sidebar';
import { StatsCard } from './components/StatsCard';
import { TaskList } from './components/TaskList';
import { UndoToast, useToast } from './components/UndoToast';
import { MicLiveBadge, VoicePanel } from './components/VoicePanel';
import { useAssistant } from './hooks/useAssistant';
import { useDueNotifications } from './hooks/useDueNotifications';
import { usePlanMyDay } from './hooks/usePlanMyDay';
import { useSettings } from './hooks/useSettings';
import { useShortcuts } from './hooks/useShortcuts';
import { useTheme } from './hooks/useTheme';
import { useTodoData } from './hooks/useTodoData';
import { useVoice } from './hooks/useVoice';
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
  const { tasks, categories, updateTask, deleteTask, restoreTask, reorderAll } = data;
  const [view, setView] = useState<View>({ type: 'smart', id: 'today' });
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sortMode, setSortMode] = useState<SortMode>(loadSortMode);
  const { toast, show: showToast, dismiss: dismissToast } = useToast();
  const { settings, update: updateSettings } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  useTheme(settings.theme);

  // Recomputed each render, so the app rolls over to the new day if left open past midnight.
  const today = todayLocalISO();

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

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
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const [showBrief, setShowBrief] = useState(() => !briefSeenToday(today));

  useEffect(() => {
    aiApi.status().then(
      (s) => setAiConfigured(s.configured),
      () => setAiConfigured(null),
    );
  }, []);

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

  // ---- list (category) actions -------------------------------------------

  const handleCreateCategory = async (name: string, color: CategoryColor) => {
    const created = await data.createCategory({ name, color });
    if (created) setView({ type: 'category', id: created.id });
    return created !== null;
  };

  const handleUpdateCategory = (id: string, name: string, color: CategoryColor) =>
    data.updateCategory(id, { name, color });

  const handleDeleteCategory = async (category: Category) => {
    const count = tasks.filter((t) => t.categoryId === category.id).length;
    const detail = count > 0 ? ` Its ${count} task${count === 1 ? '' : 's'} will be kept, without a list.` : '';
    // A native confirm dialog is accessible and adequate here; deleting a list is rare.
    if (!window.confirm(`Delete the list "${category.name}"?${detail}`)) return;
    if (await data.deleteCategory(category.id)) {
      if (view.type === 'category' && view.id === category.id) setView({ type: 'smart', id: 'all' });
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

  // ---- voice + AI ------------------------------------------------------------

  /** A voice query ("what do I have tomorrow?") switches the list to show the answer. */
  function showQuery(range: QueryRange) {
    if (range === 'tomorrow') {
      setView({ type: 'smart', id: 'upcoming' });
      setFilters({ ...DEFAULT_FILTERS, due: 'tomorrow' });
    } else {
      selectView({ type: 'smart', id: range === 'upcoming' ? 'upcoming' : range === 'overdue' ? 'overdue' : range === 'all' ? 'all' : 'today' });
    }
  }

  // The assistant speaks through the voice layer (which pauses the mic while
  // talking), and the voice layer sends transcripts to the assistant. A ref
  // breaks that circular dependency between the two hooks.
  const sayRef = useRef<(text: string) => Promise<void>>(async () => {});
  const assistant = useAssistant({
    tasks,
    categories,
    settings,
    createTask: data.createTask,
    updateTask,
    deleteTask,
    onQuery: showQuery,
    speak: (text) => sayRef.current(text),
    showToast,
  });
  const voice = useVoice(assistant.process);
  sayRef.current = voice.say;

  const planner = usePlanMyDay({
    tasks,
    today,
    updateTask,
    speak: settings.tts ? voice.say : null,
    showToast,
  });

  function dismissBrief() {
    setShowBrief(false);
    try {
      localStorage.setItem(BRIEF_KEY, today);
    } catch {
      /* ignore */
    }
  }

  const pttEnabled = voice.supported && settings.voiceMode === 'push-to-talk';
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
    pttDown: pttEnabled ? voice.startHold : undefined,
    pttUp: pttEnabled ? voice.endHold : undefined,
  });

  return (
    <>
      <AppShell
        sidebar={
          <Sidebar
            view={view}
            onSelect={selectView}
            countFor={countFor}
            categories={categories}
            onCreateCategory={handleCreateCategory}
            onUpdateCategory={handleUpdateCategory}
            onDeleteCategory={handleDeleteCategory}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        }
        main={
          <div className="flex flex-col gap-4">
            <header className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h1 className="text-2xl font-semibold">{viewTitle(view, categories)}</h1>
                <p className="text-sm text-slate-500">
                  {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>
              {view.type === 'smart' && view.id === 'today' && (
                <button
                  type="button"
                  onClick={() => void planner.start()}
                  className="rounded-lg border border-indigo-200 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
                >
                  ✨ Plan my day
                </button>
              )}
            </header>

            {showBrief && !data.loading && (
              <MorningBrief
                tasks={tasks}
                today={today}
                onDismiss={dismissBrief}
                onPlan={() => {
                  dismissBrief();
                  void planner.start();
                }}
              />
            )}

            {data.error && (
              <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                <span>{data.error}</span>
                <span className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => void data.reload()} className="font-medium underline">
                    Retry
                  </button>
                  <button type="button" onClick={data.dismissError} aria-label="Dismiss error" className="font-medium">
                    ✕
                  </button>
                </span>
              </div>
            )}

            {!isCompletedView && (
              <AddTaskForm
                categories={categories}
                defaultDueDate={defaultDueDateFor(view, today)}
                defaultCategoryId={view.type === 'category' ? view.id : null}
                onCreate={async (input) => (await data.createTask(input)) !== null}
              />
            )}

            <FilterBar
              filters={filters}
              onChange={setFilters}
              sortMode={sortMode}
              onSortChange={handleSortChange}
              categories={categories}
              hideCategory={view.type === 'category'}
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
                categoriesById={categoriesById}
                categories={categories}
                today={today}
                onToggle={(t) => void handleToggle(t)}
                onUpdate={handleUpdate}
                onDelete={(t) => void handleDelete(t)}
                onMove={handleMove}
              />
            )}
          </div>
        }
        panel={
          <div className="flex flex-col gap-4">
            {aiConfigured === false && (
              <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                AI isn't set up yet. Add your <code>ANTHROPIC_API_KEY</code> to the <code>.env</code> file in the project root and restart{' '}
                <code>npm run dev</code>. The rest of the app works without it.
              </p>
            )}
            <VoicePanel
              settings={settings}
              onSettingsChange={updateSettings}
              voice={voice}
              busy={assistant.busy}
              aiError={assistant.error}
              onDismissAiError={assistant.dismissError}
              reply={assistant.reply}
              onBrainDump={(text) => assistant.process(text, 'brain-dump')}
            />
            <ReviewPanel
              items={assistant.items}
              categories={categories}
              today={today}
              autoAccept={settings.autoAccept}
              onAutoAcceptChange={(on) => updateSettings({ autoAccept: on })}
              onAccept={(id) => void assistant.accept(id)}
              onReject={assistant.reject}
              onAcceptAll={() => void assistant.acceptAll()}
              onClear={assistant.clearAll}
              onToggle={assistant.toggleChecked}
              onEdit={assistant.updateTaskDraft}
            />
            <StatsCard stats={stats} />
          </div>
        }
      />
      <MicLiveBadge live={voice.listening || voice.conversationOn} />
      <UndoToast toast={toast} onDismiss={dismissToast} />
      <PlanDialog
        open={planner.open}
        onClose={planner.close}
        loading={planner.loading}
        error={planner.error}
        plan={planner.plan}
        tasksById={tasksById}
        onAccept={() => void planner.accept()}
      />
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
