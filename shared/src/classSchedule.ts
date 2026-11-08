import { addDays, dayOfWeek } from './dateMath';
import { combine } from './dateTime';
import type { BatchPlan } from './eventSeries';
import type { Course, ExcludedRange, Semester } from './models/courses';
import type { Event, EventRecurrence } from './models/events';

// Turning a course ("COMP 365, Mon/Wed/Fri 10:00-11:15") and its semester into calendar events.

/** Marks events made from a course, so they can be found again (and are never confused with ones the person made). */
export const CLASS_SOURCE = 'class-schedule' as const;

/** A guard so a mistyped year can't loop for centuries. */
const MAX_DAYS = 800;

export const isMeetingDay = (days: readonly number[], date: string) => days.includes(dayOfWeek(date));

/** The first date on or after `startDate` that is one of the meeting days. */
export function firstMeetingDate(startDate: string, days: readonly number[]): string {
  for (let i = 0; i < 7; i++) {
    const date = addDays(startDate, i);
    if (isMeetingDay(days, date)) return date;
  }
  return startDate;
}

export const inRanges = (date: string, ranges: readonly ExcludedRange[]) => ranges.some((r) => date >= r.start && date <= r.end);

/** Meeting-day dates inside the break ranges, between `from` and `to` (inclusive), in order. */
export function breakDates(ranges: readonly ExcludedRange[], days: readonly number[], from: string, to: string): string[] {
  const out = new Set<string>();
  for (const r of ranges) {
    const first = r.start > from ? r.start : from;
    const last = r.end < to ? r.end : to;
    for (let d = first, n = 0; d <= last && n < MAX_DAYS; d = addDays(d, 1), n++) if (isMeetingDay(days, d)) out.add(d);
  }
  return [...out].sort();
}

const unique = (dates: string[]) => [...new Set(dates)].sort();

/** "COMP 365 Algorithms": the code first, so the part that tells classes apart shows even in a narrow block. */
export function classTitle(course: Pick<Course, 'name' | 'code'>): string {
  const code = course.code?.trim();
  if (!code || course.name.toLowerCase().startsWith(code.toLowerCase())) return course.name;
  return `${code} ${course.name}`;
}

function classNotes(course: Pick<Course, 'instructor' | 'notes'>): string | null {
  return [course.instructor?.trim() && `Instructor: ${course.instructor.trim()}`, course.notes?.trim()].filter(Boolean).join('\n\n') || null;
}

/** The repeat rule for a course's meetings: weekly on its days, until the semester ends, minus these dates. */
export function classRecurrence(days: readonly number[], semester: Pick<Semester, 'endDate'>, firstDate: string, exdates: string[]): EventRecurrence {
  const set = [...new Set(days)].sort((a, b) => a - b);
  const justTheStartDay = set.length === 1 && set[0] === dayOfWeek(firstDate);
  return { freq: 'weekly', byWeekday: justTheStartDay ? null : set, until: semester.endDate, exdates: unique(exdates).filter((d) => d >= firstDate && d <= semester.endDate) };
}

export interface ClassContext {
  /** The "Class" event type's id, if it exists. */
  typeId: string | null;
  /** ISO timestamp for createdAt / updatedAt. */
  now: string;
  newId: () => string;
}

/** The one repeating event for a course. Pass the existing series as `existing` to keep its identity (id, createdAt). */
export function buildClassSeries(course: Course, semester: Semester, ctx: ClassContext, exdates: string[], existing?: Event): Event {
  const first = firstMeetingDate(semester.startDate, course.meetingDays);
  const start = combine(first, course.startTime);
  return {
    id: existing?.id ?? ctx.newId(),
    title: classTitle(course),
    start,
    end: combine(first, course.endTime),
    allDay: false,
    calendarId: course.calendarId,
    typeId: ctx.typeId,
    location: course.location,
    link: existing?.link ?? null,
    notes: classNotes(course),
    color: course.color,
    reminderMinutes: existing?.reminderMinutes ?? null,
    recurrence: classRecurrence(course.meetingDays, semester, first, exdates),
    recurringEventId: null,
    originalStart: null,
    courseId: course.id,
    applicationId: null,
    source: CLASS_SOURCE,
    createdAt: existing?.createdAt ?? ctx.now,
    updatedAt: ctx.now,
  };
}

