import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, expandOccurrences } from '@todo/shared';
import { calendarUrl, isCalendarView } from '../features/calendar/calendarModel';
import { cx } from '../lib/cx';
import { monthGrid, shiftMonth } from '../lib/monthGrid';
import { IconButton } from '../ui/Button';
import { useApp } from './AppContext';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * A small month for jumping to a date. A dot marks days that have an event or an open task. A click
 * takes the calendar there: on the calendar page it keeps the view you're in; from anywhere else it
 * opens that day.
 */
export function MiniMonth({ onNavigate }: { onNavigate?: () => void }) {
  const { tasks, events, today } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const onCalendar = location.pathname === '/calendar';
  const search = new URLSearchParams(location.search);
  const selected = onCalendar ? search.get('date') : null;

  const [shown, setShown] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }));
  const cells = useMemo(() => monthGrid(shown.year, shown.month), [shown]);

  // When the calendar page is on another month, follow it.
  useEffect(() => {
    if (selected) setShown({ year: Number(selected.slice(0, 4)), month: Number(selected.slice(5, 7)) });
  }, [selected]);

  const busy = useMemo(() => {
    const days = new Set<string | null>(tasks.filter((t) => t.status === 'todo' && t.dueDate).map((t) => t.dueDate));
    const first = cells[0]!.date;
    const last = cells[cells.length - 1]!.date;
    for (const o of expandOccurrences(events, first, addDays(last, 1))) {
      // An event covers every day from its start to its end (the end of an all-day event is exclusive).
      for (let d = o.start.slice(0, 10); d < o.end.slice(0, 10) || d === o.start.slice(0, 10); d = addDays(d, 1)) days.add(d);
    }
    return days;
  }, [tasks, events, cells]);

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
          const hasItems = busy.has(c.date);
          return (
            <button
              key={c.date}
              type="button"
              aria-label={`${new Date(`${c.date}T12:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${hasItems ? ', has events or open tasks' : ''}`}
              aria-current={isToday ? 'date' : undefined}
              aria-pressed={isSelected}
              onClick={() => {
                const view = search.get('view');
                navigate(calendarUrl({ view: onCalendar && isCalendarView(view) ? view : onCalendar ? null : 'day', date: c.date }));
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
              {hasItems && !isToday && <span aria-hidden className="absolute bottom-0.5 size-1 rounded-full bg-ink-muted" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
