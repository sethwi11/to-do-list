import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { X } from 'lucide-react';
import { useApp } from '../app/AppContext';
import { PageHeader } from '../app/PageHeader';
import { TaskFilters } from '../features/tasks/TaskFilters';
import { CompletedSection, TaskList } from '../features/tasks/TaskList';
import { usePersistedState } from '../hooks/usePersistedState';
import { formatDueDate } from '../lib/dates';
import { applyFilters, DEFAULT_FILTERS, isFiltering, sortByCompletedDesc, sortTasks, SORT_MODES, type Filters, type SortMode } from '../lib/filters';
import { parseTasksQuery, TASK_TABS, tasksUrl, type TaskTab } from '../lib/taskParams';
import { inView } from '../lib/views';
import { Button } from '../ui/Button';
import { EmptyState, ErrorBanner, SkeletonRows } from '../ui/states';
import { Tabs } from '../ui/Tabs';

const isSortMode = (v: unknown): v is SortMode => SORT_MODES.some((m) => m.id === v);

const EMPTY_MESSAGE: Record<TaskTab, string> = {
  all: 'No tasks yet.',
  upcoming: 'Nothing in the next 7 days.',
  overdue: 'Nothing overdue.',
  completed: 'Nothing completed yet.',
};

/**
 * Every task, with tabs (All, Upcoming, Overdue, Completed), search, filters, and sorting. What's
 * shown (the tab, a single calendar, a single day) is in the URL, so links from the sidebar and
 * the mini month land on the right list.
 */
export default function TasksPage() {
  const { tasks, calendars, calendarsById, today, loading, error, dismissError, reload, openDialog } = useApp();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const query = parseTasksQuery(params);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sortMode, setSortMode] = usePersistedState<SortMode>('voice-todo.sortMode', 'due', isSortMode);

  // A link to a calendar that has since been deleted shouldn't hide everything.
  const calendar = query.calendarId ? calendarsById.get(query.calendarId) : undefined;
  const calendarId = calendar ? calendar.id : null;

  const isCompleted = query.tab === 'completed';
  const { openTasks, doneTasks, inScope } = useMemo(() => {
    const base = tasks.filter(
      (t) => inView(t, { type: 'smart', id: query.tab }, today) && (!calendarId || t.calendarId === calendarId) && (!query.date || t.dueDate === query.date),
    );
    const filtered = applyFilters(base, filters, today);
    return {
      openTasks: sortTasks(filtered.filter((t) => t.status === 'todo'), sortMode),
      doneTasks: sortByCompletedDesc(filtered.filter((t) => t.status === 'done')),
      inScope: base.length,
    };
  }, [tasks, query.tab, query.date, calendarId, today, filters, sortMode]);

  // Done tasks tuck under a "Completed" toggle, unless you're looking at the Completed tab or filtering to done.
  const doneAsSection = !isCompleted && filters.status === 'any';
  const mainTasks = doneAsSection ? openTasks : [...openTasks, ...doneTasks];
  const draggable = sortMode === 'manual' && doneAsSection;
  const filtering = isFiltering(filters);

  const go = (next: Partial<typeof query>) => navigate(tasksUrl({ ...query, calendarId, ...next }));

  return (
    <div className="max-w-[960px]">
      <PageHeader title={calendar?.name ?? 'Tasks'} quickAddDefaults={{ calendarId, dueDate: query.date }} />

      {error && <ErrorBanner message={error} onRetry={() => void reload()} onDismiss={dismissError} />}

      <Tabs label="Task lists" tabs={TASK_TABS} value={query.tab} onChange={(tab) => go({ tab })} className="mb-5" />

      {(calendar || query.date) && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-meta text-ink-muted">
          Showing
          {calendar && <Chip onRemove={() => go({ calendarId: null })}>{calendar.name}</Chip>}
          {query.date && <Chip onRemove={() => go({ date: null })}>Due {formatDueDate(query.date, today)}</Chip>}
        </div>
      )}

      <div className="mb-6">
        <TaskFilters
          filters={filters}
          onChange={setFilters}
          sortMode={sortMode}
          onSortChange={setSortMode}
          calendars={calendars}
          hideCalendar={calendarId !== null}
          hideStatus={isCompleted || query.tab === 'overdue'}
        />
      </div>

      {loading ? (
        <SkeletonRows count={6} />
      ) : mainTasks.length === 0 && doneTasks.length === 0 ? (
        filtering && inScope > 0 ? (
          <EmptyState message="No tasks match those filters.">
            <Button variant="ghost" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Clear filters
            </Button>
          </EmptyState>
        ) : (
          <EmptyState message={calendar && query.tab === 'all' ? 'No tasks in this calendar.' : EMPTY_MESSAGE[query.tab]}>
            {!isCompleted && (
              <Button variant="ghost" onClick={() => openDialog({ kind: 'task', mode: 'new', defaults: { calendarId, dueDate: query.date } })}>
                Add a task
              </Button>
            )}
          </EmptyState>
        )
      ) : (
        <>
          {mainTasks.length > 0 && <TaskList tasks={mainTasks} label="Tasks" draggable={draggable} leaveOnComplete={doneAsSection} />}
          {doneAsSection && <CompletedSection tasks={doneTasks} />}
        </>
      )}
    </div>
  );
}

/** A removable label showing one active URL filter. */
function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-control border border-rule bg-surface pr-1 pl-2 text-ink">
      {children}
      <button type="button" onClick={onRemove} aria-label={`Remove filter: ${typeof children === 'string' ? children : 'this filter'}`} className="grid size-5 place-items-center rounded-control text-ink-muted hover:bg-accent-soft hover:text-ink">
        <X className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}