/** The repeating event that makes up a course's classes, if it has been generated. */
export function findClassSeries(events: readonly Event[], courseId: string): Event | undefined {
  return events.find((e) => e.courseId === courseId && e.source === CLASS_SOURCE && e.recurrence !== null && e.recurringEventId === null);
}

/** Every event made from a course: the series and any single meeting that was changed. */
const classEventsOf = (events: readonly Event[], courseId: string) => events.filter((e) => e.courseId === courseId && e.source === CLASS_SOURCE);

export interface SchedulePlanInput {
  course: Course;
  semester: Semester;
  /** The semester as it was BEFORE this change, if the semester itself is being edited (to tell breaks from cancellations). */
  previousSemester?: Semester | null;
  events: readonly Event[];
  ctx: ClassContext;
}

/** Rows to write so a course's classes match the course and semester as they are now. */
export function planCourseSchedule({ course, semester, previousSemester, events, ctx }: SchedulePlanInput): BatchPlan {
  const existing = findClassSeries(events, course.id);
  const first = firstMeetingDate(semester.startDate, course.meetingDays);
  const breaks = breakDates(semester.excludedRanges, course.meetingDays, first, semester.endDate);
  const wasBreaks = (previousSemester ?? semester).excludedRanges;
  const cancelled = (existing?.recurrence?.exdates ?? []).filter((d) => !inRanges(d, wasBreaks));
  const series = buildClassSeries(course, semester, ctx, [...breaks, ...cancelled], existing);

  // A single meeting that was changed keeps its own time and room, but follows the course's name, color and calendar.
  const changed = existing
    ? events
        .filter((e) => e.recurringEventId === existing.id && !e.recurrence)
        .map((o) => ({ ...o, title: series.title, color: series.color, calendarId: series.calendarId, typeId: series.typeId, notes: series.notes, updatedAt: ctx.now }))
    : [];
  return { put: [series, ...changed], remove: [] };
}

/** Reschedule every course in a semester after the semester (its dates or breaks) changed. */
export function planSemesterReschedule(input: { semester: Semester; previousSemester: Semester; courses: readonly Course[]; events: readonly Event[]; ctx: ClassContext }): BatchPlan {
  const put = input.courses.filter((c) => c.semesterId === input.semester.id).flatMap((course) => planCourseSchedule({ course, semester: input.semester, previousSemester: input.previousSemester, events: input.events, ctx: input.ctx }).put);
  return { put, remove: [] };
}

/** Remove a course's class events (the series and any changed meeting). Its exams, deadlines and other events are left alone. */
export function planCourseDelete(events: readonly Event[], courseId: string): BatchPlan {
  return { put: [], remove: classEventsOf(events, courseId).map((e) => e.id) };
}

/** The dates of a course's meetings: every meeting day in the semester except the breaks. (Not counting single meetings cancelled by hand.) */
export function classMeetingDates(course: Pick<Course, 'meetingDays'>, semester: Pick<Semester, 'startDate' | 'endDate' | 'excludedRanges'>): string[] {
  const out: string[] = [];
  for (let d = semester.startDate, n = 0; d <= semester.endDate && n < MAX_DAYS; d = addDays(d, 1), n++) {
    if (isMeetingDay(course.meetingDays, d) && !inRanges(d, semester.excludedRanges)) out.push(d);
  }
  return out;
}

/** Meetings cancelled by hand: removed dates that aren't just a break. */
export function cancelledMeetings(series: Event, semester: Pick<Semester, 'excludedRanges'>): string[] {
  return (series.recurrence?.exdates ?? []).filter((d) => !inRanges(d, semester.excludedRanges));
}

/** Put a cancelled meeting back. */
export function planRestoreMeeting(series: Event, date: string, now: string): BatchPlan {
  if (!series.recurrence) return { put: [], remove: [] };
  return { put: [{ ...series, recurrence: { ...series.recurrence, exdates: series.recurrence.exdates.filter((d) => d !== date) }, updatedAt: now }], remove: [] };
}
