import { useMemo, useState } from 'react';
import { addDays, expandOccurrences, isoWeekNumber } from '@todo/shared';
import { useApp } from '../app/AppContext';
import { PageHeader } from '../app/PageHeader';
import { localDateTime, toBlockItem, toEventItem, type CalendarItem } from '../features/calendar/calendarModel';
import { ItemDetail } from '../features/calendar/ItemDetail';
import { Timeline } from '../features/today/Timeline';
import { blocksOnDay, nextUpcoming, summarize, timelineRows } from '../features/today/todayModel';
import { UpNextCard } from '../features/today/UpNextCard';
import { StatsBlock } from '../features/tasks/StatsBlock';
import { CompletedSection, TaskList } from '../features/tasks/TaskList';
import { useNow } from '../hooks/useNow';
import { anchorOf, type PopoverAnchor } from '../ui/Popover';
import { parseLocalISODate } from '../lib/dates';
import { sortByCompletedDesc, sortTasks } from '../lib/filters';
import { computeStats } from '../lib/stats';
import { Button } from '../ui/Button';
import { SectionLabel } from '../ui/fields';
import { EmptyState, ErrorBanner, SkeletonRows } from '../ui/states';

const Num = ({ children, tone }: { children: number; tone?: 'danger' }) => (
  <span className={`font-mono tabular-nums ${tone === 'danger' ? 'text-danger' : 'text-ink'}`}>{children}</span>
);

/** Today: the day's schedule as a timeline, what's next, and the to-dos that need doing (overdue first). */
export default function TodayPage() {
  const app = useApp();
  const { tasks, events, timeBlocks, calendarsById, today, loading, eventsLoading, error, dismissError, reload, openDialog, toggleTask } = app;
  const now = useNow();
  const nowText = localDateTime(now);
  const [detail, setDetail] = useState<{ item: CalendarItem; anchor: PopoverAnchor } | null>(null);

  const todays = useMemo(() => expandOccurrences(events, today, addDays(today, 1)), [events, today]);
  const todaysBlocks = useMemo(() => blocksOnDay(timeBlocks, tasks, today), [timeBlocks, tasks, today]);
  const rows = useMemo(() => timelineRows(todays, nowText, todaysBlocks), [todays, nowText, todaysBlocks]);
  const next = useMemo(() => nextUpcoming(events, nowText), [events, nowText]);
  const summary = useMemo(() => summarize(todays, tasks, today, todaysBlocks.length), [todays, tasks, today, todaysBlocks]);

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
  const itemFor = (o: Parameters<typeof toEventItem>[0]) => toEventItem(o, calendarsById);

  return (
    <div className="@container max-w-[1100px]">
      <PageHeader
        title={date.toLocaleDateString(undefined, { weekday: 'long' })}
        subtitle={date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
        aside={`WK ${isoWeekNumber(today)}`}
        quickAddDefaults={{ dueDate: today }}
      />

      {error && <ErrorBanner message={error} onRetry={() => void reload()} onDismiss={dismissError} />}

      {loading || eventsLoading ? (
        <SkeletonRows count={5} />
      ) : (
        <>
          <p className="mb-8 text-meta text-ink-muted">
            <Num>{summary.events}</Num> {summary.events === 1 ? 'event' : 'events'}
            {summary.blocks > 0 && (
              <>
                {' · '}
                <Num>{summary.blocks}</Num> {summary.blocks === 1 ? 'time block' : 'time blocks'}
              </>
            )}
            {' · '}
            <Num>{summary.tasks}</Num> {summary.tasks === 1 ? 'task' : 'tasks'}
            {summary.overdue > 0 && (
              <>
                {' · '}
                <Num tone="danger">{summary.overdue}</Num> overdue
              </>
            )}
            {summary.conflicts > 0 && (
              <>
                {' · '}
                <Num>{summary.conflicts}</Num> {summary.conflicts === 1 ? 'conflict' : 'conflicts'}
              </>
            )}
          </p>

          {next && <UpNextCard item={itemFor(next)} now={now} today={today} onOpen={(el) => setDetail({ item: itemFor(next), anchor: anchorOf(el) })} />}

          <div className="grid gap-10 @3xl:grid-cols-2 @3xl:gap-14">
            <section aria-label="Schedule">
              <SectionLabel count={todays.length + todaysBlocks.length} className="mb-3">
                Schedule
              </SectionLabel>
              {rows.length > 0 ? (
                <Timeline
                  rows={rows}
                  now={now}
                  today={today}
                  itemFor={itemFor}
                  onOpen={(item, el) => setDetail({ item, anchor: anchorOf(el) })}
                  blockFor={(block, task) => toBlockItem(block, task, calendarsById)}
                  onOpenBlock={(item, el) => setDetail({ item, anchor: anchorOf(el) })}
                  onToggleTask={(task) => void toggleTask(task)}
                />
              ) : (
                <EmptyState message="Nothing scheduled today.">
                  <Button variant="ghost" onClick={() => openDialog({ kind: 'event', mode: 'new', defaults: { start: `${today}T09:00`, end: `${today}T10:00` } })}>
                    Add an event
                  </Button>
                </EmptyState>
              )}
            </section>

            <div>
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
                  To-dos
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
            </div>
          </div>

          <div className="mt-14">
            <StatsBlock stats={stats} />
          </div>
        </>
      )}

      {detail && <ItemDetail item={detail.item} anchor={detail.anchor} onClose={() => setDetail(null)} />}
    </div>
  );
}
