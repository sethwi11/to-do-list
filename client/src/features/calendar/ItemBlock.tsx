import { minutesBetween, timePart, type Task } from '@todo/shared';
import { calendarVars } from '../../lib/calendarColors';
import { cx } from '../../lib/cx';
import { EventBlock, TimeBlockBlock, TodoBlock } from '../../ui/blocks';
import type { CalendarItem } from './calendarModel';
import { formatClockShort, formatTimeRange } from './format';

interface ItemBlockProps {
  item: CalendarItem;
  /** One line: for month cells and the all-day row. Otherwise a taller block for the time grid. */
  compact: boolean;
  /** In the month grid, where a phone's columns are too narrow for any text: draw a slim bar instead of a titled chip. */
  month?: boolean;
  /** Called with the to-do when its checkbox is ticked (on a to-do, or on a time block, which ticks its to-do). */
  onToggleTask: (task: Task) => void;
}

/** How one event, to-do or time block is drawn inside a FullCalendar cell. */
export function ItemBlock({ item, compact, month = false, onToggleTask }: ItemBlockProps) {
  if (item.kind === 'block') {
    const { task, block } = item;
    const done = task.status === 'done';
    const block_ = (
      <TimeBlockBlock
        title={task.title}
        time={compact ? undefined : formatTimeRange(timePart(block.start), timePart(block.end))}
        minutes={compact ? undefined : minutesBetween(block.start, block.end)}
        color={item.color}
        calendarName={item.calendarName}
        done={done}
        onToggle={() => onToggleTask(task)}
        className={compact ? 'h-6 items-center py-0' : 'h-full'}
      />
    );
    if (!month) return block_;
    return (
      <>
        <div className="max-sm:hidden">{block_}</div>
        <span style={calendarVars(item.color)} title={`Time to work on: ${task.title}`} className={cx('hatch block h-2 rounded-control sm:hidden', done && 'opacity-50')}>
          <span className="sr-only">Time block: {task.title}</span>
        </span>
      </>
    );
  }

  if (item.kind === 'task') {
    const { task } = item;
    const block = (
      <TodoBlock
        title={task.title}
        color={item.color}
        calendarName={item.calendarName}
        done={task.status === 'done'}
        onToggle={() => onToggleTask(task)}
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
    return <EventBlock title={occurrence.event.title} time={timeLabel} color={item.color} calendarName={item.calendarName} minutes={minutesBetween(occurrence.start, occurrence.end)} className="h-full" />;
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
