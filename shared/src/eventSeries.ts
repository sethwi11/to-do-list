import { addDays, dayOfWeek, lastDayOfMonth } from './dateMath';
import { addMinutes, combine, datePart, daysBetween, minutesBetween, timePart } from './dateTime';
import type { CreateEventInput, Event, EventRecurrence } from './models/events';

// Repeating events.

export type EditScope = 'this' | 'following' | 'all';

/** One thing on the calendar: a one-off event, a single date of a series, or an override. */
export interface EventOccurrence {
  /** Stable id for this occurrence: the event's own id, or "<series id>@<date>" for a date of a series. */
  key: string;
  /** The stored row it comes from (the series itself, for a date of a series). */
  event: Event;
  /** The series this belongs to (also set for an override), or null for a one-off event. */
  seriesId: string | null;
  start: string;
  end: string;
  allDay: boolean;
  /** For anything in a series: the date its slot was scheduled for, even if an override moved it. */
  slotDate: string | null;
  isRecurring: boolean;
  isOverride: boolean;
}

const FAR_FUTURE = '9999-12-31';
const DAY_CAP = 2000; // a runaway range can't hang the app

/** Accepts a date or a datetime and returns a datetime. */
const asDateTime = (v: string) => (v.length === 10 ? combine(v) : v);
const overlaps = (start: string, end: string, from: string, to: string) => start < to && end > from;

/** Whether `date` is one of the dates the rule produces (ignoring exdates and overrides). */
export function ruleMatches(rule: EventRecurrence, seriesStartDate: string, date: string): boolean {
  if (date < seriesStartDate) return false;
  const dow = dayOfWeek(date);
  switch (rule.freq) {
    case 'daily':
      return true;
    case 'weekdays':
      return dow >= 1 && dow <= 5;
    case 'weekly':
      return (rule.byWeekday ?? [dayOfWeek(seriesStartDate)]).includes(dow);
    case 'monthly': {
      // "The 31st" falls on the last day of shorter months, instead of vanishing from them.
      const wanted = Number(seriesStartDate.slice(8, 10));
      const monthLength = Number(lastDayOfMonth(date).slice(8, 10));
      return Number(date.slice(8, 10)) === Math.min(wanted, monthLength);
    }
  }
}

/** The first date a series actually occurs on (a weekly Mon/Wed/Fri series that starts on a Tuesday first occurs on Wednesday). */
export function firstOccurrenceDate(series: Event): string {
  const rule = series.recurrence;
  const startDate = datePart(series.start);
  if (!rule) return startDate;
  for (let i = 0; i < 400; i++) {
    const date = addDays(startDate, i);
    if (ruleMatches(rule, startDate, date)) return date;
  }
  return startDate;
}

function expandSeries(series: Event, from: string, to: string, replaced: Set<string>): EventOccurrence[] {
  const rule = series.recurrence!;
  const startDate = datePart(series.start);
  const time = timePart(series.start);
  const duration = minutesBetween(series.start, series.end);
  // A multi-day occurrence that began before the range can still reach into it.
  const first = [startDate, addDays(datePart(from), -Math.ceil(duration / 1440))].reduce((a, b) => (a > b ? a : b));
  const last = [rule.until ?? FAR_FUTURE, datePart(to)].reduce((a, b) => (a < b ? a : b));
  const skipped = new Set([...rule.exdates, ...replaced]);

  const out: EventOccurrence[] = [];
  let date = first;
  for (let n = 0; date <= last && n < DAY_CAP; n++, date = addDays(date, 1)) {
    if (skipped.has(date) || !ruleMatches(rule, startDate, date)) continue;
    const start = combine(date, time);
    const end = addMinutes(start, duration);
    if (!overlaps(start, end, from, to)) continue;
    out.push({ key: `${series.id}@${date}`, event: series, seriesId: series.id, start, end, allDay: series.allDay, slotDate: date, isRecurring: true, isOverride: false });
  }
  return out;
}

