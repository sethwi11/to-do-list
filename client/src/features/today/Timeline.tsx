import { addDays, clashOfOccurrence, datePart, timePart, type EventOccurrence, type Task, type TimeBlock } from '@todo/shared';
import { TriangleAlert } from 'lucide-react';
import { calendarVars } from '../../lib/calendarColors';
import { Checkbox } from '../../ui/Checkbox';
import { cx } from '../../lib/cx';
import { formatTime } from '../../lib/dates';
import type { CalendarItem } from '../calendar/calendarModel';
import { describeConflicts } from '../calendar/format';
import type { TimelineRow } from './todayModel';

type EventItem = Extract<CalendarItem, { kind: 'event' }>;
type BlockItem = Extract<CalendarItem, { kind: 'block' }>;

interface TimelineProps {
  rows: TimelineRow[];
  now: Date;
  today: string;
  /** How to draw each event (its color and calendar name). */
  itemFor: (occurrence: EventOccurrence) => EventItem;
  onOpen: (item: EventItem, anchor: HTMLElement) => void;
  /** How to draw each time block (its to-do's color and calendar name), open its details, and tick its to-do. */
  blockFor: (block: TimeBlock, task: Task) => BlockItem;
  onOpenBlock: (item: BlockItem, anchor: HTMLElement) => void;
  onToggleTask: (task: Task) => void;
}

const GUTTER = 'grid grid-cols-[5rem_minmax(0,1fr)] gap-3';

/** The start and end shown in the time gutter, kept to today for an event that crosses midnight. */
function gutter(o: EventOccurrence, today: string): { start: string; end: string } {
  const endsToday = datePart(o.end) === today || (datePart(o.end) === addDays(today, 1) && timePart(o.end) === '00:00');
  return { start: datePart(o.start) === today ? formatTime(timePart(o.start)) : formatTime('00:00'), end: endsToday ? formatTime(timePart(o.end)) : '→' };
}

/**
 * Today as a vertical timeline: times in a mono gutter on the left, each event beside its time,
 * and a tomato line for the current moment. What's over fades; what's under way says so.
 */
export function Timeline({ rows, now, today, itemFor, onOpen, blockFor, onOpenBlock, onToggleTask }: TimelineProps) {
  const clock = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return (
    <ol aria-label="Today's schedule" className="space-y-1.5">
      {rows.map((row) => {
        if (row.kind === 'now-line') {
          return (
            <li key="now" className={cx(GUTTER, 'items-center py-0.5')}>
              <span className="text-right font-mono text-time text-accent-ink uppercase">
                <span className="sr-only">The time is </span>
                {clock}
              </span>
              <span aria-hidden className="relative block h-px bg-accent">
                <span className="absolute -top-[3px] -left-1 size-[7px] rounded-full bg-accent" />
              </span>
            </li>
          );
        }

        if (row.kind === 'block') {
          const { block, task, state } = row;
          const item = blockFor(block, task);
          const done = task.status === 'done';
          return (
            <li key={item.id} className={GUTTER} style={calendarVars(item.color)}>
              <div className="pt-2 text-right font-mono text-meta">
                <span className={state === 'past' ? 'text-ink-muted' : 'text-ink'}>{formatTime(timePart(block.start))}</span>
                <span className="block text-time text-ink-muted">{formatTime(timePart(block.end))}</span>
              </div>
              {/* The hatched fill marks time set aside for a to-do, as on the calendar; the checkbox ticks the to-do itself. */}
              <div className={cx('hatch flex min-w-0 items-start gap-1 rounded-control py-1 pr-3 pl-1 transition-opacity duration-150 ease-out hover:opacity-100', (state === 'past' || done) && 'opacity-60')}>
                <Checkbox checked={done} onChange={() => onToggleTask(task)} label={`Mark "${task.title}" as ${done ? 'not done' : 'done'}`} />
                <button type="button" aria-current={state === 'now' ? 'time' : undefined} onClick={(e) => onOpenBlock(item, e.currentTarget)} className="min-w-0 flex-1 py-1.5 text-left">
                  <span className="flex items-baseline gap-2">
                    <span className={cx('min-w-0 flex-1 truncate text-body font-medium text-ink', done && 'line-through')}>{task.title}</span>
                    {state === 'now' && <span className="font-mono text-time text-accent-ink uppercase">Now</span>}
                  </span>
                  <span className="block text-meta text-ink-muted">Time to work on this</span>
                  {item.calendarName && <span className="sr-only">Calendar: {item.calendarName}</span>}
                </button>
              </div>
            </li>
          );
        }

        const { occurrence: o, state, clashes } = row;
        const item = itemFor(o);
        const times = gutter(o, today);
        return (
          <li key={o.key} className={GUTTER} style={calendarVars(item.color)}>
            <div className="pt-2 text-right font-mono text-meta">
              {state === 'all-day' ? (
                <span className="text-time text-ink-muted uppercase">All day</span>
              ) : (
                <>
                  <span className={state === 'past' ? 'text-ink-muted' : 'text-ink'}>{times.start}</span>
                  <span className="block text-time text-ink-muted">{times.end}</span>
                </>
              )}
            </div>
            <button
              type="button"
              aria-current={state === 'now' ? 'time' : undefined}
              onClick={(e) => onOpen(item, e.currentTarget)}
              className={cx(
                'block w-full min-w-0 rounded-control border-l-[3px] border-l-(color:--c) bg-(color:--c-soft) px-3 py-2 text-left transition-opacity duration-150 ease-out hover:opacity-100',
                state === 'past' && 'opacity-60',
              )}
            >
              <span className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-body font-medium text-ink">{o.event.title}</span>
                {state === 'now' && <span className="font-mono text-time text-accent-ink uppercase">Now</span>}
              </span>
              {o.event.location && <span className="block truncate text-meta text-ink-muted">{o.event.location}</span>}
              {item.calendarName && <span className="sr-only">Calendar: {item.calendarName}</span>}
              {clashes.length > 0 && (
                <span className="mt-1 flex items-start gap-1.5 text-meta text-ink">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {describeConflicts(clashes.map(clashOfOccurrence))}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
