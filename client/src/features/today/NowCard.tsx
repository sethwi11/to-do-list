import type { CSSProperties } from 'react';
import { datePart, minutesBetween, timePart, type CalendarColor, type PlanItem, type Task } from '@todo/shared';
import { useApp } from '../../app/AppContext';
import { calendarVars } from '../../lib/calendarColors';
import { formatCountdown, formatDueDate, formatTime } from '../../lib/dates';
import { categoryOf } from './Agenda';
import { todosFor } from './todayModel';

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
}

/** Now: the current item and the time left, what's next, and the top to-dos in the current category. Before or after the day: just what's next. */
export function NowCard({ current, next, now, today, onOpen }: Props) {
  const { tasks, calendarsById, openDialog } = useApp();
  if (!current && !next) return null;
  const nextLine = next && (datePart(next.start) === datePart(now) ? `at ${formatTime(timePart(next.start))}` : `${formatDueDate(datePart(next.start), today)}, ${formatTime(timePart(next.start))}`);

  if (!current) {
    return (
      <section aria-label="Up next" style={vars(next!.color)} className="rounded-panel border border-rule border-l-4 border-l-(color:--c) bg-surface px-5 py-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-label text-ink-muted uppercase">Up next</h2>
          <p className="font-mono text-meta tabular-nums">in {formatCountdown(minutesBetween(now, next!.start) * 60_000)}</p>
        </div>
        <p className="mt-1 font-display text-section break-words">{next!.title}</p>
        <p className="font-mono text-meta text-ink-muted">{nextLine}</p>
      </section>
    );
  }

  const left = minutesBetween(now, current.end);
  const done = 1 - left / Math.max(1, minutesBetween(current.start, current.end));
  const category = categoryOf(current, calendarsById);
  const todos: Task[] = todosFor(tasks, current.calendarId);

  return (
    <section aria-label="Now" style={vars(current.kind === 'open' || current.priority === 'free' ? null : current.color)} className="rounded-panel border border-rule border-l-4 border-l-(color:--c) bg-surface px-5 py-4">
      <h2 className="text-label text-ink-muted uppercase">Now · {category}</h2>
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
      {todos.length > 0 && (
        <div className="mt-4 border-t border-hairline pt-3">
          <h3 className="mb-1 text-label text-ink-muted uppercase">To-dos for {category}</h3>
          <ul className="space-y-0.5">
            {todos.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => openDialog({ kind: 'task', mode: 'edit', id: t.id })} className="text-left text-body hover:underline hover:underline-offset-4">
                  {t.title}
                  {t.dueDate && <span className="text-meta text-ink-muted"> · due {formatDueDate(t.dueDate, today)}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
