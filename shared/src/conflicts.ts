import { expandOccurrences, type EventOccurrence } from './eventSeries';
import type { Event, TimeBlock } from './models/events';

/*
 * Schedule conflicts: two things you can't both be at.
 *
 * The rule is deliberately plain. Two timed events conflict if they overlap by at least a minute
 * (one ending at 11:00 and the next starting at 11:00 is fine). All-day events never conflict: they
 * mark a day ("Career fair") rather than claim an hour. Conflicts are only ever WARNED about; nothing
 * here (or in the screens that use it) stops you from saving.
 */

/** A stretch of time to check. `end` is exclusive; for an all-day span it is the midnight after the last day. */
export interface Span {
  start: string;
  end: string;
  allDay: boolean;
}

/**
 * The ids to leave out when checking an occurrence against everything else: the event's own row,
 * and its series (so a class never "conflicts" with the other dates of itself, or with the series
 * it is being moved out of).
 */
export function selfIds(occurrence: EventOccurrence): Set<string> {
  return new Set([occurrence.event.id, ...(occurrence.seriesId ? [occurrence.seriesId] : [])]);
}

const isIgnored = (o: EventOccurrence, ignore: ReadonlySet<string>) => ignore.has(o.event.id) || (o.seriesId !== null && ignore.has(o.seriesId));

/** The timed events that overlap `span`, earliest first. Pass `selfIds(occurrence)` as `ignore` when checking an event that already exists. */
export function findConflicts(events: Event[], span: Span, ignore: ReadonlySet<string> = new Set()): EventOccurrence[] {
  if (span.allDay || span.end <= span.start) return [];
  return expandOccurrences(events, span.start, span.end).filter((o) => !o.allDay && !isIgnored(o, ignore) && o.start < span.end && o.end > span.start);
}

/**
 * For a list of occurrences (a day's schedule, say): which of them overlap which others.
 * Only occurrences that overlap something appear in the result.
 */
export function conflictMap(occurrences: EventOccurrence[]): Map<string, EventOccurrence[]> {
  const timed = occurrences.filter((o) => !o.allDay);
  const out = new Map<string, EventOccurrence[]>();
  for (const a of timed) {
    const clashes = timed.filter((b) => b.key !== a.key && a.start < b.end && a.end > b.start);
    if (clashes.length > 0) out.set(a.key, clashes);
  }
  return out;
}

// ---- time blocks count as busy time too ------------------------------------

/**
 * One thing a time overlaps, whether it's an event or a time block (time you set aside to work on a to-do). The warning
 * screens only need a name and a time, so both are reduced to this.
 */
export interface Clash {
  key: string;
  title: string;
  start: string;
  end: string;
  kind: 'event' | 'block';
}

export const clashOfOccurrence = (o: EventOccurrence): Clash => ({ key: o.key, title: o.event.title, start: o.start, end: o.end, kind: 'event' });

/** The part of a time block that matters here. */
export type BlockLike = Pick<TimeBlock, 'id' | 'taskId' | 'start' | 'end'>;

/**
 * The time blocks that overlap `span`. `titleOf` gives the name of a block's to-do (undefined for one that has been deleted:
 * its blocks are hidden everywhere, so they can't clash with anything either).
 */
export function findBlockClashes(blocks: readonly BlockLike[], titleOf: (taskId: string) => string | undefined, span: Span, ignore: ReadonlySet<string> = new Set()): Clash[] {
  if (span.allDay || span.end <= span.start) return [];
  const out: Clash[] = [];
  for (const b of blocks) {
    const title = titleOf(b.taskId);
    if (title === undefined || ignore.has(b.id) || !(b.start < span.end && b.end > span.start)) continue;
    out.push({ key: `block:${b.id}`, title, start: b.start, end: b.end, kind: 'block' });
  }
  return out;
}

export interface ClashSources {
  events: Event[];
  blocks: readonly BlockLike[];
  titleOf: (taskId: string) => string | undefined;
}

/** Everything (events and time blocks) that overlaps `span`, earliest first. `ignore` leaves out the thing being checked and its series. */
export function findClashes(src: ClashSources, span: Span, ignore: { events?: ReadonlySet<string>; blocks?: ReadonlySet<string> } = {}): Clash[] {
  return [...findConflicts(src.events, span, ignore.events).map(clashOfOccurrence), ...findBlockClashes(src.blocks, src.titleOf, span, ignore.blocks)].sort((a, b) => a.start.localeCompare(b.start) || a.key.localeCompare(b.key));
}
