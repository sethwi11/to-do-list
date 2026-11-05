import { useMemo } from 'react';
import { isoWeekNumber } from '@todo/shared';
import { useApp } from '../app/AppContext';
import { PageHeader } from '../app/PageHeader';
import { CompletedSection, TaskList } from '../features/tasks/TaskList';
import { StatsBlock } from '../features/tasks/StatsBlock';
import { parseLocalISODate } from '../lib/dates';
import { sortByCompletedDesc, sortTasks } from '../lib/filters';
import { computeStats } from '../lib/stats';
import { Button } from '../ui/Button';
import { SectionLabel } from '../ui/fields';
import { EmptyState, ErrorBanner, SkeletonRows } from '../ui/states';

/** Today: what's overdue and what's due today. (The schedule and "up next" arrive with the calendar.) */
export default function TodayPage() {
  const { tasks, today, loading, error, dismissError, reload, openDialog } = useApp();

  const { overdue, dueToday, doneToday } = useMemo(() => {
    const open = tasks.filter((t) => t.status === 'todo');
    return {
      overdue: sortTasks(open.filter((t) => t.dueDate !== null && t.dueDate < today), 'due'),
      dueToday: sortTasks(open.filter((t) => t.dueDate === today), 'due'),
      doneToday: sortByCompletedDesc(tasks.filter((t) => t.status === 'done' && t.dueDate === today)),
    };
  }, [tasks, today]);
  const stats = useMemo(() => computeStats(tasks, today), [tasks, today]);

  const date = parseLocalISODate(today);

  return (
    <div className="max-w-[960px]">
      <PageHeader
        title={date.toLocaleDateString(undefined, { weekday: 'long' })}
        subtitle={date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
        aside={`WK ${isoWeekNumber(today)}`}
        quickAddDefaults={{ dueDate: today }}
      />

      {error && <ErrorBanner message={error} onRetry={() => void reload()} onDismiss={dismissError} />}

      {loading ? (
        <SkeletonRows count={5} />
      ) : (
        <>
          <p className="mb-8 text-meta text-ink-muted">
            <span className="font-mono text-ink tabular-nums">{dueToday.length}</span> {dueToday.length === 1 ? 'task' : 'tasks'} today
            {overdue.length > 0 && (
              <>
                {' · '}
                <span className="font-mono text-danger tabular-nums">{overdue.length}</span> overdue
              </>
            )}
          </p>

          {overdue.length > 0 && (
            <section className="mb-8">
              <SectionLabel count={overdue.length} className="mb-2">
                Overdue
              </SectionLabel>
              <TaskList tasks={overdue} label="Overdue tasks" leaveOnComplete />
            </section>
          )}

          <section>
            <SectionLabel count={dueToday.length} className="mb-2">
              Today
            </SectionLabel>
            {dueToday.length > 0 ? (
              <TaskList tasks={dueToday} label="Tasks due today" leaveOnComplete />
            ) : (
              <EmptyState message={doneToday.length > 0 ? 'Everything due today is done.' : 'Nothing due today. Enjoy it.'}>
                <Button variant="ghost" onClick={() => openDialog({ kind: 'task', mode: 'new', defaults: { dueDate: today } })}>
                  Add a task
                </Button>
              </EmptyState>
            )}
          </section>

          <CompletedSection tasks={doneToday} />

          <div className="mt-14">
            <StatsBlock stats={stats} />
          </div>
        </>
      )}
    </div>
  );
}
