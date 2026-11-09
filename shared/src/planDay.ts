import { inRanges } from './classSchedule';
import { addDays, dayOfWeek } from './dateMath';
import { addMinutes, combine, datePart, minutesBetween } from './dateTime';
import { expandOccurrences, type EventOccurrence } from './eventSeries';
import type { Calendar } from './models/calendars';
import type { Semester } from './models/courses';
import type { Event, TimeBlock } from './models/events';
import type { RoutineBlock, RoutineOverride, RoutinePriority, WeekTemplate } from './models/routine';
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
  altCalendarId: string | null;
  /** The routine block, event occurrence key or time block it came from. */
  sourceId: string | null;
  /** "trimmed" when an event or a stronger block took part of it. */
  status: 'planned' | 'trimmed';
  /** An event or class: the routine blocks it took over completely ("replaces Volleyball"). */
  replaces: string[];
  /** An event or class over a commitment, which is never replaced automatically: the commitments it clashes with. */
  clashes: string[];
  /** A make-up for time bumped on another day. */
  makeup: boolean;
  /** Routine blocks this one covers completely today (shown as "+1 hidden"; they come back if this one is skipped). */
  hidden: string[];
}

export interface DayPlan {
  date: string;
  templateId: string | null;
  wake: string;
  bed: string;
  /** Timed items, in order. */
  items: PlanItem[];
  allDay: EventOccurrence[];
  /** Routine time taken today by events, skips and replacements (free time isn't counted). */
  bumped: Bump[];
}

