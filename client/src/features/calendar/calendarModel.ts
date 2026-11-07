import {
  addDays,
  addMinutes,
  addMonths,
  combine,
  dayOfWeek,
  eachDate,
  expandOccurrences,
  minutesBetween,
  type Calendar,
  type CalendarColor,
  type Event,
  type EventOccurrence,
  type Task,
  type TimeBlock,
} from '@todo/shared';
import { parseLocalISODate } from '../../lib/dates';

/*
 * The calendar page's logic, apart from any drawing: which view and date the address bar
 * names, how to move between dates, and how events and to-dos become the list of things to show.
 */

export const CALENDAR_VIEWS = [
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'Week' },
  { id: 'day', label: 'Day' },
  { id: 'agenda', label: 'Agenda' },
] as const;
export type CalendarViewId = (typeof CALENDAR_VIEWS)[number]['id'];

export const isCalendarView = (v: unknown): v is CalendarViewId => CALENDAR_VIEWS.some((x) => x.id === v);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isRealDate = (v: string) => DATE_RE.test(v) && !Number.isNaN(parseLocalISODate(v).getTime()) && addDays(v, 0) === v;

export interface CalendarQuery {
  /** null = the URL doesn't say, so use the last view the person used. */
  view: CalendarViewId | null;
  date: string;
}

/** `/calendar?view=week&date=2026-11-04`. A missing or bad date means today. */
export function parseCalendarQuery(params: URLSearchParams, today: string): CalendarQuery {
  const view = params.get('view');
  const date = params.get('date');
  return { view: isCalendarView(view) ? view : null, date: date && isRealDate(date) ? date : today };
}

export function calendarUrl({ view, date }: { view?: CalendarViewId | null; date?: string | null } = {}): string {
  const params = new URLSearchParams();
  if (view) params.set('view', view);
  if (date) params.set('date', date);
  const query = params.toString();
  return query ? `/calendar?${query}` : '/calendar';
}

/** The Sunday on or before a date. */
export const weekStart = (date: string): string => addDays(date, -dayOfWeek(date));

/** Move a date forward or back by one screenful of the view. */
export function shiftDate(view: CalendarViewId, date: string, direction: -1 | 1): string {
  switch (view) {
    case 'month':
      return addMonths(date.slice(0, 8) + '01', direction); // always the 1st, so a 31st can't skip a month
    case 'week':
    case 'agenda':
      return addDays(date, 7 * direction);
    case 'day':
      return addDays(date, direction);
  }
}

const fmt = (date: string, options: Intl.DateTimeFormatOptions) => parseLocalISODate(date).toLocaleDateString(undefined, options);

