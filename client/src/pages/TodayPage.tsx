import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { addMinutes, combine, isOverdue, isRolling, isoWeekNumber, quoteFor, type PlanItem } from '@todo/shared';
import { useApp } from '../app/AppContext';
import { PageHeader } from '../app/PageHeader';
import { useAppSettings } from '../data/useApplications';
import { toBlockItem, toEventItem, type CalendarItem } from '../features/calendar/calendarModel';
import { ItemDetail } from '../features/calendar/ItemDetail';
import { Agenda, Legend } from '../features/today/Agenda';
import { DayBar, MorningHeader } from '../features/today/MorningHeader';
import { NowCard } from '../features/today/NowCard';
import { greeting, summarize } from '../features/today/todayModel';
import { useNowText, useTodayPlan } from '../features/today/useTodayPlan';
import { StatsBlock } from '../features/tasks/StatsBlock';
import { CompletedSection, TaskList } from '../features/tasks/TaskList';
import { fullDate, parseLocalISODate } from '../lib/dates';
import { sortByCompletedDesc, sortTasks } from '../lib/filters';
import { computeStats } from '../lib/stats';
import { Button } from '../ui/Button';
import { EventBlock } from '../ui/blocks';
import { SectionLabel } from '../ui/fields';
import { anchorOf, type PopoverAnchor } from '../ui/Popover';
import { EmptyState, ErrorBanner, SkeletonRows } from '../ui/states';

const SEEN_KEY = 'planner.morningSeen';
const readSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
};

const Num = ({ children, tone }: { children: number; tone?: 'danger' }) => <span className={`font-mono tabular-nums ${tone === 'danger' ? 'text-danger' : 'text-ink'}`}>{children}</span>;

/** Today: the planned day as an agenda, what's happening now, and the to-dos that need doing. `?now=2026-11-11T06:00` shows it as of that moment. */
export default function TodayPage() {
  const app = useApp();
  const { tasks, timeBlocks, calendarsById, today, loading, eventsLoading, error, dismissError, reload, openDialog } = app;
  const { settings } = useAppSettings();
  const navigate = useNavigate();
  const now = useNowText();
  const [detail, setDetail] = useState<{ item: CalendarItem; anchor: PopoverAnchor } | null>(null);
  const { routine, date, plan, occurrences, current, next, during, supposed } = useTodayPlan(now);
  const summary = useMemo(() => summarize(occurrences, tasks, today, plan.items.filter((i) => i.kind === 'task').length), [occurrences, tasks, today, plan.items]);

  // Before noon, and the first time the app opens each day, Today greets you (not during last night's late hours).
  const hour = Number(now.slice(11, 13));
  const [firstOpen] = useState(() => readSeen() !== date);
  useEffect(() => {
    try {
      localStorage.setItem(SEEN_KEY, date);
    } catch {
      // Private mode: the greeting just follows the clock.
    }
  }, [date]);
  const morning = date === now.slice(0, 10) && (hour < 12 || firstOpen);

  const { overdue, dueToday, doneToday } = useMemo(() => {
    const open = tasks.filter((t) => t.status === 'todo');
    return {
      overdue: sortTasks(open.filter((t) => isOverdue(t, today)), 'due'),
      // A rolling task stays on Today from its day until the next one replaces it.
      dueToday: sortTasks(open.filter((t) => t.dueDate === today || (isRolling(t) && t.dueDate !== null && t.dueDate < today)), 'due'),
      doneToday: sortByCompletedDesc(tasks.filter((t) => t.status === 'done' && t.dueDate === today)),
    };
  }, [tasks, today]);
  const stats = useMemo(() => computeStats(tasks, today), [tasks, today]);

  function open(item: PlanItem, el: HTMLElement) {
    if (item.kind === 'routine') return navigate(`/week?block=${item.sourceId}`);
    if (item.kind === 'task') {
      const block = timeBlocks.find((b) => b.id === item.sourceId);
      const task = block && tasks.find((t) => t.id === block.taskId);
      if (block && task) setDetail({ item: toBlockItem(block, task, calendarsById), anchor: anchorOf(el) });
      return;
    }
    const occurrence = occurrences.find((o) => o.key === item.sourceId);
    if (occurrence) setDetail({ item: toEventItem(occurrence, calendarsById), anchor: anchorOf(el) });
  }

  const day = parseLocalISODate(date);
  const weekday = day.toLocaleDateString(undefined, { weekday: 'long' });
  const quote = quoteFor(date, settings.quotes);

  return (
    <div className="@container max-w-[1100px]">
      <PageHeader title={morning ? greeting(hour) : weekday} subtitle={morning ? fullDate(date) : day.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} aside={`WK ${isoWeekNumber(date)}`} quickAddDefaults={{ dueDate: today }}>
        {morning ? <MorningHeader plan={plan} now={now} quote={quote} /> : <DayBar plan={plan} now={now} className="mt-5" />}
      </PageHeader>

      {error && <ErrorBanner message={error} onRetry={() => void reload()} onDismiss={dismissError} />}

      {loading || eventsLoading || routine.loading ? (
        <SkeletonRows count={5} />
      ) : (
        <>
          <p className="mb-8 text-meta text-ink-muted">
            {date !== now.slice(0, 10) && <span className="text-ink">{weekday} night, until bedtime · </span>}
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

          <div className="grid gap-10 @3xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] @3xl:gap-14">
            <section aria-label="Agenda" className="@3xl:order-1 order-2">
              <SectionLabel className="mb-3">Agenda</SectionLabel>
              {plan.allDay.length > 0 && (
                <ul className="mb-3 space-y-1">
                  {plan.allDay.map((o) => {
                    const item = toEventItem(o, calendarsById);
                    return (
                      <li key={o.key}>
                        <button type="button" className="block w-full text-left" onClick={(e) => setDetail({ item, anchor: anchorOf(e.currentTarget) })}>
                          <EventBlock title={o.event.title} time="All day" color={item.color} calendarName={item.calendarName} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {plan.items.length > 0 ? (
                <>
                  <Legend items={plan.items} />
                  <div className="mt-5">
                    <Agenda plan={plan} now={now} onOpen={open} />
                  </div>
                </>
              ) : (
                <EmptyState message={routine.templates.length > 0 ? 'Nothing planned for this day.' : 'Set up your week to see your day here.'}>
                  {routine.templates.length > 0 ? (
                    <Button variant="ghost" onClick={() => openDialog({ kind: 'event', mode: 'new', defaults: { start: combine(date, '09:00'), end: addMinutes(combine(date, '09:00'), 60) } })}>
                      Add an event
                    </Button>
                  ) : (
                    <Button variant="ghost" onClick={() => navigate('/week')}>
                      Open Week
                    </Button>
                  )}
                </EmptyState>
              )}
            </section>

            <div className="order-1 space-y-8 @3xl:order-2">
              <NowCard current={current} next={next} now={now} today={today} onOpen={open} during={during} supposed={supposed} />

              {overdue.length > 0 && (
                <section>
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
