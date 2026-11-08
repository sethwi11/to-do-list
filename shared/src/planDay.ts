import { inRanges } from './classSchedule';
import { addDays, dayOfWeek } from './dateMath';
import { combine, datePart, minutesBetween } from './dateTime';
import { expandOccurrences, type EventOccurrence } from './eventSeries';
import type { Calendar } from './models/calendars';
import type { Semester } from './models/courses';
import type { Event, TimeBlock } from './models/events';
import type { RoutineBlock, RoutinePriority, WeekTemplate } from './models/routine';
import type { Task } from './models/tasks';
import type { CalendarColor } from './palette';

// One function plans a day, so Today, the calendar and later the pop-ups always agree.

export const DEFAULT_WAKE = '06:00';
export const DEFAULT_BED = '22:00';
/** Shorter gaps aren't worth calling Open time. */
export const MIN_OPEN_MINUTES = 15;
const NEUTRAL: CalendarColor = 'slate';

export type PlanKind = 'class' | 'event' | 'task' | 'routine' | 'open';

export interface PlanItem {
  key: string;
  kind: PlanKind;
  /** Local datetimes; a block after midnight ends on the next date. */
  start: string;
  end: string;
  title: string;
  calendarId: string | null;
  /** null for free and open time, which is drawn as a neutral hatch. */
  color: CalendarColor | null;
  /** Routine blocks only. */
  priority: RoutinePriority | null;
  focus: boolean;
  soundtrack: string | null;
  altTitle: string | null;
  /** The routine block, event occurrence key or time block it came from. */
  sourceId: string | null;
}

export interface DayPlan {
  date: string;
  templateId: string | null;
  wake: string;
  bed: string;
  /** Timed items, in order. */
  items: PlanItem[];
  allDay: EventOccurrence[];
}

export interface PlanSources {
  templates: readonly WeekTemplate[];
  blocks: readonly RoutineBlock[];
  semesters: readonly Semester[];
  events: Event[];
  timeBlocks: readonly TimeBlock[];
  tasks: readonly Task[];
  calendars: readonly Pick<Calendar, 'id' | 'color'>[];
}

/** The template in effect on a date; if ranges overlap, the one that started most recently. */
export function activeTemplate(templates: readonly WeekTemplate[], date: string): WeekTemplate | undefined {
  return templates
    .filter((t) => t.effectiveFrom <= date && (t.effectiveTo === null || date <= t.effectiveTo))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}

/** Inside a semester that isn't archived, and not during one of its breaks. */
export const isSchoolDay = (semesters: readonly Semester[], date: string) =>
  semesters.some((s) => !s.archived && s.startDate <= date && date <= s.endDate && !inRanges(date, s.excludedRanges));

/** Clock times on a date as datetimes; an end at or before the start is on the next date. */
export const spanOn = (date: string, start: string, end: string) => ({ start: combine(date, start), end: combine(end <= start ? addDays(date, 1) : date, end) });

export function dayBounds(template: WeekTemplate | undefined, date: string): { wake: string; bed: string } {
  const day = template?.days.find((d) => d.weekday === dayOfWeek(date));
  const { start, end } = spanOn(date, day?.wake ?? DEFAULT_WAKE, day?.bed ?? DEFAULT_BED);
  return { wake: start, bed: end };
}

/** The day still going at `now`: until last night's bedtime (2:00 AM after a free night) that is yesterday. */
export function planningDate(templates: readonly WeekTemplate[], now: string): string {
  const yesterday = addDays(datePart(now), -1);
  return now < dayBounds(activeTemplate(templates, yesterday), yesterday).bed ? yesterday : datePart(now);
}

const KIND_ORDER: PlanKind[] = ['class', 'event', 'task', 'routine', 'open'];
const byStart = (a: PlanItem, b: PlanItem) => a.start.localeCompare(b.start) || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.end.localeCompare(b.end);

/** Gaps of at least MIN_OPEN_MINUTES between wake and bed that nothing covers. */
function openGaps(sorted: readonly PlanItem[], wake: string, bed: string): PlanItem[] {
  const out: PlanItem[] = [];
  const gap = (start: string, end: string) => {
    if (minutesBetween(start, end) >= MIN_OPEN_MINUTES) {
      out.push({ key: `open:${start}`, kind: 'open', start, end, title: 'Open', calendarId: null, color: null, priority: null, focus: false, soundtrack: null, altTitle: null, sourceId: null });
    }
  };
  let cursor = wake;
  for (const item of sorted) {
    if (cursor >= bed) break;
    if (item.start > cursor) gap(cursor, item.start < bed ? item.start : bed);
    if (item.end > cursor) cursor = item.end;
  }
  if (cursor < bed) gap(cursor, bed);
  return out;
}

