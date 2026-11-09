import { describe, expect, it } from 'vitest';
import { addDays, DEFAULT_POPUP_SETTINGS, popupsForDay, type Event, type PlanSources, type RoutineBlock, type RoutineOverride, type Task, type WeekTemplate } from '../src';

// A made-up student's week.
const NOW = '2026-01-01T00:00:00.000Z';
const CAL = '00000000-0000-4000-8000-0000000000c1';
const OTHER = '00000000-0000-4000-8000-0000000000c2';
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const WED = '2026-11-11';

const template: WeekTemplate = {
  id: id(), name: 'Fall', effectiveFrom: '2026-09-01', effectiveTo: null,
  days: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, wake: '07:00', bed: '22:00' })), meetingWindows: [], createdAt: NOW, updatedAt: NOW,
};
const block = (over: Partial<RoutineBlock>): RoutineBlock => ({
  id: id(), templateId: template.id, weekday: 3, start: '09:00', end: '10:00', title: 'Study', calendarId: CAL, altTitle: null, altCalendarId: null,
  priority: 'normal', focus: false, soundtrack: null, notify: true, schoolDaysOnly: false, reschedulable: true, notes: null, createdAt: NOW, updatedAt: NOW, ...over,
});
const ev = (over: Partial<Event>): Event => ({
  id: id(), title: 'Lecture', start: `${WED}T13:00`, end: `${WED}T14:00`, allDay: false, calendarId: CAL, typeId: null, location: null, link: null, notes: null, color: null,
  reminderMinutes: null, recurrence: null, recurringEventId: null, originalStart: null, courseId: null, applicationId: null, source: 'manual', createdAt: NOW, updatedAt: NOW, ...over,
});
const task = (over: Partial<Task>): Task => ({
  id: id(), title: 'Text the team', notes: null, dueDate: WED, dueTime: null, priority: 'medium', calendarId: CAL, courseId: null, applicationId: null, reminders: [], status: 'todo',
  subtasks: [], recurrence: 'none', estimatedMinutes: null, source: 'manual', sourceSnippet: null, sortOrder: 0, createdAt: NOW, updatedAt: NOW, completedAt: null, nextOccurrenceId: null,
  rollsOver: true, repeatDays: [], missedAt: null, ...over,
});
const src = (over: Partial<PlanSources> = {}): PlanSources => ({
  templates: [template], blocks: [], semesters: [], events: [], timeBlocks: [], tasks: [], calendars: [{ id: CAL, color: 'indigo' }, { id: OTHER, color: 'teal' }], overrides: [], ...over,
});
const at = (list: ReturnType<typeof popupsForDay>, time: string) => list.find((p) => p.at === `${WED}T${time}`);
const settings = { ...DEFAULT_POPUP_SETTINGS, bedtime: false };

