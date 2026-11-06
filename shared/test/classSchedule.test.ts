import { describe, expect, it } from 'vitest';
import {
  applyPlan,
  breakDates,
  cancelledMeetings,
  classMeetingDates,
  classTitle,
  expandOccurrences,
  findClassSeries,
  firstMeetingDate,
  planCourseDelete,
  planCourseSchedule,
  planEventDelete,
  planEventEdit,
  planRestoreMeeting,
  planSemesterReschedule,
  type ClassContext,
  type Course,
  type Event,
  type Semester,
} from '../src';

const NOW = '2026-08-01T12:00:00.000Z';
let n = 0;
const ctx = (): ClassContext => ({ typeId: 'type-class', now: NOW, newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` });

const semester = (over: Partial<Semester> = {}): Semester => ({
  id: 'sem-1',
  name: 'Fall 2026',
  startDate: '2026-08-24', // a Monday
  endDate: '2026-12-11',
  excludedRanges: [
    { start: '2026-10-12', end: '2026-10-13', label: 'Fall break' },
    { start: '2026-11-26', end: '2026-11-29', label: 'Thanksgiving' },
  ],
  archived: false,
  createdAt: NOW,
  ...over,
});

const course = (over: Partial<Course> = {}): Course => ({
  id: 'course-1',
  semesterId: 'sem-1',
  name: 'Algorithms',
  code: 'COMP 365',
  color: 'dusty-blue',
  calendarId: 'cal-school',
  meetingDays: [1, 3, 5], // Mon, Wed, Fri
  startTime: '10:00',
  endTime: '11:15',
  location: 'Science 210',
  instructor: 'Dr. Rivera',
  notes: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...over,
});

const generate = (c = course(), s = semester(), existing: Event[] = []) => {
  const plan = planCourseSchedule({ course: c, semester: s, events: existing, ctx: ctx() });
  return { plan, events: applyPlan(existing, plan) };
};
const datesOf = (events: Event[], from = '2026-08-01', to = '2026-12-31') => expandOccurrences(events, from, to).map((o) => o.start.slice(0, 10));

describe('helpers', () => {
  it('finds the first meeting on or after the semester starts', () => {
    expect(firstMeetingDate('2026-08-24', [1, 3, 5])).toBe('2026-08-24'); // already a Monday
    expect(firstMeetingDate('2026-08-25', [1, 3, 5])).toBe('2026-08-26'); // Tuesday -> Wednesday
    expect(firstMeetingDate('2026-08-25', [2, 4])).toBe('2026-08-25');
  });

  it('lists only the meeting days that fall in a break', () => {
    const s = semester();
    // Fall break is Mon-Tue and Thanksgiving is Thu-Sun: Mon/Wed/Fri loses the Monday (Oct 12) and the Friday (Nov 27).
    expect(breakDates(s.excludedRanges, [1, 3, 5], s.startDate, s.endDate)).toEqual(['2026-10-12', '2026-11-27']);
    // For Tue/Thu both fall break Tuesday and Thanksgiving Thursday are lost.
    expect(breakDates(s.excludedRanges, [2, 4], s.startDate, s.endDate)).toEqual(['2026-10-13', '2026-11-26']);
  });

  it('puts the code before the name, unless the name already starts with it', () => {
    expect(classTitle({ name: 'Algorithms', code: 'COMP 365' })).toBe('COMP 365 Algorithms');
    expect(classTitle({ name: 'COMP 365 Algorithms', code: 'COMP 365' })).toBe('COMP 365 Algorithms');
    expect(classTitle({ name: 'Algorithms', code: null })).toBe('Algorithms');
  });

  it('counts a semester\'s meetings, without the breaks', () => {
    // Aug 24 (Mon) to Dec 11 (Fri) is 16 weeks: 16 x 3 meetings, minus the two lost to breaks.
    const dates = classMeetingDates(course(), semester());
    expect(dates[0]).toBe('2026-08-24');
    expect(dates.at(-1)).toBe('2026-12-11');
    expect(dates).not.toContain('2026-10-12');
    expect(dates).toContain('2026-10-14');
    expect(dates).not.toContain('2026-11-27');
    expect(dates).toHaveLength(16 * 3 - 2);
  });
});

describe('generating a course', () => {
  it('makes one repeating event, weekly on the meeting days until the semester ends', () => {
    const { plan } = generate();
    expect(plan.put).toHaveLength(1);
    const series = plan.put[0]!;
    expect(series).toMatchObject({
      title: 'COMP 365 Algorithms',
      start: '2026-08-24T10:00',
      end: '2026-08-24T11:15',
      location: 'Science 210',
      color: 'dusty-blue',
      calendarId: 'cal-school',
      typeId: 'type-class',
      courseId: 'course-1',
      source: 'class-schedule',
      notes: 'Instructor: Dr. Rivera',
      allDay: false,
    });
    expect(series.recurrence).toEqual({ freq: 'weekly', byWeekday: [1, 3, 5], until: '2026-12-11', exdates: ['2026-10-12', '2026-11-27'] });
  });

  it('produces exactly the meetings that match the schedule, with breaks left out', () => {
    const { events } = generate();
    const dates = datesOf(events);
    expect(dates).toEqual(classMeetingDates(course(), semester()));
    expect(dates).not.toContain('2026-10-12');
    expect(dates).toContain('2026-11-25'); // the Wednesday before Thanksgiving is a normal class
    expect(dates.every((d) => [1, 3, 5].includes(new Date(`${d}T12:00`).getDay()))).toBe(true);
  });

  it('starts on the first real meeting when the semester starts mid-week', () => {
    const { events } = generate(course({ meetingDays: [2, 4] }), semester({ startDate: '2026-08-26' })); // a Wednesday
    expect(datesOf(events)[0]).toBe('2026-08-27'); // first Thursday
    expect(findClassSeries(events, 'course-1')!.start).toBe('2026-08-27T10:00');
  });

  it('stores a single meeting day without a weekday list', () => {
    const { plan } = generate(course({ meetingDays: [1] }));
    expect(plan.put[0]!.recurrence!.byWeekday).toBeNull();
  });
});

describe('editing a course', () => {
  const taught = generate().events;

  it('updates the same series in place (same id), with the new time, room and days', () => {
    const edited = generate(course({ startTime: '13:00', endTime: '14:15', location: 'Science 305', meetingDays: [2, 4] }), semester(), taught);
    expect(edited.events).toHaveLength(1);
    const series = edited.events[0]!;
    expect(series.id).toBe(taught[0]!.id);
    expect(series.createdAt).toBe(taught[0]!.createdAt);
    expect(series).toMatchObject({ location: 'Science 305', start: '2026-08-25T13:00', end: '2026-08-25T14:15' });
    expect(series.recurrence!.byWeekday).toEqual([2, 4]);
    expect(series.recurrence!.exdates).toEqual(['2026-10-13', '2026-11-26']); // the breaks for Tue/Thu, recomputed
  });

  it('keeps a meeting that was cancelled by hand', () => {
    const occurrence = expandOccurrences(taught, '2026-11-04', '2026-11-05')[0]!;
    const cancelled = applyPlan(taught, planEventDelete({ events: taught, occurrence, scope: 'this', now: NOW, newId: ctx().newId }));
    expect(cancelledMeetings(findClassSeries(cancelled, 'course-1')!, semester())).toEqual(['2026-11-04']);

    const edited = generate(course({ startTime: '09:00', endTime: '10:15' }), semester(), cancelled).events;
    expect(datesOf(edited)).not.toContain('2026-11-04');
    expect(datesOf(edited)).not.toContain('2026-10-12');
    expect(findClassSeries(edited, 'course-1')!.start).toBe('2026-08-24T09:00');
  });

  it('keeps a single moved meeting at its own time, but gives it the course\'s new name', () => {
    const occurrence = expandOccurrences(taught, '2026-11-04', '2026-11-05')[0]!;
    const moved = applyPlan(taught, planEventEdit({ events: taught, occurrence, scope: 'this', changes: { start: '2026-11-04T14:00', end: '2026-11-04T15:15' }, now: NOW, newId: ctx().newId }));
    const edited = generate(course({ name: 'Advanced Algorithms' }), semester(), moved).events;
    const occ = expandOccurrences(edited, '2026-11-04', '2026-11-05');
    expect(occ).toHaveLength(1);
    expect(occ[0]).toMatchObject({ start: '2026-11-04T14:00', isOverride: true });
    expect(occ[0]!.event.title).toBe('COMP 365 Advanced Algorithms');
  });
});

describe('changing the semester', () => {
  const taught = generate().events;

  it('moves the end date and the breaks along, and forgets a break that was removed', () => {
    const before = semester();
    const after = semester({ endDate: '2026-12-18', excludedRanges: [{ start: '2026-11-25', end: '2026-11-25', label: 'Day off' }] });
    const plan = planSemesterReschedule({ semester: after, previousSemester: before, courses: [course()], events: taught, ctx: ctx() });
    const edited = applyPlan(taught, plan);
    const dates = datesOf(edited);
    expect(dates.at(-1)).toBe('2026-12-18');
    expect(dates).toContain('2026-10-12'); // fall break is gone from the semester: that Monday is a class again
    expect(dates).not.toContain('2026-11-25'); // the new day off
  });

  it('keeps a hand-cancelled meeting even when the breaks are edited', () => {
    const occurrence = expandOccurrences(taught, '2026-11-04', '2026-11-05')[0]!;
    const cancelled = applyPlan(taught, planEventDelete({ events: taught, occurrence, scope: 'this', now: NOW, newId: ctx().newId }));
    const after = semester({ excludedRanges: [] });
    const edited = applyPlan(cancelled, planSemesterReschedule({ semester: after, previousSemester: semester(), courses: [course()], events: cancelled, ctx: ctx() }));
    expect(datesOf(edited)).not.toContain('2026-11-04');
    expect(datesOf(edited)).toContain('2026-10-12');
  });

  it('only touches the courses of that semester', () => {
    const other = course({ id: 'course-2', semesterId: 'sem-2' });
    const plan = planSemesterReschedule({ semester: semester(), previousSemester: semester(), courses: [course(), other], events: taught, ctx: ctx() });
    expect(plan.put.every((e) => e.courseId === 'course-1')).toBe(true);
  });
});

describe('cancelling and restoring a meeting', () => {
  it('restores a cancelled meeting', () => {
    const taught = generate().events;
    const occurrence = expandOccurrences(taught, '2026-11-04', '2026-11-05')[0]!;
    const cancelled = applyPlan(taught, planEventDelete({ events: taught, occurrence, scope: 'this', now: NOW, newId: ctx().newId }));
    expect(datesOf(cancelled)).not.toContain('2026-11-04');
    const restored = applyPlan(cancelled, planRestoreMeeting(findClassSeries(cancelled, 'course-1')!, '2026-11-04', NOW));
    expect(datesOf(restored)).toContain('2026-11-04');
    expect(cancelledMeetings(findClassSeries(restored, 'course-1')!, semester())).toEqual([]);
  });
});

describe('deleting a course', () => {
  it('removes its class events but not its exams or other courses', () => {
    const taught = generate().events;
    const occurrence = expandOccurrences(taught, '2026-11-04', '2026-11-05')[0]!;
    const withMoved = applyPlan(taught, planEventEdit({ events: taught, occurrence, scope: 'this', changes: { start: '2026-11-04T14:00', end: '2026-11-04T15:15' }, now: NOW, newId: ctx().newId }));
    const exam = { ...taught[0]!, id: 'exam', source: 'file-import' as const, recurrence: null, recurringEventId: null } as Event;
    const otherCourse = generate(course({ id: 'course-2', name: 'Physics' }), semester()).events[0]!;
    const all = [...withMoved, exam, otherCourse];
    const removed = applyPlan(all, planCourseDelete(all, 'course-1'));
    expect(removed.map((e) => e.id).sort()).toEqual(['exam', otherCourse.id].sort());
  });
});