/** The routine blocks on a date, from the template in effect (school-days blocks only on school days). */
export function routineOn(src: Pick<PlanSources, 'templates' | 'blocks' | 'semesters' | 'calendars'>, date: string): PlanItem[] {
  const template = activeTemplate(src.templates, date);
  if (!template) return [];
  const weekday = dayOfWeek(date);
  const schoolDay = isSchoolDay(src.semesters, date);
  const colorOf = (id: string | null) => (id ? (src.calendars.find((c) => c.id === id)?.color ?? NEUTRAL) : NEUTRAL);
  return src.blocks
    .filter((b) => b.templateId === template.id && b.weekday === weekday && (!b.schoolDaysOnly || schoolDay))
    .map((b) => ({ key: `routine:${b.id}@${date}`, kind: 'routine', ...spanOn(date, b.start, b.end), title: b.title, calendarId: b.calendarId, color: b.priority === 'free' ? null : colorOf(b.calendarId), priority: b.priority, focus: b.focus, soundtrack: b.soundtrack, altTitle: b.altTitle, sourceId: b.id }));
}

/** Everything planned on a date: the routine (if a template covers it), classes, events and time set aside for to-dos, with Open time in the gaps. Overlaps sit side by side. */
export function planDay(src: PlanSources, date: string): DayPlan {
  const template = activeTemplate(src.templates, date);
  const { wake, bed } = dayBounds(template, date);
  const colorOf = (id: string | null) => (id ? (src.calendars.find((c) => c.id === id)?.color ?? null) : null);
  const plain = { priority: null, focus: false, soundtrack: null, altTitle: null };
  const items: PlanItem[] = routineOn(src, date);

  // From midnight to bedtime, so a free night's late events belong to this day too.
  const dayStart = combine(date);
  const nextMidnight = combine(addDays(date, 1));
  const dayEnd = bed > nextMidnight ? bed : nextMidnight;
  const occurrences = expandOccurrences(src.events, dayStart, dayEnd);
  for (const o of occurrences) {
    if (o.allDay) continue;
    const e = o.event;
    items.push({ ...plain, key: `event:${o.key}`, kind: e.courseId ? 'class' : 'event', start: o.start, end: o.end, title: e.title, calendarId: e.calendarId, color: e.color ?? colorOf(e.calendarId) ?? NEUTRAL, sourceId: o.key });
  }

  const tasks = new Map(src.tasks.map((t) => [t.id, t]));
  for (const b of src.timeBlocks) {
    const task = tasks.get(b.taskId);
    if (!task || b.start >= dayEnd || b.end <= dayStart) continue;
    items.push({ ...plain, key: `task:${b.id}`, kind: 'task', start: b.start, end: b.end, title: task.title, calendarId: task.calendarId, color: colorOf(task.calendarId) ?? NEUTRAL, sourceId: b.id });
  }

  items.sort(byStart);
  const open = template ? openGaps(items, wake, bed) : [];
  return { date, templateId: template?.id ?? null, wake, bed, items: [...items, ...open].sort(byStart), allDay: occurrences.filter((o) => o.allDay) };
}

const RANK: Record<RoutinePriority, number> = { commitment: 0, high: 1, normal: 2, free: 3 };

/** For each block that a stronger block overlaps on the same day of the same template: the strongest one (it keeps the slot). */
export function strongerOverlaps(blocks: readonly RoutineBlock[]): Map<string, RoutineBlock> {
  const out = new Map<string, RoutineBlock>();
  const span = (b: RoutineBlock) => spanOn('2001-01-01', b.start, b.end);
  for (const a of blocks) {
    const sa = span(a);
    for (const b of blocks) {
      if (b.templateId !== a.templateId || b.weekday !== a.weekday || RANK[b.priority] >= RANK[a.priority]) continue;
      const sb = span(b);
      const best = out.get(a.id);
      if (sa.start < sb.end && sb.start < sa.end && (!best || RANK[b.priority] < RANK[best.priority])) out.set(a.id, b);
    }
  }
  return out;
}
