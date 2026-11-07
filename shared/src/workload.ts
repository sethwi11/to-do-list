import { addDays } from './dateMath';
import { combine, eachDate, minutesBetween } from './dateTime';
import type { BlockLike } from './conflicts';
import { expandOccurrences } from './eventSeries';
import type { Event } from './models/events';
import { formatMinutes } from './timeBlocks';
import type { Priority, Task } from './task';

/*
 * The workload heatmap: how heavy each day is.
 *
 *   load = hours of events + hours of time blocks + the to-dos due that day, weighted by priority
 *
 * A day's load is turned into one of four levels of shading. Everything that decides what counts as "heavy" is in
 * HEATMAP below, so changing your mind about it is a one-line edit.
 */

export const HEATMAP = {
  /** What a to-do due on the day adds, as if it were this many hours of work. */
  taskWeight: { high: 3, medium: 2, low: 1 } satisfies Record<Priority, number>,
  /**
   * A day is at least "moderate" from this load, "busy" from this, and "packed" from this. Anything above 0 and below the first is "light".
   * Roughly: 3 is a class and a couple of to-dos, 6 is a full day of classes, 9 is a day with no room to breathe.
   */
  moderateFrom: 3,
  busyFrom: 6,
  packedFrom: 9,
} as const;

export type LoadLevel = 0 | 1 | 2 | 3 | 4;
export const LOAD_LEVEL_NAMES = ['Nothing planned', 'Light', 'Moderate', 'Busy', 'Packed'] as const;

export function loadLevel(score: number): LoadLevel {
  if (score <= 0) return 0;
  if (score >= HEATMAP.packedFrom) return 4;
  if (score >= HEATMAP.busyFrom) return 3;
  if (score >= HEATMAP.moderateFrom) return 2;
  return 1;
}

export interface DayLoad {
  date: string;
  /** Events touching the day, all-day ones included. */
  events: number;
  /** Minutes of timed events on this day (an event that crosses midnight counts only the part inside the day). */
  eventMinutes: number;
  blocks: number;
  blockMinutes: number;
  /** Open to-dos due this day, by priority. */
  tasksDue: Record<Priority, number>;
  taskCount: number;
  score: number;
  level: LoadLevel;
}

const emptyDay = (date: string): DayLoad => ({
  date,
  events: 0,
  eventMinutes: 0,
  blocks: 0,
  blockMinutes: 0,
  tasksDue: { high: 0, medium: 0, low: 0 },
  taskCount: 0,
  score: 0,
  level: 0,
});

/** The minutes of [start, end) that fall on `date`. */
function minutesOnDay(start: string, end: string, date: string): number {
  const dayStart = combine(date);
  const dayEnd = combine(addDays(date, 1));
  const from = start > dayStart ? start : dayStart;
  const to = end < dayEnd ? end : dayEnd;
  return to > from ? minutesBetween(from, to) : 0;
}

export interface WorkloadSources {
  events: Event[];
  blocks: readonly BlockLike[];
  tasks: readonly Pick<Task, 'dueDate' | 'priority' | 'status'>[];
}

/**
 * The load of every day in [start, end). All-day events count as an event but add no hours (a "Career fair" marker isn't
 * an hour of your day). Only open to-dos count: ticking one off lightens its day.
 */
export function workloadByDay(start: string, end: string, src: WorkloadSources): Map<string, DayLoad> {
  const days = new Map(eachDate(start, end).map((d) => [d, emptyDay(d)]));

  for (const o of expandOccurrences(src.events, start, end)) {
    for (const day of days.values()) {
      // The same overlap test for every kind: an all-day event ends at the midnight after its last day, so it touches exactly its own days.
      if (!(o.start < combine(addDays(day.date, 1)) && o.end > combine(day.date))) continue;
      day.events++;
      if (!o.allDay) day.eventMinutes += minutesOnDay(o.start, o.end, day.date);
    }
  }
  for (const b of src.blocks) {
    for (const day of days.values()) {
      const minutes = minutesOnDay(b.start, b.end, day.date);
      if (minutes === 0) continue;
      day.blocks++;
      day.blockMinutes += minutes;
    }
  }
  for (const t of src.tasks) {
    const day = t.status === 'todo' && t.dueDate ? days.get(t.dueDate) : undefined;
    if (!day) continue;
    day.tasksDue[t.priority]++;
    day.taskCount++;
  }

  for (const day of days.values()) {
    const taskLoad = day.tasksDue.high * HEATMAP.taskWeight.high + day.tasksDue.medium * HEATMAP.taskWeight.medium + day.tasksDue.low * HEATMAP.taskWeight.low;
    day.score = (day.eventMinutes + day.blockMinutes) / 60 + taskLoad;
    day.level = loadLevel(day.score);
  }
  return days;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "2 events, 4h scheduled, 3 tasks due": what's on a day, for the hover. (Hours are events and time blocks together.) */
export function describeLoad(load: DayLoad): string {
  const parts: string[] = [];
  if (load.events > 0) parts.push(plural(load.events, 'event', 'events'));
  const scheduled = load.eventMinutes + load.blockMinutes;
  if (scheduled > 0) parts.push(`${formatMinutes(scheduled)} scheduled`);
  if (load.taskCount > 0) parts.push(`${plural(load.taskCount, 'task', 'tasks')} due`);
  return parts.length > 0 ? parts.join(', ') : 'Nothing planned';
}
