import { describe, expect, it } from 'vitest';
import { DEFAULT_BUDGET, isOverdue, openBumps, planDay, reviewSummary, scoreboard, weekRange, type Event, type RoutineOverride, type Semester, type Task } from '../src';
import { CALENDARS, GYM, NOW, SCHOOL, block, checkIn, id, override, source } from './week';

// A messy made-up week (Mon Nov 9 to Sun Nov 15, 2026), checked for every place that reports on it.
const MON = '2026-11-09', TUE = '2026-11-10', WED = '2026-11-11', THU = '2026-11-12', FRI = '2026-11-13', SAT = '2026-11-14', SUN = '2026-11-15';

const volleyball = block({ weekday: 1, start: '18:00', end: '20:00', title: 'Volleyball', calendarId: GYM, reschedulable: true });
const dinner = block({ weekday: 2, start: '18:00', end: '19:00', title: 'Team dinner', calendarId: null, priority: 'commitment' });
const gym = block({ weekday: 3, start: '07:00', end: '08:00', title: 'Gym', calendarId: GYM, reschedulable: true });
const lab = block({ weekday: 4, start: '09:00', end: '11:00', title: 'Lab', calendarId: SCHOOL, reschedulable: true, schoolDaysOnly: true });
const study = block({ weekday: 5, start: '09:00', end: '10:00', title: 'Study', calendarId: SCHOOL, reschedulable: true });
const blocks = [volleyball, dinner, gym, lab, study];

const semester: Semester = { id: id(), name: 'Fall', startDate: '2026-08-12', endDate: '2026-12-04', excludedRanges: [{ start: THU, end: THU, label: 'Break day' }], archived: false, createdAt: NOW };
const ev = (title: string, start: string, end: string): Event => ({
  id: id(), title, start, end, allDay: false, calendarId: null, typeId: null, location: null, link: null, notes: null, color: null, reminderMinutes: null, recurrence: null,
  recurringEventId: null, originalStart: null, courseId: null, applicationId: null, source: 'manual', createdAt: NOW, updatedAt: NOW,
});
const events = [ev('Club meeting', `${MON}T18:30`, `${MON}T19:30`), ev('Career fair', `${TUE}T18:15`, `${TUE}T18:45`)];

const overrides: RoutineOverride[] = [
  override({ date: WED, routineBlockId: gym.id, action: 'skip' }), // skipped...
  override({ date: SAT, routineBlockId: gym.id, action: 'makeup', start: `${SAT}T10:00`, end: `${SAT}T11:00`, sourceDate: WED }), // ...and made up on Saturday
  override({ date: FRI, routineBlockId: study.id, action: 'move', start: `${FRI}T16:00`, end: `${FRI}T17:00` }), // rescheduled
];
const src = { ...source(blocks, overrides), semesters: [semester], events };
const today = SUN;

describe('a messy week', () => {
  it('an event over volleyball cuts it and bumps exactly the minutes taken; the rest of volleyball stays', () => {
    const mon = planDay(src, MON);
    expect(mon.bumped).toEqual([{ blockId: volleyball.id, date: MON, title: 'Volleyball', calendarId: GYM, minutes: 60, how: 'replaced', by: 'Club meeting' }]);
    expect(mon.items.filter((i) => i.title === 'Volleyball').map((i) => [i.start.slice(11), i.end.slice(11)])).toEqual([['18:00', '18:30'], ['19:30', '20:00']]);
  });

  it('an event over a commitment is a clash, never a bump: the dinner keeps its time', () => {
    const tue = planDay(src, TUE);
    expect(tue.bumped).toEqual([]);
    expect(tue.items.find((i) => i.title === 'Team dinner')).toMatchObject({ start: `${TUE}T18:00`, end: `${TUE}T19:00` });
    expect(tue.items.find((i) => i.title === 'Career fair')?.clashes).toEqual(['Team dinner']);
  });

  it('a break day removes school-day blocks without counting them as missed', () => {
    const thu = planDay(src, THU);
    expect(thu.items.some((i) => i.title === 'Lab')).toBe(false);
    expect(thu.bumped).toEqual([]);
    expect(planDay(src, '2026-11-19').items.some((i) => i.title === 'Lab')).toBe(true); // an ordinary Thursday still has it
  });

  it('a moved block is not missed, and a skipped one made up later is no longer open', () => {
    expect(planDay(src, FRI).bumped).toEqual([]);
    expect(planDay(src, FRI).items.find((i) => i.title === 'Study')).toMatchObject({ start: `${FRI}T16:00`, end: `${FRI}T17:00` });
    expect(planDay(src, WED).bumped.map((b) => [b.title, b.how, b.minutes])).toEqual([['Gym', 'skipped', 60]]);
    expect(planDay(src, SAT).items.find((i) => i.makeup)).toMatchObject({ title: 'Gym', start: `${SAT}T10:00` });
  });

  it('Today, Week, the scoreboard and the Sunday review all report the same missed time', () => {
    const [from, to] = weekRange(today);
    expect([from, to]).toEqual([MON, SUN]);
    const open = openBumps(src, from, to); // what Today and Week list under "Missed this week"
    expect(open.map((b) => [b.title, b.date, b.minutes])).toEqual([['Volleyball', MON, 60]]);

    const checkIns = [checkIn(src, MON, 'Volleyball', 'done'), checkIn(src, SAT, 'Gym', 'done')];
    const score = scoreboard({ src, checkIns, applications: [], calendars: CALENDARS, expenses: [], moves: [], budget: DEFAULT_BUDGET }, from, today);
    expect(score.bumped).toEqual({ madeUpMinutes: 60, letGoMinutes: 0, openMinutes: open.reduce((n, b) => n + b.minutes, 0) });

    const text = reviewSummary({ score, names: new Map(CALENDARS.map((c) => [c.id, c.name])), unmadeUp: open, missedTasks: [], learned: [], nextWeek: [], priorities: [], goals: [], notes: '' });
    expect(text).toContain('Bumped time: 1h made up, 1h not made up');
    expect(text).toContain('## Not made up\n- Volleyball (Mon Nov 9, 1h)');
    // Hours: the two volleyball pieces count once (60), the skipped gym isn't planned, and its Saturday make-up is (60).
    expect(score.categories.find((c) => c.calendarId === GYM)).toMatchObject({ plannedMinutes: 120, doneMinutes: 120 });
  });

  it('an unfinished rolling weekly to-do is never overdue, but a one-off that slipped is', () => {
    const t = (over: Partial<Task>): Task => ({ id: id(), title: 'x', notes: null, dueDate: MON, dueTime: null, priority: 'medium', calendarId: null, courseId: null, applicationId: null, reminders: [], status: 'todo', subtasks: [], recurrence: 'none', estimatedMinutes: null, source: 'manual', sourceSnippet: null, sortOrder: 0, createdAt: NOW, updatedAt: NOW, completedAt: null, nextOccurrenceId: null, rollsOver: true, repeatDays: [], missedAt: null, ...over });
    expect(isOverdue(t({ recurrence: 'weekly' }), today)).toBe(false);
    expect(isOverdue(t({}), today)).toBe(true);
    expect(isOverdue(t({ recurrence: 'weekly', rollsOver: false }), today)).toBe(true); // rolling switched off: it behaves like any to-do
  });
});
