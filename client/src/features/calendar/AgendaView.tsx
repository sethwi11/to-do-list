import { addDays, timePart } from '@todo/shared';
import { useApp } from '../../app/AppContext';
import { calendarVars } from '../../lib/calendarColors';
import { cx } from '../../lib/cx';
import { formatTime, parseLocalISODate } from '../../lib/dates';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { anchorOf, type PopoverAnchor } from '../../ui/Popover';
import { EmptyState } from '../../ui/states';
import { daysWithItems, itemsOnDay, taskSpan, weekStart, type CalendarItem } from './calendarModel';
import { formatEventTimeOnDay, formatTimeRange } from './format';

/** The label in the time column of a row: when this item happens on this day. */
function timeLabel(item: CalendarItem, date: string): string {
  if (item.kind === 'block') return formatTimeRange(timePart(item.block.start), timePart(item.block.end));
  if (item.kind === 'task') {
    const span = taskSpan(item.task);
    return span.allDay ? 'To-do' : formatTime(timePart(span.start));
  }
  const { start, end, allDay } = item.occurrence;
  return formatEventTimeOnDay(start, end, allDay, date);
}

interface AgendaViewProps {
  date: string;
  items: CalendarItem[];
  onOpenItem: (item: CalendarItem, anchor: PopoverAnchor) => void;
  onCreate: () => void;
}

/**
 * The week as a list: only the days that have something on them (and today), each with its items in
 * order. The same data as the grid, laid out to be read top to bottom, which suits a phone.
 */
export function AgendaView({ date, items, onOpenItem, onCreate }: AgendaViewProps) {
  const { today, toggleTask } = useApp();
  const start = weekStart(date);
  const end = addDays(start, 7);
  const days = daysWithItems(items, start, end, today >= start && today < end ? [today] : []);
  const hasAnything = days.some((d) => itemsOnDay(items, d).length > 0);

  return (
    <div className="h-full min-h-0 overflow-y-auto pb-8">
      {!hasAnything && (
        <EmptyState message="Nothing scheduled this week.">
          <Button variant="ghost" onClick={onCreate}>
            Add an event
          </Button>
        </EmptyState>
      )}
      {days.map((d) => {
        const dayItems = itemsOnDay(items, d);
        const isToday = d === today;
        const day = parseLocalISODate(d);
        return (
          // A printed planner page: the date set large on the left, that day's items listed beside it.
          <section
            key={d}
            aria-label={day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-3 border-t border-rule pt-3 pb-6 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-x-5"
          >
            <h2 className="flex flex-col items-start leading-none">
              <span className={cx('text-label uppercase', isToday ? 'text-accent-ink' : 'text-ink-muted')}>{day.toLocaleDateString(undefined, { weekday: 'short' })}</span>
              <span className={cx('mt-1 font-display text-page', isToday ? 'text-accent-ink' : 'text-ink')}>{day.getDate()}</span>
              {isToday && <span className="mt-1 font-mono text-time text-accent-ink uppercase">Today</span>}
            </h2>
            {dayItems.length === 0 ? (
              <p className="py-2 font-display text-title text-ink-muted italic">Nothing scheduled.</p>
            ) : (
              <ul>
                {dayItems.map((item) => (
                  <li key={`${d}:${item.id}`} style={calendarVars(item.color)} className="flex items-center gap-1 border-b border-hairline first:pt-0">
                    {item.kind !== 'event' ? (
                      <Checkbox
                        checked={item.task.status === 'done'}
                        onChange={() => void toggleTask(item.task)}
                        label={`Mark "${item.task.title}" as ${item.task.status === 'done' ? 'not done' : 'done'}`}
                      />
                    ) : (
                      <span aria-hidden className="w-8 shrink-0" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => onOpenItem(item, anchorOf(e.currentTarget))}
                      className="grid min-h-11 min-w-0 flex-1 grid-cols-[7.75rem_minmax(0,1fr)] items-center gap-3 py-2 pr-2 text-left sm:grid-cols-[9rem_minmax(0,1fr)]"
                    >
                      <span className="font-mono text-meta text-ink-muted">{timeLabel(item, d)}</span>
                      <span className="flex min-w-0 items-center gap-2">
                        <span aria-hidden className={cx('size-2.5 shrink-0', item.kind === 'event' ? 'bg-(color:--c)' : item.kind === 'block' ? 'hatch' : 'border border-dashed border-(color:--c)')} />
                        <span className={cx('truncate text-body', item.kind !== 'event' && item.task.status === 'done' && 'text-ink-muted line-through')}>
                          {item.kind === 'event' ? item.occurrence.event.title : item.task.title}
                        </span>
                        {item.kind === 'event' && item.occurrence.event.location && <span className="truncate text-meta text-ink-muted max-sm:hidden">{item.occurrence.event.location}</span>}
                        {item.kind === 'block' && <span className="sr-only">Time block</span>}
                        {item.calendarName && <span className="sr-only">Calendar: {item.calendarName}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
