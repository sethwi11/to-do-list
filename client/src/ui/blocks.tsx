import type { CalendarColor } from '@todo/shared';
import { calendarVars } from '../lib/calendarColors';
import { cx } from '../lib/cx';
import { Checkbox } from './Checkbox';

/*
 * The three things that appear on the calendar, each recognizable at a glance:
 *   EventBlock     - a highlighter stripe: soft tint fill, solid 3px left edge
 *   TodoBlock      - a dashed outline, no fill, with a checkbox
 *   TimeBlockBlock - a hatched fill: time reserved to work on a task
 *
 * Each takes its calendar's color name and sets --c / --c-soft (see calendarVars), so one
 * component serves every calendar. The calendar's name is on the element as an accessible
 * label, since color alone shouldn't be the only way to tell calendars apart.
 */

interface BlockBase {
  title: string;
  color: CalendarColor;
  /** The calendar's name, for screen readers and the tooltip. */
  calendarName?: string;
  className?: string;
}

export function EventBlock({ title, time, color, calendarName, className }: BlockBase & { time?: string }) {
  return (
    <div
      style={calendarVars(color)}
      title={calendarName ? `${title} (${calendarName})` : title}
      className={cx('overflow-hidden rounded-control border-l-[3px] border-l-(color:--c) bg-(color:--c-soft) px-2 py-1', className)}
    >
      <p className="truncate text-meta leading-tight font-medium text-ink">{title}</p>
      {time && <p className="truncate font-mono text-time text-ink-muted">{time}</p>}
      {calendarName && <span className="sr-only">Calendar: {calendarName}</span>}
    </div>
  );
}

interface CheckableBlock extends BlockBase {
  done: boolean;
  onToggle: () => void;
}

export function TodoBlock({ title, color, calendarName, done, onToggle, className }: CheckableBlock) {
  return (
    <div
      style={calendarVars(color)}
      title={calendarName ? `${title} (${calendarName})` : title}
      className={cx(
        'flex items-center gap-1 overflow-hidden rounded-control border border-dashed border-(color:--c) py-0.5 pr-2 pl-0.5 transition-opacity duration-150',
        done && 'opacity-50',
        className,
      )}
    >
      <Checkbox size="sm" checked={done} onChange={onToggle} label={`Mark "${title}" as ${done ? 'not done' : 'done'}`} />
      <span className={cx('truncate text-meta text-ink', done && 'line-through')}>{title}</span>
      {calendarName && <span className="sr-only">Calendar: {calendarName}</span>}
    </div>
  );
}

export function TimeBlockBlock({ title, time, color, calendarName, done, onToggle, className }: CheckableBlock & { time?: string }) {
  return (
    <div
      style={calendarVars(color)}
      title={`Time to work on: ${title}`}
      className={cx('hatch flex items-start gap-1 overflow-hidden rounded-control py-1 pr-2 pl-0.5', done && 'opacity-50', className)}
    >
      <Checkbox size="sm" checked={done} onChange={onToggle} label={`Mark "${title}" as ${done ? 'not done' : 'done'}`} />
      <div className="min-w-0">
        <p className={cx('truncate text-meta leading-tight font-medium text-ink', done && 'line-through')}>{title}</p>
        {time && <p className="truncate font-mono text-time text-ink-muted">{time}</p>}
        <span className="sr-only">Time block{calendarName ? `, calendar: ${calendarName}` : ''}</span>
      </div>
    </div>
  );
}
