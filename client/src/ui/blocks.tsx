import type { ReactNode } from 'react';
import type { CalendarColor } from '@todo/shared';
import { calendarVars } from '../lib/calendarColors';
import { cx } from '../lib/cx';
import { Checkbox } from './Checkbox';

// The calendar's three kinds of block: EventBlock (tinted stripe), TodoBlock (dashed outline + checkbox), TimeBlockBlock (hatched: time set aside for a to-do).

/** Padding for a block on a time grid: none above or below under half an hour, so the text never reaches past the block. */
export const blockPadding = (minutes: number) => (minutes < 30 ? 'px-1.5 py-0' : 'px-1.5 py-0.5');

/** A block's text, fitted to its length: an hour or more gets the title, then "detail · time"; half an hour, one line "title · time"; anything shorter, the title alone (the rest is in the tooltip). */
export function BlockText({ title, detail, time, minutes, notes, alert }: { title: string; detail?: string; time?: string; minutes: number; notes?: ReactNode; alert?: ReactNode }) {
  if (minutes >= 60) {
    return (
      <>
        <p className="flex items-center gap-1 truncate text-meta leading-4 font-semibold">
          {alert}
          <span className="truncate">{title}</span>
        </p>
        {(detail || time) && (
          <p className="truncate text-time leading-4">
            {detail}
            {detail && time && ' · '}
            {time && <span className="font-mono">{time}</span>}
          </p>
        )}
        {notes}
      </>
    );
  }
  return (
    <p className="flex items-center gap-1 truncate text-meta leading-4">
      {alert}
      <span className="truncate">
        <span className="font-semibold">{title}</span>
        {minutes >= 30 && time && (
          <>
            {' · '}
            <span className="font-mono text-time">{time}</span>
          </>
        )}
      </span>
    </p>
  );
}

interface BlockBase {
  title: string;
  color: CalendarColor;
  /** The calendar's name, for screen readers and the tooltip. */
  calendarName?: string;
  className?: string;
}

export function EventBlock({ title, time, color, calendarName, className, minutes }: BlockBase & { time?: string; /** On a time grid: fit the text to the length. */ minutes?: number }) {
  return (
    <div
      style={calendarVars(color)}
      title={[title, calendarName, time].filter(Boolean).join(' · ')}
      className={cx('overflow-hidden rounded-control border-l-[3px] border-l-(color:--c) bg-(color:--c-soft) text-ink', minutes === undefined ? 'px-2 py-1' : blockPadding(minutes), className)}
    >
      {minutes === undefined ? (
        <>
          <p className="truncate text-meta leading-tight font-medium text-ink">{title}</p>
          {time && <p className="truncate font-mono text-time text-ink-muted">{time}</p>}
        </>
      ) : (
        <BlockText title={title} detail={calendarName} time={time} minutes={minutes} />
      )}
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

export function TimeBlockBlock({ title, time, color, calendarName, done, onToggle, className, minutes }: CheckableBlock & { time?: string; minutes?: number }) {
  const short = minutes !== undefined && minutes < 60;
  return (
    <div
      style={calendarVars(color)}
      title={[`Time to work on: ${title}`, time].filter(Boolean).join(' · ')}
      className={cx('hatch flex gap-1 overflow-hidden rounded-control pr-2 pl-0.5', short ? 'items-center py-0' : 'items-start py-1', done && 'opacity-50', className)}
    >
      <Checkbox size="sm" checked={done} onChange={onToggle} label={`Mark "${title}" as ${done ? 'not done' : 'done'}`} />
      <div className={cx('min-w-0 text-ink', done && 'line-through')}>
        {minutes === undefined ? (
          <>
            <p className="truncate text-meta leading-tight font-medium">{title}</p>
            {time && <p className="truncate font-mono text-time text-ink-muted">{time}</p>}
          </>
        ) : (
          <BlockText title={title} time={time} minutes={minutes} />
        )}
        <span className="sr-only">Time block{calendarName ? `, calendar: ${calendarName}` : ''}</span>
      </div>
    </div>
  );
}
