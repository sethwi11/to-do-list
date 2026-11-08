import ICAL from 'ical.js';
import { addDays, dayOfWeek } from './dateMath';
import { addMinutes, combine } from './dateTime';
import { findLink, guessEventType, type ExtractedItem } from './eventExtractor';
import type { EventRecurrence } from './models/events';

// Importing a .ics calendar file (Google Calendar, Outlook, Canvas, Apple Calendar...).

/** How far ahead a repeat that can't be stored is written out. */
const EXPAND_DAYS = 365;
const EXPAND_CAP = 120;
/** Anything that ended longer ago than this is left out: old calendars hold years of history nobody wants to review. */
const KEEP_PAST_DAYS = 7;
const MAX_ITEMS = 500;

export interface IcsResult {
  items: ExtractedItem[];
  /** Events left out because they are over. */
  skippedOld: number;
  /** More events than fit in one review. */
  truncated: boolean;
  /** Things worth telling the person ("repeats every 2 weeks, so it was added as separate events"). */
  notes: string[];
}

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** A point in the file as a local datetime. An all-day date has no time zone and is read as written. */
function local(t: ICAL.Time): string {
  if (t.isDate) return combine(`${t.year}-${pad(t.month)}-${pad(t.day)}`);
  return stamp(t.toJSDate());
}

const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** The planner's version of a repeat rule, or null if it can't be stored faithfully. */
function mapRule(rule: ICAL.Recur, firstStart: ICAL.Time, startDate: string): EventRecurrence | null {
  if ((rule.interval ?? 1) !== 1) return null;
  for (const unsupported of ['BYMONTH', 'BYSETPOS', 'BYYEARDAY', 'BYWEEKNO', 'BYHOUR', 'BYMINUTE', 'BYSECOND']) {
    if ((rule.getComponent(unsupported) as unknown[]).length > 0) return null;
  }
  const byDay = rule.getComponent('BYDAY') as string[];
  const byMonthDay = rule.getComponent('BYMONTHDAY') as number[];

  let freq: EventRecurrence['freq'];
  let byWeekday: number[] | null = null;
  switch (rule.freq) {
    case 'DAILY':
      if (byDay.length || byMonthDay.length) return null;
      freq = 'daily';
      break;
    case 'WEEKLY': {
      if (byMonthDay.length) return null;
      const days = byDay.map((d) => WEEKDAY_CODES.indexOf(d));
      if (days.some((d) => d === -1)) return null; // "1MO" and the like
      const set = [...new Set(days)].sort();
      if (set.join() === '1,2,3,4,5') freq = 'weekdays';
      else {
        freq = 'weekly';
        byWeekday = set.length === 0 || (set.length === 1 && set[0] === dayOfWeek(startDate)) ? null : set;
      }
      break;
    }
    case 'MONTHLY':
      if (byDay.length) return null;
      if (byMonthDay.length > 1 || (byMonthDay.length === 1 && byMonthDay[0] !== Number(startDate.slice(8, 10)))) return null;
      freq = 'monthly';
      break;
    default:
      return null; // yearly, hourly...
  }

  let until: string | null = null;
  if (rule.until) until = local(rule.until).slice(0, 10);
  else if (rule.count) {
    // "10 times": the planner stores an end date, so find the date of the 10th.
    const it = rule.iterator(firstStart);
    let last: ICAL.Time | null = null;
    for (let i = 0; i < rule.count; i++) last = it.next() ?? last;
    if (last) until = local(last).slice(0, 10);
  }
  return { freq, byWeekday, until, exdates: [] };
}

