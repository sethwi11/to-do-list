import { addDays, conflictMap, expandOccurrences, type Event, type EventOccurrence, type Task, type TimeBlock } from '@todo/shared';

// The logic behind the Today page, apart from any drawing.

export const isTimed = (o: EventOccurrence) => !o.allDay;

/** A timed event that has started and not yet finished. */
export const isInProgress = (o: EventOccurrence, now: string) => isTimed(o) && o.start <= now && now < o.end;

/** How far ahead the "Up next" card looks when nothing else is left today. */
export const UP_NEXT_DAYS = 14;

/** The next timed event to start after `now`, today or in the next two weeks. */
export function nextUpcoming(events: Event[], now: string): EventOccurrence | undefined {
  const today = now.slice(0, 10);
  return expandOccurrences(events, today, addDays(today, UP_NEXT_DAYS)).find((o) => isTimed(o) && o.start > now);
}

export interface Summary {
  /** Everything on the schedule today, all-day included. */
  events: number;
  /** Time set aside today to work on to-dos. */
  blocks: number;
  /** To-dos due today that aren't done. */
  tasks: number;
  overdue: number;
  /** Pairs of events that overlap. */
  conflicts: number;
}

export function summarize(todays: EventOccurrence[], tasks: Task[], today: string, blocks = 0): Summary {
  const open = tasks.filter((t) => t.status === 'todo' && t.dueDate !== null);
  // Each overlapping pair shows up once in each event's list, so halve it.
  const conflicts = [...conflictMap(todays).values()].reduce((sum, list) => sum + list.length, 0) / 2;
  return {
    events: todays.length,
    blocks,
    tasks: open.filter((t) => t.dueDate === today).length,
    overdue: open.filter((t) => t.dueDate! < today).length,
    conflicts,
  };
}

export type TimelineState = 'all-day' | 'past' | 'now' | 'upcoming';

/** A time block with the to-do it is for. */
export interface DayBlock {
  block: TimeBlock;
  task: Task;
}

export type TimelineRow =
  | { kind: 'event'; occurrence: EventOccurrence; state: TimelineState; clashes: EventOccurrence[] }
  | { kind: 'block'; block: TimeBlock; task: Task; state: TimelineState }
  | { kind: 'now-line' };

/** The time blocks that touch a given day (a block belongs to one day, but may end at its midnight), with their to-dos, earliest first. */
export function blocksOnDay(blocks: readonly TimeBlock[], tasks: readonly Task[], date: string): DayBlock[] {
  const start = `${date}T00:00`;
  const end = `${addDays(date, 1)}T00:00`;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return blocks
    .filter((b) => b.start < end && b.end > start)
    .flatMap((block) => {
      const task = byId.get(block.taskId);
      return task ? [{ block, task }] : [];
    })
    .sort((a, b) => a.block.start.localeCompare(b.block.start));
}

/** Today's schedule in order: all-day events first, then timed events and time blocks together, by start time (an event first if one starts when a block does). */
export function timelineRows(todays: EventOccurrence[], now: string, blocks: readonly DayBlock[] = []): TimelineRow[] {
  const clashes = conflictMap(todays);
  const stateOf = (o: EventOccurrence): TimelineState => (o.allDay ? 'all-day' : o.end <= now ? 'past' : o.start <= now ? 'now' : 'upcoming');
  const row = (o: EventOccurrence): TimelineRow => ({ kind: 'event', occurrence: o, state: stateOf(o), clashes: clashes.get(o.key) ?? [] });
  const blockRow = ({ block, task }: DayBlock): TimelineRow => ({ kind: 'block', block, task, state: block.end <= now ? 'past' : block.start <= now ? 'now' : 'upcoming' });
  const startOf = (r: TimelineRow) => (r.kind === 'event' ? r.occurrence.start : r.kind === 'block' ? r.block.start : '');

  const allDay = todays.filter((o) => o.allDay).map(row);
  const timed = [...todays.filter(isTimed).map(row), ...blocks.map(blockRow)].sort((a, b) => startOf(a).localeCompare(startOf(b)) || Number(a.kind === 'block') - Number(b.kind === 'block'));
  if (timed.length === 0) return allDay;

  const firstToCome = timed.findIndex((r) => r.kind !== 'now-line' && r.state === 'upcoming');
  const at = firstToCome === -1 ? timed.length : firstToCome;
  return [...allDay, ...timed.slice(0, at), { kind: 'now-line' }, ...timed.slice(at)];
}
