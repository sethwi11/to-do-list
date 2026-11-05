import { addDays, addMinutes, combine, datePart, dayOfWeek, minutesBetween, timePart, type EventRecurrence } from '@todo/shared';

/*
 * The edit form's values, and the conversions between them and what is stored. Kept apart from
 * the component so the fiddly parts (all-day end dates, repeat rules) can be tested.
 */

export type Repeat = 'none' | EventRecurrence['freq'];

export interface TimeFields {
  allDay: boolean;
  startDate: string;
  startTime: string;
  /** For an all-day event this is the LAST day (inclusive), which is how people think of it. */
  endDate: string;
  endTime: string;
}

/** Stored start/end -> form fields. */
export function toTimeFields(start: string, end: string, allDay: boolean): TimeFields {
  if (allDay) {
    // Stored all-day ends are exclusive (midnight after the last day): show the last day itself.
    return { allDay, startDate: datePart(start), startTime: '09:00', endDate: addDays(datePart(end), -1), endTime: '10:00' };
  }
  return { allDay, startDate: datePart(start), startTime: timePart(start), endDate: datePart(end), endTime: timePart(end) };
}

/** Form fields -> stored start/end (an all-day end becomes exclusive again). */
export function fromTimeFields(f: TimeFields): { start: string; end: string } {
  if (f.allDay) return { start: combine(f.startDate), end: combine(addDays(f.endDate, 1)) };
  return { start: combine(f.startDate, f.startTime), end: combine(f.endDate, f.endTime) };
}

/** A message if the times don't make sense, else null. */
export function timeProblem(f: TimeFields): string | null {
  if (!f.startDate || !f.endDate) return 'Choose a start and end date.';
  if (!f.allDay && (!f.startTime || !f.endTime)) return 'Choose a start and end time.';
  const { start, end } = fromTimeFields(f);
  return end > start ? null : f.allDay ? 'The last day can’t be before the first day.' : 'The end must be after the start.';
}

/** The person moved the start: move the end with it, keeping the event the same length. */
export function withNewStart(f: TimeFields, startDate: string, startTime: string): TimeFields {
  if (!startDate) return { ...f, startDate, startTime };
  if (f.allDay) {
    const length = f.startDate && f.endDate ? Math.max(0, Math.round(minutesBetween(combine(f.startDate), combine(f.endDate)) / 1440)) : 0;
    return { ...f, startDate, startTime, endDate: addDays(startDate, length) };
  }
  const oldStart = combine(f.startDate || startDate, f.startTime || startTime || '00:00');
  const oldEnd = combine(f.endDate || startDate, f.endTime || startTime || '00:00');
  const length = minutesBetween(oldStart, oldEnd);
  const end = addMinutes(combine(startDate, startTime || '00:00'), length > 0 ? length : 60);
  return { ...f, startDate, startTime, endDate: datePart(end), endTime: timePart(end) };
}

export interface RepeatFields {
  repeat: Repeat;
  /** Weekdays (0 = Sunday) for a weekly repeat. */
  weekdays: number[];
  /** Last date it repeats on, or '' to repeat forever. */
  until: string;
}

export function toRepeatFields(rule: EventRecurrence | null, startDate: string): RepeatFields {
  if (!rule) return { repeat: 'none', weekdays: [dayOfWeek(startDate)], until: '' };
  return { repeat: rule.freq, weekdays: rule.byWeekday ?? [dayOfWeek(startDate)], until: rule.until ?? '' };
}

/**
 * Repeat fields -> a stored rule (or null for "never"). `exdates` (removed dates) carry over from
 * the existing rule. A weekly repeat on just the start date's weekday is stored without a weekday
 * list, so it keeps following the start date if that moves.
 */
export function fromRepeatFields(f: RepeatFields, startDate: string, exdates: string[] = []): EventRecurrence | null {
  if (f.repeat === 'none') return null;
  const own = f.weekdays.length === 1 && f.weekdays[0] === dayOfWeek(startDate);
  return {
    freq: f.repeat,
    byWeekday: f.repeat === 'weekly' && !own && f.weekdays.length > 0 ? [...f.weekdays].sort((a, b) => a - b) : null,
    until: f.until || null,
    exdates,
  };
}

export const sameRepeat = (a: RepeatFields, b: RepeatFields, startDate: string): boolean => {
  const x = fromRepeatFields(a, startDate);
  const y = fromRepeatFields(b, startDate);
  return JSON.stringify(x) === JSON.stringify(y);
};

/** Links must be http(s). Typing "zoom.us/j/123" gets https:// added; anything else is rejected. Returns [link, problem]. */
export function normalizeLink(raw: string): [string | null, string | null] {
  const text = raw.trim();
  if (!text) return [null, null];
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol === 'http:' || url.protocol === 'https:') return [url.toString(), null];
  } catch {
    /* fall through */
  }
  return [null, 'Enter a web link, like https://zoom.us/j/123.'];
}
