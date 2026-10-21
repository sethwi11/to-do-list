import { useMemo, useState } from 'react';
import { AddTaskForm } from './components/AddTaskForm';
import { AppShell } from './components/AppShell';
import { EmptyState } from './components/EmptyState';
import { Sidebar } from './components/Sidebar';
import { TaskList } from './components/TaskList';
import { useTasks } from './hooks/useTasks';
import { todayLocalISO } from './lib/dates';
import { filterForView, sortTasks, VIEWS, type ViewId } from './lib/taskViews';

export default function App() {
  const { tasks, categories, loading, error, dismissError, reload, createTask, updateTask, deleteTask } = useTasks();
  const [view, setView] = useState<ViewId>('today');

  // Recomputed each render, so the app rolls over to the new day if left open past midnight.
  const today = todayLocalISO();

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const visible = useMemo(() => sortTasks(filterForView(tasks, view, today)), [tasks, view, today]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        VIEWS.map((v) => [v.id, filterForView(tasks, v.id, today).filter((t) => t.status === 'todo').length]),
      ) as Record<ViewId, number>,
    [tasks, today],
  );

  const heading = VIEWS.find((v) => v.id === view)!.label;

  return (
    <AppShell
      sidebar={<Sidebar view={view} onViewChange={setView} counts={counts} categories={categories} />}
      main={
        <div className="flex flex-col gap-4">
          <header>
            <h1 className="text-2xl font-semibold">{heading}</h1>
            <p className="text-sm text-slate-500">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </header>

          {error && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              <span>{error}</span>
              <span className="flex shrink-0 gap-2">
                <button type="button" onClick={() => void reload()} className="font-medium underline">
                  Retry
                </button>
                <button type="button" onClick={dismissError} aria-label="Dismiss error" className="font-medium">
                  ✕
                </button>
              </span>
            </div>
          )}

          <AddTaskForm
            categories={categories}
            defaultDueDate={view === 'today' ? today : null}
            onCreate={createTask}
          />

          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500" aria-live="polite">
              Loading tasks…
            </p>
          ) : visible.length === 0 ? (
            <EmptyState view={view} />
          ) : (
            <TaskList
              tasks={visible}
              categoriesById={categoriesById}
              today={today}
              onUpdate={updateTask}
              onDelete={deleteTask}
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
  );
}
