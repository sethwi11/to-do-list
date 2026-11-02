import { useCallback, useMemo, useState } from 'react';
import { nextOccurrence, type Category, type CategoryColor, type Task, type UpdateTaskInput } from '@todo/shared';
import { AddTaskForm } from './components/AddTaskForm';
import { AppShell } from './components/AppShell';
import { EmptyState } from './components/EmptyState';
import { FilterBar } from './components/FilterBar';
import { Sidebar } from './components/Sidebar';
import { TaskList } from './components/TaskList';
import { UndoToast, useToast } from './components/UndoToast';
import { useTodoData } from './hooks/useTodoData';
import { formatDueDate, todayLocalISO } from './lib/dates';
import { applyFilters, DEFAULT_FILTERS, isFiltering, sortByCompletedDesc, sortTasks, type Filters, type SortMode } from './lib/filters';
import { computeMove } from './lib/ordering';
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

export default function App() {
  const data = useTodoData();
  const { tasks, categories, updateTask, deleteTask, restoreTask, reorderAll } = data;
  const [view, setView] = useState<View>({ type: 'smart', id: 'today' });
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sortMode, setSortMode] = useState<SortMode>(loadSortMode);
  const { toast, show: showToast, dismiss: dismissToast } = useToast();

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
          />
        }
        main={
          <div className="flex flex-col gap-4">
            <header>
              <h1 className="text-2xl font-semibold">{viewTitle(view, categories)}</h1>
              <p className="text-sm text-slate-500">
                {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </header>

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
                onCreate={data.createTask}
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
          <section className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">
            <h2 className="font-medium text-slate-700 dark:text-slate-300">Voice &amp; Review</h2>
            <p className="mt-1">Brain dump, the mic button, and the review queue will live here (Phases 3–5).</p>
          </section>
        }
      />
      <UndoToast toast={toast} onDismiss={dismissToast} />
    </>
  );
}