/** Every occurrence that overlaps [rangeStart, rangeEnd), sorted by start. */
export function expandOccurrences(events: Event[], rangeStart: string, rangeEnd: string): EventOccurrence[] {
  const from = asDateTime(rangeStart);
  const to = asDateTime(rangeEnd);
  const seriesIds = new Set(events.filter((e) => e.recurrence).map((e) => e.id));

  // seriesId -> the dates whose slot an override has taken over
  const replaced = new Map<string, Set<string>>();
  for (const e of events) {
    if (e.recurringEventId && e.originalStart && seriesIds.has(e.recurringEventId)) {
      const dates = replaced.get(e.recurringEventId) ?? new Set<string>();
      dates.add(datePart(e.originalStart));
      replaced.set(e.recurringEventId, dates);
    }
  }

  const out: EventOccurrence[] = [];
  for (const e of events) {
    if (e.recurrence) {
      out.push(...expandSeries(e, from, to, replaced.get(e.id) ?? new Set()));
    } else if (overlaps(e.start, e.end, from, to)) {
      // An override whose series is gone is treated as an ordinary event.
      const linked = e.recurringEventId !== null && seriesIds.has(e.recurringEventId);
      out.push({
        key: e.id,
        event: e,
        seriesId: linked ? e.recurringEventId : null,
        start: e.start,
        end: e.end,
        allDay: e.allDay,
        slotDate: linked && e.originalStart ? datePart(e.originalStart) : null,
        isRecurring: linked,
        isOverride: linked,
      });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.event.title.localeCompare(b.event.title));
}

// ---------------------------------------------------------------------------------------------
// Editing and deleting
// ---------------------------------------------------------------------------------------------

/** Any editable field of an event. */
export type EventChanges = Partial<Omit<Event, 'id' | 'createdAt' | 'updatedAt' | 'recurringEventId' | 'originalStart'>>;

/** Rows to write (inserted, or replaced if the id exists) and ids to delete, applied together or not at all. */
export interface BatchPlan {
  put: Event[];
  remove: string[];
}

interface PlanContext {
  /** Every event row (the plan needs the series' overrides). */
  events: Event[];
  occurrence: EventOccurrence;
  scope: EditScope;
  /** ISO timestamp for createdAt / updatedAt. */
  now: string;
  newId: () => string;
}

const EMPTY: BatchPlan = { put: [], remove: [] };

function seriesOf(ctx: PlanContext): Event | undefined {
  return ctx.occurrence.seriesId ? ctx.events.find((e) => e.id === ctx.occurrence.seriesId && e.recurrence) : undefined;
}

const overridesOf = (events: Event[], seriesId: string) => events.filter((e) => e.recurringEventId === seriesId && !e.recurrence);

/** Fill in a full Event row from a create request (the same defaults the server uses). */
export function buildEvent(input: CreateEventInput, id: string, now: string): Event {
  return {
    id,
    title: input.title,
    start: input.start,
    end: input.end,
    allDay: input.allDay ?? false,
    calendarId: input.calendarId ?? null,
    typeId: input.typeId ?? null,
    location: input.location ?? null,
    link: input.link ?? null,
    notes: input.notes ?? null,
    color: input.color ?? null,
    reminderMinutes: input.reminderMinutes ?? null,
    recurrence: input.recurrence ?? null,
    recurringEventId: input.recurringEventId ?? null,
    originalStart: input.originalStart ?? null,
    courseId: input.courseId ?? null,
    applicationId: input.applicationId ?? null,
    source: input.source ?? 'manual',
    createdAt: now,
    updatedAt: now,
  };
}

/** The occurrence's new times, from whichever of start / end the change supplied. */
function newTimes(occ: EventOccurrence, changes: EventChanges) {
  const duration = minutesBetween(occ.start, occ.end);
  const start = changes.start ?? occ.start;
  const end = changes.end ?? (changes.start ? addMinutes(start, duration) : occ.end);
  return { start, end, allDay: changes.allDay ?? occ.allDay };
}

/** `changes` without the fields that describe time and repetition, which are handled separately. */
function plainFields({ start: _s, end: _e, allDay: _a, recurrence: _r, ...rest }: EventChanges) {
  return rest;
}

function shiftRule(rule: EventRecurrence, days: number): EventRecurrence {
  if (days === 0) return rule;
  return {
    ...rule,
    byWeekday: rule.byWeekday ? [...new Set(rule.byWeekday.map((d) => (((d + days) % 7) + 7) % 7))].sort() : null,
    until: rule.until ? addDays(rule.until, days) : null,
    exdates: rule.exdates.map((d) => addDays(d, days)),
  };
}

/** The series fields after the edit, for "all" and "this and following". */
function changedSeries(base: Event, anchor: string, ctx: PlanContext, changes: EventChanges, rule: EventRecurrence | null) {
  const occ = ctx.occurrence;
  const times = newTimes(occ, changes);
  const timesChanged = changes.start !== undefined || changes.end !== undefined;
  const delta = minutesBetween(occ.start, times.start);
  const duration = timesChanged ? minutesBetween(times.start, times.end) : minutesBetween(base.start, base.end);
  const start = addMinutes(anchor, delta);
  const shiftedDays = daysBetween(datePart(anchor), datePart(start));
  // If the person edited the repeat rule themselves, use it as given. Otherwise carry the old rule along with the move.
  const nextRule = changes.recurrence !== undefined ? changes.recurrence : rule ? shiftRule(rule, shiftedDays) : null;
  return {
    fields: { ...base, ...plainFields(changes), start, end: addMinutes(start, duration), allDay: times.allDay, recurrence: nextRule },
    shiftedDays: changes.recurrence !== undefined ? 0 : shiftedDays,
  };
}

/** Re-point (and, if the series moved, re-date) the overrides that go with a changed series. */
function carryOverrides(overrides: Event[], seriesId: string, shiftedDays: number, now: string): Event[] {
  return overrides.map((o) => ({
    ...o,
    recurringEventId: seriesId,
    originalStart: o.originalStart && shiftedDays !== 0 ? combine(addDays(datePart(o.originalStart), shiftedDays), timePart(o.originalStart)) : o.originalStart,
    updatedAt: now,
  }));
}

/** Turn "change this occurrence like so, for this / this and following / all" into rows to write. */
export function planEventEdit(ctx: PlanContext & { changes: EventChanges }): BatchPlan {
  const { occurrence: occ, changes, now } = ctx;
  const times = newTimes(occ, changes);

  // A one-off event (or an override edited by itself): just change the row.
  if (!occ.isRecurring || (occ.isOverride && ctx.scope === 'this')) {
    const row = occ.event;
    const recurrence = occ.isRecurring ? row.recurrence : (changes.recurrence ?? row.recurrence);
    return { put: [{ ...row, ...plainFields(changes), ...times, recurrence, updatedAt: now }], remove: [] };
  }

  const series = seriesOf(ctx);
  if (!series || !series.recurrence) return EMPTY;
  const slotDate = occ.slotDate!;
  const seriesTime = timePart(series.start);

  // "This and following" on the very first occurrence is the same as "all".
  const scope: EditScope = ctx.scope === 'following' && slotDate <= firstOccurrenceDate(series) ? 'all' : ctx.scope;

  if (scope === 'this') {
    const override: Event = {
      ...series,
      ...plainFields(changes),
      ...times,
      id: ctx.newId(),
      recurrence: null,
      recurringEventId: series.id,
      originalStart: combine(slotDate, series.allDay ? '00:00' : seriesTime),
      createdAt: now,
      updatedAt: now,
    };
    return { put: [override], remove: [] };
  }

  const overrides = overridesOf(ctx.events, series.id);

  if (scope === 'all') {
    const { fields, shiftedDays } = changedSeries(series, series.start, ctx, changes, series.recurrence);
    if (fields.recurrence === null) {
      // The series stops repeating, so its exceptions have nothing left to be exceptions to.
      return { put: [{ ...fields, updatedAt: now }], remove: overrides.map((o) => o.id) };
    }
    return { put: [{ ...fields, updatedAt: now }, ...carryOverrides(overrides, series.id, shiftedDays, now)], remove: [] };
  }

  // scope === 'following': end the old series the day before, and start a new one from this date.
  const rule = series.recurrence;
  const truncated: Event = {
    ...series,
    recurrence: { ...rule, until: addDays(slotDate, -1), exdates: rule.exdates.filter((d) => d < slotDate) },
    updatedAt: now,
  };
  const newSeriesId = ctx.newId();
  const carriedRule: EventRecurrence = { ...rule, exdates: rule.exdates.filter((d) => d >= slotDate) };
  const anchor = combine(slotDate, seriesTime);
  const { fields, shiftedDays } = changedSeries(series, anchor, ctx, changes, carriedRule);
  const next: Event = { ...fields, id: newSeriesId, createdAt: now, updatedAt: now };
  const later = overrides.filter((o) => o.originalStart && datePart(o.originalStart) >= slotDate);
  return { put: [truncated, next, ...carryOverrides(later, newSeriesId, shiftedDays, now)], remove: [] };
}

/** Turn "delete this occurrence, for this / this and following / all" into rows to write. */
export function planEventDelete(ctx: PlanContext): BatchPlan {
  const { occurrence: occ, now } = ctx;

  if (!occ.isRecurring) return { put: [], remove: [occ.event.id] };

  const series = seriesOf(ctx);
  if (!series || !series.recurrence) return { put: [], remove: [occ.event.id] };
  const rule = series.recurrence;
  const slotDate = occ.slotDate!;
  const overrides = overridesOf(ctx.events, series.id);
  const scope: EditScope = ctx.scope === 'following' && slotDate <= firstOccurrenceDate(series) ? 'all' : ctx.scope;

  if (scope === 'all') return { put: [], remove: [series.id, ...overrides.map((o) => o.id)] };

  if (scope === 'this') {
    const withDate: Event = { ...series, recurrence: { ...rule, exdates: [...new Set([...rule.exdates, slotDate])].sort() }, updatedAt: now };
    // An override is deleted along with its slot, or the original occurrence would reappear in its place.
    return { put: [withDate], remove: occ.isOverride ? [occ.event.id] : [] };
  }

  const truncated: Event = { ...series, recurrence: { ...rule, until: addDays(slotDate, -1), exdates: rule.exdates.filter((d) => d < slotDate) }, updatedAt: now };
  const later = overrides.filter((o) => o.originalStart && datePart(o.originalStart) >= slotDate);
  return { put: [truncated], remove: later.map((o) => o.id) };
}

/** What it takes to undo `plan`: put back the rows it replaced or deleted, remove the rows it created. */
export function invertPlan(plan: BatchPlan, before: Event[]): BatchPlan {
  const byId = new Map(before.map((e) => [e.id, e]));
  const restore = [...plan.put.map((e) => e.id), ...plan.remove].flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  return { put: restore, remove: plan.put.filter((e) => !byId.has(e.id)).map((e) => e.id) };
}

/** Apply a plan to a list of rows in memory (what the server does to the database). */
export function applyPlan(events: Event[], plan: BatchPlan): Event[] {
  const removed = new Set(plan.remove);
  const put = new Map(plan.put.map((e) => [e.id, e]));
  const kept = events.filter((e) => !removed.has(e.id)).map((e) => put.get(e.id) ?? e);
  const added = plan.put.filter((e) => !events.some((x) => x.id === e.id) && !removed.has(e.id));
  return [...kept, ...added];
}
