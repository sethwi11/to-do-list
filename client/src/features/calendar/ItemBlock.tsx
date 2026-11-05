import { timePart } from '@todo/shared';
import { calendarVars } from '../../lib/calendarColors';
import { cx } from '../../lib/cx';
import { EventBlock, TodoBlock } from '../../ui/blocks';
import type { CalendarItem } from './calendarModel';
import { formatClockShort, formatTimeRange } from './format';

interface ItemBlockProps {
  item: CalendarItem;
  /** One line: for month cells and the all-day row. Otherwise a taller block for the time grid. */
  compact: boolean;
  /** In the month grid, where a phone's columns are too narrow for any text: draw a slim bar instead of a titled chip. */
  month?: boolean;
  onToggleTask: (item: Extract<CalendarItem, { kind: 'task' }>) => void;
}

/** How one event or to-do is drawn inside a FullCalendar cell. */
export function ItemBlock({ item, compact, month = false, onToggleTask }: ItemBlockProps) {
  if (item.kind === 'task') {
    const { task } = item;
    const block = (
      <TodoBlock
        title={task.title}
        color={item.color}
        calendarName={item.calendarName}
        done={task.status === 'done'}
        onToggle={() => onToggleTask(item)}
        className={compact ? 'h-6 py-0' : 'h-full'}
      />
    );
    if (!month) return block;
    return (
      <>
        <div className="max-sm:hidden">{block}</div>
        <span style={calendarVars(item.color)} title={task.title} className={cx('block h-2 rounded-control border border-dashed border-(color:--c) sm:hidden', task.status === 'done' && 'opacity-50')}>
          <span className="sr-only">To-do: {task.title}</span>
        </span>
      </>
    );
  }

  const { occurrence } = item;
  const timeLabel = occurrence.allDay ? undefined : formatTimeRange(timePart(occurrence.start), timePart(occurrence.end));

  if (!compact) {
    return <EventBlock title={occurrence.event.title} time={timeLabel} color={item.color} calendarName={item.calendarName} className="h-full" />;
  }

  return (
    <div
      style={calendarVars(item.color)}
      title={item.calendarName ? `${occurrence.event.title} (${item.calendarName})` : occurrence.event.title}
      className={cx(
        'flex h-5 items-center gap-1 overflow-hidden rounded-control border-l-[3px] border-l-(color:--c) bg-(color:--c-soft) px-1.5',
        // On a phone's month grid: a slim colored bar. The title is still there for screen readers.
        month && 'max-sm:h-2 max-sm:px-0',
      )}
    >
      {!occurrence.allDay && <span className="shrink-0 font-mono text-time text-ink-muted max-sm:hidden">{formatClockShort(timePart(occurrence.start))}</span>}
      <span className={cx('truncate text-meta leading-none font-medium text-ink', month && 'max-sm:sr-only')}>{occurrence.event.title}</span>
      {item.calendarName && <span className="sr-only">Calendar: {item.calendarName}</span>}
    </div>
  );
}