describe('pop-ups for a day', () => {
  it('starts a block with what it is, how long, what is next and the to-dos that match it', () => {
    const study = block({ start: '09:00', end: '10:00' });
    const walk = block({ start: '10:30', end: '11:00', title: 'Walk', calendarId: OTHER });
    const list = popupsForDay(src({ blocks: [study, walk], tasks: [task({ title: 'Problem set' }), task({ title: 'Reading' })] }), WED, settings);
    expect(at(list, '09:00')?.title).toBe('Now: Study until 10:00 AM · Next: Walk · Problem set +1 more');
    expect(at(list, '10:00')?.title).toBe('Done: Study · Next: Walk at 10:30 AM');
  });

  it('names to-dos only for work blocks, not meals or driving', () => {
    const drive = block({ start: '09:00', end: '09:30', title: 'Drive', reschedulable: false });
    const list = popupsForDay(src({ blocks: [drive], tasks: [task({ title: 'Problem set' })] }), WED, settings);
    expect(at(list, '09:00')?.title).toBe('Now: Drive until 9:30 AM');
  });

  it('sends one pop-up when a block ends just as the next begins', () => {
    const list = popupsForDay(src({ blocks: [block({ start: '09:00', end: '10:00' }), block({ start: '10:00', end: '11:00', title: 'Walk', calendarId: OTHER })] }), WED, settings);
    const switchover = at(list, '10:00')!;
    expect(switchover.title).toMatch(/^Now: Walk until 11:00 AM/);
    expect(switchover.body).toBe('Done: Study');
    expect(list.filter((p) => p.at === `${WED}T10:00`)).toHaveLength(1);
  });

  it('warns 5 minutes before a focus block ends', () => {
    const list = popupsForDay(src({ blocks: [block({ focus: true })] }), WED, settings);
    expect(at(list, '09:55')?.title).toBe('5 minutes left: Study');
  });

  it('gives a heads-up before a class and stays quiet during it', () => {
    const lecture = ev({ courseId: id() });
    const during = block({ start: '13:30', end: '15:00', title: 'Reading', calendarId: OTHER });
    const list = popupsForDay(src({ events: [lecture], blocks: [during] }), WED, settings);
    expect(at(list, '12:55')?.title).toBe('In 5 min: Lecture at 1:00 PM');
    expect(list.some((p) => p.at > `${WED}T13:00` && p.at < `${WED}T14:00`)).toBe(false);
    expect(at(list, '14:00')?.title).toMatch(/^Now: Reading until 3:00 PM/); // what's left after the class
  });

  it('follows the planned day: a replaced block sends nothing, a skipped one neither', () => {
    const game = block({ start: '18:00', end: '20:00', title: 'Volleyball', priority: 'high' });
    const replaced = popupsForDay(src({ blocks: [game], events: [ev({ title: 'Service event', start: `${WED}T18:00`, end: `${WED}T20:00` })] }), WED, settings);
    expect(replaced.some((p) => p.title.includes('Volleyball'))).toBe(false);
    expect(at(replaced, '18:00')?.title).toMatch(/^Now: Service event/);
    const skip: RoutineOverride = { id: id(), date: WED, routineBlockId: game.id, action: 'skip', start: null, end: null, title: null, calendarId: null, taskId: null, eventId: null, sourceDate: null, createdAt: NOW, updatedAt: NOW };
    expect(popupsForDay(src({ blocks: [game], overrides: [skip] }), WED, settings)).toEqual([]);
  });

  it('respects a muted category, a block with pop-ups off, and a pause', () => {
    const blocks = [block({}), block({ start: '11:00', end: '12:00', title: 'Walk', calendarId: OTHER }), block({ start: '15:00', end: '16:00', title: 'Quiet', notify: false })];
    const muted = popupsForDay(src({ blocks }), WED, { ...settings, mutedCalendarIds: [CAL] });
    expect(muted.map((p) => p.title)).toEqual(['Now: Walk until 12:00 PM · Next: Quiet', 'Done: Walk · Next: Quiet at 3:00 PM']); // Next still names a block whose own pop-ups are off
    const paused = popupsForDay(src({ blocks }), WED, { ...settings, pausedUntil: `${WED}T11:30` });
    expect(paused.map((p) => p.at)).toEqual([`${WED}T12:00`]);
    expect(popupsForDay(src({ blocks }), WED, { ...settings, enabled: false })).toEqual([]);
  });

  it('delivers to-do due times (with the first line of the notes) and reminders, and event reminders', () => {
    const tasks = [task({ title: 'Text the team', dueTime: '16:30', notes: 'Hey! How are the deliverables going?\nmore' }), task({ title: 'Essay', dueDate: '2026-11-12', reminders: [1440] })];
    const events = [ev({ title: 'Interview', start: '2026-11-13T10:00', end: '2026-11-13T11:00', reminderMinutes: 2880 })];
    const list = popupsForDay(src({ tasks, events }), WED, settings);
    expect(at(list, '16:30')?.title).toBe('Due now: Text the team · Hey! How are the deliverables going?');
    expect(at(list, '09:00')?.title).toBe('Reminder: Essay is due 9:00 AM on 2026-11-12');
    expect(at(list, '10:00')?.title).toBe('Reminder: Interview at 10:00 AM');
  });

  it('says goodnight at bedtime with when tomorrow starts', () => {
    const list = popupsForDay(src(), WED, DEFAULT_POPUP_SETTINGS);
    expect(at(list, '22:00')?.title).toBe('Bedtime. Tomorrow starts at 7:00 AM');
  });

  it('a whole week: one pop-up per minute at most, none inside a class, and every block starts', () => {
    const blocks = [1, 2, 3, 4, 5].flatMap((weekday) => [block({ weekday, start: '08:00', end: '09:00', title: 'Gym' }), block({ weekday, start: '09:00', end: '11:00', title: 'Study', focus: true }), block({ weekday, start: '15:00', end: '16:00', title: 'Read' })]);
    const classes = [2, 4].map((weekday) => ev({ title: 'Lecture', courseId: id(), start: `${addDays('2026-11-08', weekday)}T14:00`, end: `${addDays('2026-11-08', weekday)}T15:30`, id: id() }));
    for (let d = 0; d < 7; d++) {
      const date = addDays('2026-11-08', d);
      const list = popupsForDay(src({ blocks, events: classes }), date, DEFAULT_POPUP_SETTINGS);
      expect(new Set(list.map((p) => p.at)).size).toBe(list.length);
      for (const c of classes) expect(list.some((p) => p.at > c.start && p.at < c.end)).toBe(false);
      const weekday = new Date(`${date}T12:00`).getDay();
      if (weekday >= 1 && weekday <= 5) expect(list.filter((p) => p.title.startsWith('Now: ')).length).toBe(3);
      // On class days, Read's start moves to the minute the class ends.
      if (weekday === 2 || weekday === 4) expect(list.find((p) => p.title.startsWith('Now: Read'))?.at).toBe(`${date}T15:30`);
    }
  });
});
