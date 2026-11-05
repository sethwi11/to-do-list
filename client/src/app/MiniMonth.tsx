import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from '../lib/cx';
import { monthGrid, shiftMonth } from '../lib/monthGrid';
import { tasksUrl } from '../lib/taskParams';
import { IconButton } from '../ui/Button';
import { useApp } from './AppContext';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * A small month for jumping to a date. A dot marks days that have open tasks. For now a click
 * opens that day's tasks; once the calendar page exists, it will jump the calendar there.
 */
export function MiniMonth({ onNavigate }: { onNavigate?: () => void }) {
  const { tasks, today } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const selected = location.pathname === '/tasks' ? new URLSearchParams(location.search).get('date') : null;

  const [shown, setShown] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }));
  const cells = useMemo(() => monthGrid(shown.year, shown.month), [shown]);
  const busy = useMemo(() => new Set(tasks.filter((t) => t.status === 'todo' && t.dueDate).map((t) => t.dueDate)), [tasks]);

  const go = (delta: number) => setShown((s) => shiftMonth(s.year, s.month, delta));

  return (
    <section aria-label="Month" className="px-4 pb-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-title" aria-live="polite">
          {MONTH_NAMES[shown.month - 1]} <span className="font-mono text-meta text-ink-muted">{shown.year}</span>
        </h2>
        <div className="flex -mr-2">
          <IconButton icon={ChevronLeft} label="Previous month" onClick={() => go(-1)} />
          <IconButton icon={ChevronRight} label="Next month" onClick={() => go(1)} />
        </div>
      </div>
      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS.map((d, i) => (
          <span key={i} aria-hidden className="py-1 font-mono text-time text-ink-muted">
            {d}
          </span>
        ))}
        {cells.map((c) => {
          const isToday = c.date === today;
          const isSelected = c.date === selected;
          const hasTasks = busy.has(c.date);
          return (
            <button
              key={c.date}
              type="button"
              aria-label={`${new Date(`${c.date}T12:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${hasTasks ? ', has open tasks' : ''}`}
              aria-current={isToday ? 'date' : undefined}
              aria-pressed={isSelected}
              onClick={() => {
                navigate(tasksUrl({ date: c.date }));
                onNavigate?.();
              }}
              className={cx(
                'relative mx-auto grid size-8 place-items-center font-mono text-time transition-colors duration-150 ease-out',
                // Only today's marker is a circle; every other day is a square-cornered button.
                isToday ? 'rounded-full bg-accent-ink text-on-accent' : cx('rounded-control hover:bg-accent-soft', c.inMonth ? 'text-ink' : 'text-ink-muted'),
                isSelected && !isToday && 'outline outline-1 outline-ink',
              )}
            >
              {c.day}
              {hasTasks && !isToday && <span aria-hidden className="absolute bottom-0.5 size-1 rounded-full bg-ink-muted" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