/** The heading for a view, e.g. "November 2026" or "Nov 1 – 7, 2026". */
export function viewTitle(view: CalendarViewId, date: string): string {
  switch (view) {
    case 'month':
      return fmt(date, { month: 'long', year: 'numeric' });
    case 'day':
      return fmt(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    case 'week':
    case 'agenda': {
      const first = weekStart(date);
      const last = addDays(first, 6);
      const sameMonth = first.slice(0, 7) === last.slice(0, 7);
      const sameYear = first.slice(0, 4) === last.slice(0, 4);
      const left = fmt(first, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
      const right = sameMonth ? fmt(last, { day: 'numeric' }) : fmt(last, { month: 'short', day: 'numeric' });
      return `${left} – ${right}, ${last.slice(0, 4)}`;
    }
  }
}

/**
 * A range of dates comfortably covering what the view shows (a superset: extra days cost nothing),
 * as [first date, last date + 1]. Computed from the date alone so the first paint already has data.
 */
export function dataRange(date: string): [string, string] {
  const monthStart = date.slice(0, 8) + '01';
  return [addDays(monthStart, -14), addDays(monthStart, 62)];
}

// ---------------------------------------------------------------------------------------------

export type CalendarItem =
  | { kind: 'event'; id: string; occurrence: EventOccurrence; color: CalendarColor; calendarName?: string }
  | { kind: 'task'; id: string; task: Task; color: CalendarColor; calendarName?: string }
  /** Time set aside to work on a to-do. Drawn in the to-do's calendar color. */
  | { kind: 'block'; id: string; block: TimeBlock; task: Task; color: CalendarColor; calendarName?: string };

/** Things with no calendar of their own (and no color of their own) use the neutral slate. */
const NEUTRAL: CalendarColor = 'slate';

/** An event occurrence as a calendar item: with the color and calendar name it should be drawn with. */
export function toEventItem(occurrence: EventOccurrence, calendarsById: ReadonlyMap<string, Calendar>): Extract<CalendarItem, { kind: 'event' }> {
  const calendar = occurrence.event.calendarId ? calendarsById.get(occurrence.event.calendarId) : undefined;
  return { kind: 'event', id: occurrence.key, occurrence, color: occurrence.event.color ?? calendar?.color ?? NEUTRAL, calendarName: calendar?.name };
}

/** A time block as a calendar item: it takes its to-do's calendar color and name. */
export function toBlockItem(block: TimeBlock, task: Task, calendarsById: ReadonlyMap<string, Calendar>): Extract<CalendarItem, { kind: 'block' }> {
  const calendar = task.calendarId ? calendarsById.get(task.calendarId) : undefined;
  return { kind: 'block', id: `block:${block.id}`, block, task, color: calendar?.color ?? NEUTRAL, calendarName: calendar?.name };
}

export interface ItemSources {
  events: Event[];
  tasks: Task[];
  /** Time blocks (only those whose to-do exists are drawn). */
  blocks?: TimeBlock[];
  calendarsById: ReadonlyMap<string, Calendar>;
  hiddenCalendarIds: ReadonlySet<string>;
  showEvents: boolean;
  showTasks: boolean;
  showBlocks?: boolean;
}

/** Everything to show in [rangeStart, rangeEnd): events (repeats expanded), to-dos and time blocks, minus hidden calendars. */
export function buildItems(src: ItemSources, rangeStart: string, rangeEnd: string): CalendarItem[] {
  const visible = (calendarId: string | null) => calendarId === null || !src.hiddenCalendarIds.has(calendarId);
  const items: CalendarItem[] = [];

  if (src.showEvents) {
    for (const occurrence of expandOccurrences(src.events, rangeStart, rangeEnd)) {
      if (visible(occurrence.event.calendarId)) items.push(toEventItem(occurrence, src.calendarsById));
    }
  }

  if (src.showTasks) {
    for (const task of src.tasks) {
      if (!task.dueDate || task.dueDate < rangeStart.slice(0, 10) || task.dueDate >= rangeEnd.slice(0, 10) || !visible(task.calendarId)) continue;
      const calendar = task.calendarId ? src.calendarsById.get(task.calendarId) : undefined;
      items.push({ kind: 'task', id: `task:${task.id}`, task, color: calendar?.color ?? NEUTRAL, calendarName: calendar?.name });
    }
  }

  if (src.showBlocks && src.blocks) {
    const tasksById = new Map(src.tasks.map((t) => [t.id, t]));
    for (const block of src.blocks) {
      const task = tasksById.get(block.taskId);
      // A block overlaps the range if it starts before the range ends and ends after it starts.
      if (!task || !(block.start < rangeEnd && block.end > rangeStart) || !visible(task.calendarId)) continue;
      items.push(toBlockItem(block, task, src.calendarsById));
    }
  }
  return items;
}

const DEFAULT_TASK_MINUTES = 30;

/** A to-do's slot on the calendar: all-day if it has no time, else from its time for its estimate (30 minutes if none), kept within its day. */
export function taskSpan(task: Task): { start: string; end: string; allDay: boolean } {
  const date = task.dueDate!;
  if (!task.dueTime) return { start: date, end: addDays(date, 1), allDay: true };
  const start = combine(date, task.dueTime);
  const end = addMinutes(start, task.estimatedMinutes ?? DEFAULT_TASK_MINUTES);
  return { start, end: end.slice(0, 10) > date ? combine(date, '23:59') : end, allDay: false };
}

/** The items that touch a given day (a multi-day event is on each of its days), all-day first, then by start time. */
export function itemsOnDay(items: CalendarItem[], date: string): CalendarItem[] {
  const dayStart = combine(date);
  const dayEnd = combine(addDays(date, 1));
  const span = (i: CalendarItem) =>
    i.kind === 'event' ? { start: i.occurrence.start, end: i.occurrence.end, allDay: i.occurrence.allDay } : i.kind === 'block' ? { start: i.block.start, end: i.block.end, allDay: false } : taskSpan(i.task);
  const touches = (i: CalendarItem) => {
    const s = span(i);
    const start = s.start.length === 10 ? combine(s.start) : s.start;
    const end = s.end.length === 10 ? combine(s.end) : s.end;
    return start < dayEnd && end > dayStart;
  };
  const sortKey = (i: CalendarItem) => {
    const s = span(i);
    // At the same start: events, then time blocks, then to-dos.
    return `${s.allDay ? '0' : '1'}${i.kind === 'event' ? '0' : i.kind === 'block' ? '1' : '2'}${s.start.length === 10 ? combine(s.start) : s.start}`;
  };
  return items.filter(touches).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

/** Dates in [start, end) that have anything on them, plus `alwaysInclude`: the days an agenda lists. */
export function daysWithItems(items: CalendarItem[], start: string, end: string, alwaysInclude: string[] = []): string[] {
  return eachDate(start, end).filter((d) => alwaysInclude.includes(d) || itemsOnDay(items, d).length > 0);
}

// ---------------------------------------------------------------------------------------------
// FullCalendar speaks `Date`; this app speaks local date strings.
// ---------------------------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');

/** A Date's local wall-clock time as "YYYY-MM-DDTHH:mm". */
export const localDateTime = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const localDate = (d: Date): string => localDateTime(d).slice(0, 10);

/**
 * A moved or resized item's new start and end, as stored strings. FullCalendar leaves `end` empty for
 * an event with its default length, so fill it in (all-day: one day; timed: an hour).
 */
export function spanFromFullCalendar(start: Date, end: Date | null, allDay: boolean): { start: string; end: string; allDay: boolean } {
  if (allDay) {
    const first = localDate(start);
    return { start: combine(first), end: combine(end ? localDate(end) : addDays(first, 1)), allDay };
  }
  const s = localDateTime(start);
  return { start: s, end: end ? localDateTime(end) : addMinutes(s, 60), allDay };
}

/**
 * What a selection on the grid means as a new event. A plain click selects a single 30-minute slot,
 * but a new event is more likely an hour; anything the person dragged out is kept as dragged.
 */
export function selectionToSpan(start: string, end: string, allDay: boolean): { start: string; end: string } {
  if (allDay || minutesBetween(start, end) > 30) return { start, end };
  return { start, end: addMinutes(start, 60) };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Where "New event" starts when nothing was dragged out. On a day other than today (you're looking at
 * it on the calendar) it's 9 AM that day; otherwise the next full hour, rolling to 9 AM tomorrow late at night.
 */
export function newEventSpan(lookingAt: string | null, now: Date): { start: string; end: string } {
  const today = localDate(now);
  if (lookingAt && lookingAt !== today) return { start: combine(lookingAt, '09:00'), end: combine(lookingAt, '10:00') };
  const hour = now.getHours() + 1;
  const start = hour >= 23 ? combine(addDays(today, 1), '09:00') : combine(today, `${pad2(hour)}:00`);
  return { start, end: addMinutes(start, 60) };
}