/** Read a calendar file's text. */
export function importIcs(text: string, { now }: { now: Date }): IcsResult {
  let root: ICAL.Component;
  try {
    root = new ICAL.Component(ICAL.parse(text));
    if (root.name !== 'vcalendar') throw new Error('not a calendar');
  } catch {
    throw new Error("That doesn't look like a calendar (.ics) file.");
  }

  // Events can say "2 PM in America/New_York"; the file carries the rules for that zone. Start from a clean slate each time.
  ICAL.TimezoneService.reset();
  for (const vtz of root.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(vtz);

  const nowText = stamp(now);
  const cutoff = combine(addDays(nowText.slice(0, 10), -KEEP_PAST_DAYS));
  const horizon = combine(addDays(nowText.slice(0, 10), EXPAND_DAYS));
  const all = root.getAllSubcomponents('vevent').map((c) => new ICAL.Event(c));
  const overridesOf = (uid: string) => all.filter((e) => e.uid === uid && e.recurrenceId);

  const items: ExtractedItem[] = [];
  const notes: string[] = [];
  let skippedOld = 0;

  const push = (e: ICAL.Event, start: string, end: string, allDay: boolean, recurrence?: EventRecurrence) => {
    const title = (e.summary || '').trim() || 'Untitled';
    const description = (e.description || '').trim();
    const location = (e.location || '').trim();
    const link = findLink([location, description, String(e.component.getFirstPropertyValue('url') ?? '')]);
    const fixedEnd = end > start ? end : allDay ? combine(addDays(start.slice(0, 10), 1)) : addMinutes(start, 60);
    items.push({
      id: String(items.length),
      title: title.slice(0, 200),
      start,
      end: fixedEnd,
      allDay,
      typeName: guessEventType(title, ''),
      location: location ? location.slice(0, 300) : null,
      link,
      confidence: 1,
      lowConfidence: false,
      snippet: description.replace(/\s+/g, ' ').slice(0, 300),
      charStart: 0,
      charEnd: 0,
      isDeadline: false,
      past: start < nowText,
      notes: description ? description.slice(0, 20_000) : null,
      ...(recurrence ? { recurrence } : {}),
    });
  };

  for (const e of all.filter((x) => !x.recurrenceId)) {
    if (!e.startDate) continue;
    const allDay = e.startDate.isDate;
    const start = local(e.startDate);
    const end = e.endDate ? local(e.endDate) : start;

    if (!e.isRecurring()) {
      if (end < cutoff) skippedOld++;
      else push(e, start, end, allDay);
      continue;
    }

    const rrules = e.component.getAllProperties('rrule');
    const rule = rrules.length === 1 ? mapRule(rrules[0]!.getFirstValue() as ICAL.Recur, e.startDate, start.slice(0, 10)) : null;
    const overrides = overridesOf(e.uid);

    if (rule) {
      if (rule.until && combine(rule.until) < cutoff) {
        skippedOld++;
        continue;
      }
      // Removed dates, plus the dates of any occurrence the file changed (those come in as their own events, below).
      const removed = e.component.getAllProperties('exdate').flatMap((p) => p.getValues() as ICAL.Time[]).map((t) => local(t).slice(0, 10));
      const changed = overrides.map((o) => local(o.recurrenceId).slice(0, 10));
      rule.exdates = [...new Set([...removed, ...changed])].sort();
      push(e, start, end, allDay, rule);
      for (const o of overrides) if (o.startDate) push(o, local(o.startDate), o.endDate ? local(o.endDate) : local(o.startDate), o.startDate.isDate);
      continue;
    }

    // A repeat the planner can't store: write out the next year of it as separate events.
    for (const o of overrides) e.relateException(o);
    const it = e.iterator();
    let added = 0;
    for (let occ = it.next(); occ && added < EXPAND_CAP; occ = it.next()) {
      const d = e.getOccurrenceDetails(occ);
      const s = local(d.startDate);
      if (s > horizon) break;
      const en = local(d.endDate);
      if (en < cutoff) continue;
      push(d.item, s, en, d.startDate.isDate);
      added++;
    }
    if (added > 0) notes.push(`“${(e.summary || 'Untitled').trim()}” repeats in a way the planner can’t store, so its next ${added} dates were added as separate events.`);
    else skippedOld++;
  }

  const truncated = items.length > MAX_ITEMS;
  const kept = items.sort((a, b) => a.start.localeCompare(b.start)).slice(0, MAX_ITEMS).map((it, i) => ({ ...it, id: String(i) }));
  return { items: kept, skippedOld, truncated, notes };
}
