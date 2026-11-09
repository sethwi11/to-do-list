import { planDay, plannedRows, type Application, type CheckIn, type PlanSources, type RoutineBlock, type RoutineOverride, type WeekTemplate } from '../src';

// A made-up student's weeks, shared by the scoreboard, badge and review tests. Nov 2 2026 is a Monday.

export const NOW = '2026-01-01T00:00:00.000Z';
let n = 0;
export const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

export const SCHOOL = id();
export const GYM = id();
export const CS = id();
export const REAL_ESTATE = id();
export const READING = id();
export const CALENDARS = [
  { id: SCHOOL, name: 'School' },
  { id: GYM, name: 'Gym' },
  { id: CS, name: 'Coding' },
  { id: REAL_ESTATE, name: 'Real Estate' },
  { id: READING, name: 'Reading' },
];

export const template: WeekTemplate = {
  id: id(), name: 'Fall', effectiveFrom: '2026-09-01', effectiveTo: null,
  days: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, wake: '07:00', bed: '22:00' })), meetingWindows: [], createdAt: NOW, updatedAt: NOW,
};

export const block = (over: Partial<RoutineBlock>): RoutineBlock => ({
  id: id(), templateId: template.id, weekday: 1, start: '07:00', end: '08:00', title: 'Gym', calendarId: GYM, altTitle: null, altCalendarId: null,
  priority: 'normal', focus: false, soundtrack: null, notify: true, schoolDaysOnly: false, reschedulable: false, notes: null, createdAt: NOW, updatedAt: NOW, ...over,
});
const weekdays = (days: number[], over: Partial<RoutineBlock>) => days.map((weekday) => block({ weekday, ...over }));

export const gymBlocks = weekdays([1, 2, 3, 4, 5, 6], {});
export const studyBlocks = weekdays([1, 2, 3, 4, 5], { title: 'Study', start: '09:00', end: '11:00', calendarId: SCHOOL, altTitle: 'Reading', altCalendarId: READING, reschedulable: true });
export const otherBlocks = [
  ...weekdays([1, 3], { title: 'LeetCode', start: '20:00', end: '21:00', calendarId: CS }),
  ...weekdays([2], { title: 'Property research', start: '15:00', end: '16:00', calendarId: REAL_ESTATE }),
  ...weekdays([6], { title: 'Free time', start: '12:00', end: '14:00', calendarId: null, priority: 'free' }),
];

export const source = (blocks: RoutineBlock[], overrides: RoutineOverride[] = []): PlanSources => ({
  templates: [template], blocks, semesters: [], events: [], timeBlocks: [], tasks: [], calendars: CALENDARS.map((c) => ({ id: c.id, color: 'indigo' as const })), overrides,
});

export const override = (over: Partial<RoutineOverride>): RoutineOverride => ({
  id: id(), date: '2026-11-05', routineBlockId: null, action: 'skip', start: null, end: null, title: null, calendarId: null, taskId: null, eventId: null, sourceDate: null, createdAt: NOW, updatedAt: NOW, ...over,
});

/** The check-in the nightly page would save for the planned item with this title on this day. */
export function checkIn(src: PlanSources, date: string, title: string, status: CheckIn['status'] = 'done', over: Partial<CheckIn> = {}): CheckIn {
  const row = plannedRows(planDay(src, date).items).find((r) => r.item.title === title);
  if (!row) throw new Error(`nothing called ${title} on ${date}`);
  return { id: id(), date, itemKey: row.key, title, calendarId: row.item.calendarId, minutes: row.minutes, status, usedAlt: false, learned: null, createdAt: NOW, updatedAt: NOW, ...over };
}

/** An application sent on a date. */
export const sentOn = (date: string): Application => ({ status: 'Applied', dateApplied: date, statusHistory: [] }) as unknown as Application;