export interface PlanSources {
  templates: readonly WeekTemplate[];
  blocks: readonly RoutineBlock[];
  semesters: readonly Semester[];
  events: Event[];
  timeBlocks: readonly TimeBlock[];
  tasks: readonly Task[];
  calendars: readonly Pick<Calendar, 'id' | 'color'>[];
  overrides: readonly RoutineOverride[];
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
      out.push({ key: `open:${start}`, kind: 'open', start, end, title: 'Open', calendarId: null, color: null, priority: null, focus: false, soundtrack: null, altTitle: null, altCalendarId: null, sourceId: null, status: 'planned', replaces: [], clashes: [], makeup: false, hidden: [] });
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

const RANK: Record<RoutinePriority, number> = { commitment: 0, high: 1, normal: 2, free: 3 };

/** The template is drawn on one fixed week (Monday 2001-01-01): the date standing for a weekday. */
export const refDate = (weekday: number) => addDays('2001-01-01', (weekday + 6) % 7);

/** A class from Courses on the template's week. */
export interface ClassSlot {
  key: string;
  title: string;
  weekday: number;
  start: string;
  end: string;
}

/** The template as drawn on the Week page: the stronger block keeps an overlap and covered parts disappear (pieces under 15 minutes dropped). Classes aren't part of this: a class and a block that share time sit side by side. Returns each block's visible pieces, and the ids of the blocks each block hides completely. */
export function layoutTemplate(blocks: readonly RoutineBlock[]): { pieces: Map<string, { start: string; end: string }[]>; hides: Map<string, string[]> } {
  const pieces = new Map<string, { start: string; end: string }[]>();
  const hides = new Map<string, string[]>();
  for (let w = 0; w < 7; w++) {
    const date = refDate(w);
    const kept: { key: string; start: string; end: string; rank: number }[] = [];
    for (const b of blocks.filter((x) => x.weekday === w).sort((a, z) => RANK[a.priority] - RANK[z.priority])) {
      const rank = RANK[b.priority];
      const span = spanOn(date, b.start, b.end);
      const stronger = kept.filter((k) => k.rank < rank);
      const visible = subtract(span, stronger).pieces;
      pieces.set(b.id, visible);
      if (visible.length === 0) {
        const winner = mostOverlap(span, stronger);
        if (winner) hides.set(winner.key, [...(hides.get(winner.key) ?? []), b.id]);
      }
      kept.push(...visible.map((p) => ({ key: b.id, ...p, rank })));
    }
  }
  return { pieces, hides };
}

/** Classes that overlap a template block every week: one notice per class and block title, with the weekdays and both times. */
export interface WeeklyClash {
  classTitle: string;
  blockTitle: string;
  blockIds: string[];
  weekdays: number[];
  classStart: string;
  classEnd: string;
}

export function weeklyClashes(blocks: readonly RoutineBlock[], classes: readonly ClassSlot[]): WeeklyClash[] {
  const out: WeeklyClash[] = [];
  for (const c of classes) {
    for (const b of blocks) {
      if (b.weekday !== c.weekday || b.priority === 'free') continue;
      const date = refDate(b.weekday);
      if (overlapMinutes(spanOn(date, b.start, b.end), spanOn(date, c.start, c.end)) === 0) continue;
      const same = out.find((x) => x.classTitle === c.title && x.blockTitle === b.title && x.classStart === c.start);
      if (same) {
        same.blockIds.push(b.id);
        same.weekdays.push(b.weekday);
      } else out.push({ classTitle: c.title, blockTitle: b.title, blockIds: [b.id], weekdays: [b.weekday], classStart: c.start, classEnd: c.end });
    }
  }
  return out;
}

/** New times for a block so it clears a class: the longest piece left (if 30 minutes or more), else the same length right after the class, else right before it, whichever doesn't hit another class that day. null when nothing fits. */
export function fitAround(block: Pick<RoutineBlock, 'start' | 'end'>, cls: { start: string; end: string }, otherClasses: readonly { start: string; end: string }[] = []): { start: string; end: string } | null {
  const date = '2001-01-01';
  const span = spanOn(date, block.start, block.end);
  const c = spanOn(date, cls.start, cls.end);
  const length = minutesBetween(span.start, span.end);
  const longest = subtract(span, [c]).pieces.sort((a, b) => minutesBetween(b.start, b.end) - minutesBetween(a.start, a.end))[0];
  const candidates = [
    ...(longest && minutesBetween(longest.start, longest.end) >= 30 ? [longest] : []),
    { start: c.end, end: addMinutes(c.end, length) },
    { start: addMinutes(c.start, -length), end: c.start },
  ];
  const others = otherClasses.map((o) => spanOn(date, o.start, o.end));
  const fit = candidates.find((s) => datePart(s.start) === date && others.every((o) => overlapMinutes(s, o) === 0));
  return fit ? { start: fit.start.slice(11), end: fit.end.slice(11) } : null;
}
/** Whether time taken from a block can be made up elsewhere: its setting, and never free time. */
const canReschedule = (b: RoutineBlock | undefined) => !!b && b.reschedulable && b.priority !== 'free';

/** A leftover piece of a cut block shorter than this is dropped. */
export const MIN_PIECE_MINUTES = 15;

/** Time an event (or a skip or replace) took from a routine block on one day. */
export interface Bump {
  blockId: string;
  date: string;
  title: string;
  calendarId: string | null;
  minutes: number;
  how: 'skipped' | 'replaced';
  /** What replaced it (event names, or the to-do), for "replaced by ...". */
  by: string;
}

/** What's left of a span after cutting out others: the pieces long enough to keep, and how many minutes the cuts took. */
function subtract(span: { start: string; end: string }, cuts: readonly { start: string; end: string }[]): { pieces: { start: string; end: string }[]; cut: number } {
  let pieces = [{ start: span.start, end: span.end }];
  let cut = 0;
  for (const c of cuts) {
    pieces = pieces.flatMap((p) => {
      if (c.end <= p.start || c.start >= p.end) return [p];
      cut += minutesBetween(c.start > p.start ? c.start : p.start, c.end < p.end ? c.end : p.end);
      return [...(c.start > p.start ? [{ start: p.start, end: c.start }] : []), ...(c.end < p.end ? [{ start: c.end, end: p.end }] : [])];
    });
  }
  return { pieces: pieces.filter((p) => minutesBetween(p.start, p.end) >= MIN_PIECE_MINUTES), cut };
}

/** Pieces of an item keep its details, with their own key and a "trimmed" status if anything was cut. */
const piecesOf = (item: PlanItem, pieces: { start: string; end: string }[]): PlanItem[] => {
  const whole = pieces.length === 1 && pieces[0]!.start === item.start && pieces[0]!.end === item.end;
  return whole ? [item] : pieces.map((p, i) => ({ ...item, ...p, key: `${item.key}#${i}`, status: 'trimmed', hidden: [...item.hidden] }));
};

/** Of the items overlapping a span, the one covering most of it (it gets the "+1 hidden" marker). */
const mostOverlap = <T extends { start: string; end: string }>(span: { start: string; end: string }, over: readonly T[]): T | undefined =>
  [...over].sort((a, b) => overlapMinutes(span, b) - overlapMinutes(span, a))[0];
const overlapMinutes = (a: { start: string; end: string }, b: { start: string; end: string }) => Math.max(0, minutesBetween(a.start > b.start ? a.start : b.start, a.end < b.end ? a.end : b.end));

type RoutineSources = Pick<PlanSources, 'templates' | 'blocks' | 'semesters' | 'calendars' | 'overrides'>;

/** The routine on a date after its one-day changes and the template's own overlaps (the stronger block keeps the time; the covered part is hidden, not bumped). */
function routineOn(src: RoutineSources, date: string, bumped: Bump[]): PlanItem[] {
  const template = activeTemplate(src.templates, date);
  if (!template) return [];
  const weekday = dayOfWeek(date);
  const schoolDay = isSchoolDay(src.semesters, date);
  const colorOf = (id: string | null) => (id ? (src.calendars.find((c) => c.id === id)?.color ?? NEUTRAL) : NEUTRAL);
  const item = (b: RoutineBlock, span: { start: string; end: string }, key: string, makeup = false): PlanItem => ({
    key, kind: 'routine', ...span, title: b.title, calendarId: b.calendarId, color: b.priority === 'free' ? null : colorOf(b.calendarId), priority: makeup ? 'normal' : b.priority,
    focus: b.focus, soundtrack: b.soundtrack, altTitle: b.altTitle, altCalendarId: b.altCalendarId, sourceId: b.id, status: 'planned', replaces: [], clashes: [], makeup, hidden: [],
  });
  const reschedulable = (id: string | null) => canReschedule(src.blocks.find((b) => b.id === id));
  let items = src.blocks.filter((b) => b.templateId === template.id && b.weekday === weekday && (!b.schoolDaysOnly || schoolDay)).map((b) => item(b, spanOn(date, b.start, b.end), `routine:${b.id}@${date}`));

  for (const o of src.overrides.filter((x) => x.date === date)) {
    const target = items.find((i) => i.sourceId === o.routineBlockId);
    if ((o.action === 'skip' || o.action === 'replace') && target) {
      items = items.filter((i) => i !== target);
      if (reschedulable(target.sourceId)) bumped.push({ blockId: target.sourceId!, date, title: target.title, calendarId: target.calendarId, minutes: minutesBetween(target.start, target.end), how: o.action === 'skip' ? 'skipped' : 'replaced', by: o.title ?? '' });
    }
    if (o.action === 'move' && target && o.start && o.end) items = items.map((i) => (i === target ? { ...i, start: o.start!, end: o.end! } : i));
    const original = src.blocks.find((b) => b.id === o.routineBlockId);
    if (o.action === 'makeup' && original && o.start && o.end) items.push({ ...item(original, { start: o.start, end: o.end }, `makeup:${o.id}`, true), title: o.title ?? original.title });
  }

  const kept: PlanItem[] = [];
  for (const i of [...items].sort((a, b) => RANK[a.priority!] - RANK[b.priority!])) {
    const stronger = kept.filter((k) => RANK[k.priority!] < RANK[i.priority!]);
    const { pieces } = subtract(i, stronger);
    if (pieces.length === 0) mostOverlap(i, stronger)?.hidden.push(i.title);
    kept.push(...piecesOf(i, pieces));
  }
  return kept;
}

/** Everything planned on a date: the routine (if a template covers it) after one-day changes, classes and events (which take the routine time they overlap, except a commitment's), time set aside for to-dos, and Open time in the gaps. */
export function planDay(src: PlanSources, date: string): DayPlan {
  const template = activeTemplate(src.templates, date);
  const { wake, bed } = dayBounds(template, date);
  const colorOf = (id: string | null) => (id ? (src.calendars.find((c) => c.id === id)?.color ?? null) : null);
  const plain = { priority: null, focus: false, soundtrack: null, altTitle: null, altCalendarId: null, status: 'planned' as const, makeup: false };
  const reschedulable = (id: string | null) => canReschedule(src.blocks.find((b) => b.id === id));
  const bumped: Bump[] = [];
  const routine = routineOn(src, date, bumped);

  // From midnight to bedtime, so a free night's late events belong to this day too.
  const dayStart = combine(date);
  const nextMidnight = combine(addDays(date, 1));
  const dayEnd = bed > nextMidnight ? bed : nextMidnight;
  const occurrences = expandOccurrences(src.events, dayStart, dayEnd);
  const events: PlanItem[] = occurrences
    .filter((o) => !o.allDay)
    .map((o) => ({ ...plain, key: `event:${o.key}`, kind: o.event.courseId ? 'class' : 'event', start: o.start, end: o.end, title: o.event.title, calendarId: o.event.calendarId, color: o.event.color ?? colorOf(o.event.calendarId) ?? NEUTRAL, sourceId: o.key, replaces: [], clashes: [], hidden: [] }));

  // Time set aside for a to-do takes its slot from the routine too, but never counts as missed: doing homework in the Homework block is the point.
  const tasks = new Map(src.tasks.map((t) => [t.id, t]));
  const todo: PlanItem[] = src.timeBlocks.flatMap((b) => {
    const task = tasks.get(b.taskId);
    if (!task || b.start >= dayEnd || b.end <= dayStart) return [];
    return [{ ...plain, key: `task:${b.id}`, kind: 'task', start: b.start, end: b.end, title: task.title, calendarId: task.calendarId, color: colorOf(task.calendarId) ?? NEUTRAL, sourceId: b.id, replaces: [], clashes: [], hidden: [] }];
  });

  const items: PlanItem[] = [...events, ...todo];
  for (const r of routine) {
    const touching = [...events, ...todo].filter((e) => e.start < r.end && e.end > r.start);
    // A commitment is never replaced automatically: both stay, side by side, with the conflict shown.
    if (r.priority === 'commitment') {
      for (const e of touching) if (e.kind !== 'task') e.clashes.push(r.title);
      items.push(r);
      continue;
    }
    // A class doesn't cut a block either: they share the time, side by side (the Week page says when that happens every week).
    const over = touching.filter((e) => e.kind !== 'class');
    const { pieces } = subtract(r, over);
    // Only one-off events make a block "missed": a class that overlaps it every week means the template needs adjusting (the Week page says so).
    const takers = over.filter((e) => e.kind === 'event');
    const cut = subtract(r, takers).cut;
    if (cut > 0 && reschedulable(r.sourceId)) {
      const same = bumped.find((b) => b.blockId === r.sourceId && b.date === date && b.how === 'replaced');
      if (same) same.minutes += cut;
      else bumped.push({ blockId: r.sourceId!, date, title: r.title, calendarId: r.calendarId, minutes: cut, how: 'replaced', by: takers.map((e) => e.title).join(', ') });
    }
    if (pieces.length === 0) {
      for (const e of over.filter((x) => x.kind !== 'task')) e.replaces.push(r.title);
      if (over.every((x) => x.kind === 'task')) mostOverlap(r, over)?.hidden.push(r.title);
    }
    items.push(...piecesOf(r, pieces));
  }

  items.sort(byStart);
  const open = template ? openGaps(items, wake, bed) : [];
  return { date, templateId: template?.id ?? null, wake, bed, items: [...items, ...open].sort(byStart), allDay: occurrences.filter((o) => o.allDay), bumped };
}

/** Bumped time from `from` to `to` (dates, inclusive) that hasn't been made up or let go. */
export function openBumps(src: PlanSources, from: string, to: string): Bump[] {
  const resolved = new Set(src.overrides.filter((o) => (o.action === 'makeup' || o.action === 'letgo') && o.sourceDate).map((o) => `${o.routineBlockId}@${o.sourceDate}`));
  const out: Bump[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(...planDay(src, d).bumped.filter((b) => !resolved.has(`${b.blockId}@${b.date}`)));
  return out;
}

/** Open slots of `minutes` from `after` over the next `days`, earliest first, one per gap: Open time is never a class, event, commitment, high or free block. Slots inside the template's meeting windows can be put first. */
export function openSlots(src: PlanSources, minutes: number, after: string, options: { days?: number; count?: number; windowsFirst?: boolean } = {}): { start: string; end: string; inWindow: boolean }[] {
  const { days = 7, count = 3, windowsFirst = false } = options;
  const out: { start: string; end: string; inWindow: boolean }[] = [];
  for (let i = 0, d = datePart(after); i <= days; i++, d = addDays(d, 1)) {
    const windows = (activeTemplate(src.templates, d)?.meetingWindows ?? []).filter((w) => w.weekday === dayOfWeek(d)).map((w) => spanOn(d, w.start, w.end));
    for (const gap of planDay(src, d).items.filter((x) => x.kind === 'open')) {
      const from = gap.start > after ? gap.start : after;
      const window = windows.find((w) => w.end > from && w.start < gap.end && minutesBetween(w.start > from ? w.start : from, w.end < gap.end ? w.end : gap.end) >= minutes);
      const start = window && window.start > from ? window.start : from;
      if (minutesBetween(start, gap.end) >= minutes) out.push({ start, end: addMinutes(start, minutes), inWindow: !!window });
    }
  }
  const sorted = windowsFirst ? [...out.filter((s) => s.inWindow), ...out.filter((s) => !s.inWindow)] : out;
  return sorted.slice(0, count);
}


