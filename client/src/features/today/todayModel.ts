import { addDays, conflictMap, expandOccurrences, type Event, type EventOccurrence, type Task } from '@todo/shared';

/*
 * The logic behind the Today page, apart from any drawing. "now" is always a local datetime
 * string ("2026-11-04T14:30"), passed in, so every function is a plain input -> output and testable.
 */

export const isTimed = (o: EventOccurrence) => !o.allDay;

/** A timed event that has started and not yet finished. */
export const isInProgress = (o: EventOccurrence, now: string) => isTimed(o) && o.start <= now && now < o.end;

/** How far ahead the "Up next" card looks when nothing else is left today. */
export const UP_NEXT_DAYS = 14;

/**
 * The next timed event to start after `now`, today or in the next two weeks. All-day events are
 * skipped: "Career fair" is a marker on the day, not something you're about to walk into.
 */
export function nextUpcoming(events: Event[], now: string): EventOccurrence | undefined {
  const today = now.slice(0, 10);
  return expandOccurrences(events, today, addDays(today, UP_NEXT_DAYS)).find((o) => isTimed(o) && o.start > now);
}

export interface Summary {
  /** Everything on the schedule today, all-day included. */
  events: number;
  /** To-dos due today that aren't done. */
  tasks: number;
  overdue: number;
  /** Pairs of events that overlap. */
  conflicts: number;
}

export function summarize(todays: EventOccurrence[], tasks: Task[], today: string): Summary {
  const open = tasks.filter((t) => t.status === 'todo' && t.dueDate !== null);
  // Each overlapping pair shows up once in each event's list, so halve it.
  const conflicts = [...conflictMap(todays).values()].reduce((sum, list) => sum + list.length, 0) / 2;
  return {
    events: todays.length,
    tasks: open.filter((t) => t.dueDate === today).length,
    overdue: open.filter((t) => t.dueDate! < today).length,
    conflicts,
  };
}

export type TimelineState = 'all-day' | 'past' | 'now' | 'upcoming';

export type TimelineRow =
  | { kind: 'event'; occurrence: EventOccurrence; state: TimelineState; clashes: EventOccurrence[] }
  | { kind: 'now-line' };

/**
 * Today's schedule in order: all-day events first, then timed ones. A marker for the current time
 * sits before the first event still to come (or after the last one, once they are all done), and is
 * left out if there is nothing timed to place it among.
 */
export function timelineRows(todays: EventOccurrence[], now: string): TimelineRow[] {
  const clashes = conflictMap(todays);
  const stateOf = (o: EventOccurrence): TimelineState => (o.allDay ? 'all-day' : o.end <= now ? 'past' : o.start <= now ? 'now' : 'upcoming');
  const row = (o: EventOccurrence): TimelineRow => ({ kind: 'event', occurrence: o, state: stateOf(o), clashes: clashes.get(o.key) ?? [] });

  const allDay = todays.filter((o) => o.allDay).map(row);
  const timed = todays.filter(isTimed).map(row);
  if (timed.length === 0) return allDay;

  const firstToCome = timed.findIndex((r) => r.kind === 'event' && r.state === 'upcoming');
  const at = firstToCome === -1 ? timed.length : firstToCome;
  return [...allDay, ...timed.slice(0, at), { kind: 'now-line' }, ...timed.slice(at)];
}
