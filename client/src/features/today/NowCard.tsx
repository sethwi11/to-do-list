import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { datePart, isRolling, minutesBetween, rollDeadline, timePart, type CalendarColor, type PlanItem, type Task } from '@todo/shared';
import { useApp } from '../../app/AppContext';
import { calendarVars } from '../../lib/calendarColors';
import { cx } from '../../lib/cx';
import { formatCountdown, formatDueDate, formatTime } from '../../lib/dates';
import { tasksUrl } from '../../lib/taskParams';
import { Checkbox } from '../../ui/Checkbox';
import { categoryOf } from './Agenda';

const SHOW = 5;

/** A short list of to-dos you can tick off in place; more than five shows five and a link to the rest. */
export function TaskLines({ title, tasks, moreHref, big = false }: { title: string; tasks: readonly Task[]; moreHref?: string; big?: boolean }) {
  const { today, toggleTask, openDialog } = useApp();
  return (
    <div>
      <h3 className="mb-1 text-label text-ink-muted uppercase">{title}</h3>
      {tasks.length === 0 ? (
        <p className="text-meta text-ink-muted">Nothing here.</p>
      ) : (
        <ul>
          {tasks.slice(0, SHOW).map((t) => (
            <li key={t.id} className="flex items-center gap-1">
              <Checkbox checked={false} onChange={() => void toggleTask(t)} label={`Mark "${t.title}" as done`} />
              <button type="button" onClick={() => openDialog({ kind: 'task', mode: 'edit', id: t.id })} className={cx('min-w-0 text-left hover:underline hover:underline-offset-4', big ? 'text-title' : 'text-body')}>
                {t.title}
                {t.dueDate && (
                  <span className="text-meta text-ink-muted">
                    {isRolling(t) && t.dueDate < today ? ` · until ${formatDueDate(rollDeadline(t)!, today)}` : ` · due ${formatDueDate(t.dueDate, today)}${t.dueTime ? ` ${formatTime(t.dueTime)}` : ''}`}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {tasks.length > SHOW && moreHref && (
        <Link to={moreHref} className="mt-1 inline-block text-meta text-accent-ink underline underline-offset-2">
          +{tasks.length - SHOW} more
        </Link>
      )}
    </div>
  );
}

/** What comes next when nothing is under way: later today, or the next event in the coming days. */
export interface UpNext {
  title: string;
  start: string;
  color: CalendarColor | null;
}

const vars = (color: CalendarColor | null) => (color ? calendarVars(color) : ({ '--c': 'var(--rule)' } as CSSProperties));

interface Props {
  current: PlanItem | undefined;
  next: UpNext | undefined;
  now: string;
  today: string;
  onOpen: (item: PlanItem, el: HTMLElement) => void;
  /** Open to-dos in the current block's categories. */
  during: readonly Task[];
  /** To-dos with time set aside now, or due during the current item. */
  supposed: readonly Task[];
}

/** Now: the current item and the time left, what's next, and the top to-dos in the current category. Before or after the day: just what's next. */
export function NowCard({ current, next, now, today, onOpen, during, supposed }: Props) {
  const { calendarsById } = useApp();
  if (!current && !next && supposed.length === 0) return null;
  const nextLine = next && (datePart(next.start) === datePart(now) ? `at ${formatTime(timePart(next.start))}` : `${formatDueDate(datePart(next.start), today)}, ${formatTime(timePart(next.start))}`);

  if (!current) {
    return (
      <section aria-label="Up next" style={vars(next?.color ?? null)} className="rounded-panel border border-rule border-l-4 border-l-(color:--c) bg-surface px-5 py-4">
        {next && (
          <>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-label text-ink-muted uppercase">Up next</h2>
              <p className="font-mono text-meta tabular-nums">in {formatCountdown(minutesBetween(now, next.start) * 60_000)}</p>
            </div>
            <p className="mt-1 font-display text-section break-words">{next.title}</p>
            <p className="font-mono text-meta text-ink-muted">{nextLine}</p>
          </>
        )}
        {supposed.length > 0 && (
          <div className={cx(next && 'mt-4 border-t border-hairline pt-3')}>
            <TaskLines title="Supposed to be doing now" tasks={supposed} />
          </div>
        )}
      </section>
    );
  }

  const left = minutesBetween(now, current.end);
  const done = 1 - left / Math.max(1, minutesBetween(current.start, current.end));
  const category = categoryOf(current, calendarsById);

  return (
    <section aria-label="Now" style={vars(current.kind === 'open' || current.priority === 'free' ? null : current.color)} className="@container rounded-panel border border-rule border-l-4 border-l-(color:--c) bg-surface px-5 py-4">
      <h2 className="text-label text-ink-muted uppercase">{current.kind === 'open' ? 'Now' : `Now · ${category}`}</h2>
      {current.kind === 'open' ? (
        <p className="mt-1 font-display text-section">Open time</p>
      ) : (
        <button type="button" onClick={(e) => onOpen(current, e.currentTarget)} className="mt-1 block max-w-full text-left font-display text-section break-words hover:underline hover:underline-offset-4">
          {current.title}
        </button>
      )}
      {/* Not a live region: announcing every minute would be noise. */}
      <p className="font-mono text-meta tabular-nums">
        {formatCountdown(left * 60_000)} left · until {formatTime(timePart(current.end))}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-hairline" role="progressbar" aria-label="How much of it has passed" aria-valuenow={Math.round(done * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-(color:--c)" style={{ width: `${done * 100}%` }} />
      </div>
      {next && (
        <p className="mt-3 text-meta text-ink-muted">
          Next · <span className="text-ink">{next.title}</span> {nextLine}
        </p>
      )}
      {(current.kind === 'routine' || supposed.length > 0) && (
        <div className="mt-4 grid gap-4 border-t border-hairline pt-3 @md:grid-cols-2">
          {current.kind === 'routine' && <TaskLines title="During this block" tasks={during} moreHref={current.calendarId ? tasksUrl({ calendarId: current.calendarId }) : undefined} />}
          {supposed.length > 0 && <TaskLines title="Supposed to be doing now" tasks={supposed} />}
        </div>
      )}
    </section>
  );
}
