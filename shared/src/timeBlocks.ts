import { addDays } from './dateMath';
import { addMinutes, combine, datePart, minutesBetween } from './dateTime';
import type { BlockLike } from './conflicts';
import type { Task } from './task';

/*
 * Time blocking: reserving a slot on the calendar to work on a to-do, separate from the day it is due.
 * A to-do can have several blocks, and deleting a block never deletes the to-do. The rules for how long a
 * block is, where it ends, and how much time is set aside for a to-do live here, apart from the screens.
 */

/** How long a block is when the to-do has no estimate. */
export const DEFAULT_BLOCK_MINUTES = 60;
/** The lengths the schedule form offers. (Dragging on the calendar can make any length, in 15-minute steps.) */
export const BLOCK_LENGTHS = [15, 30, 45, 60, 90, 120, 180, 240] as const;

/** A new block for a to-do is as long as the to-do's estimate, or an hour. */
export const blockMinutesFor = (task: Pick<Task, 'estimatedMinutes'>): number => task.estimatedMinutes ?? DEFAULT_BLOCK_MINUTES;

/**
 * A block that starts at `start` and lasts `minutes`, kept within that day: one that would run past midnight ends at midnight
 * instead (a block belongs to a single day, like a to-do's slot does).
 */
export function blockSpan(start: string, minutes: number): { start: string; end: string } {
  const midnight = combine(addDays(datePart(start), 1));
  const end = addMinutes(start, Math.max(1, minutes));
  return { start, end: end > midnight ? midnight : end };
}

export const blockMinutes = (b: Pick<BlockLike, 'start' | 'end'>): number => minutesBetween(b.start, b.end);

/** Total minutes set aside per to-do, across all its blocks. */
export function scheduledMinutesByTask(blocks: readonly BlockLike[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const b of blocks) out.set(b.taskId, (out.get(b.taskId) ?? 0) + blockMinutes(b));
  return out;
}

/** "45m", "2h", "1h 30m": for a length of time in a small space. */
export function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
