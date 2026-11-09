import { describe, expect, it } from 'vitest';
import { addDays, addMinutes, DEFAULT_POPUP_SETTINGS, dayOfWeek, minutesBetween, planDay, plannedRows, planningDate, popupsForDay, type PlanSources, type Popup, type RoutineBlock, type Task, type WeekTemplate } from '@todo/shared';
import { currentItem, duringBlock, nextItem } from './todayModel';

// One made-up Friday walked minute by minute, from the 6:00 AM wake to the 2:00 AM bedtime, checking that the Now card, "During this block", the pop-ups, the check-in and bedtime all agree.

const NOW = '2026-01-01T00:00:00.000Z';
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const SCHOOL = id();
const GYM = id();
const FRIDAY = '2026-11-13';
const SATURDAY = addDays(FRIDAY, 1);

const template: WeekTemplate = {
  id: id(), name: 'Made-up week', effectiveFrom: '2026-09-01', effectiveTo: null, meetingWindows: [], createdAt: NOW, updatedAt: NOW,
  // A free night on Friday: bed at 2:00 AM; Saturday wakes at 8:00.
  days: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, wake: weekday === 6 ? '08:00' : '06:00', bed: weekday === 5 ? '02:00' : '22:00' })),
};
const block = (over: Partial<RoutineBlock>): RoutineBlock => ({
  id: id(), templateId: template.id, weekday: dayOfWeek(FRIDAY), start: '09:00', end: '10:00', title: 'Study', calendarId: SCHOOL, altTitle: null, altCalendarId: null,
  priority: 'normal', focus: false, soundtrack: null, notify: true, schoolDaysOnly: false, reschedulable: false, notes: null, createdAt: NOW, updatedAt: NOW, ...over,
});
const blocks = [
  block({ title: 'Gym', start: '06:20', end: '07:30', calendarId: GYM }),
  block({ title: 'Breakfast', start: '07:30', end: '08:00', calendarId: null }),
  block({ title: 'Study', start: '09:00', end: '11:00', focus: true, soundtrack: 'lofi' }),
  block({ title: 'Lunch', start: '12:00', end: '12:45', calendarId: null }),
  block({ title: 'Team meeting', start: '14:00', end: '15:00', priority: 'commitment' }),
  block({ title: 'Reading', start: '15:10', end: '16:00' }),
  block({ title: 'Free time', start: '20:00', end: '22:00', calendarId: null, priority: 'free' }),
  block({ title: 'Game night', start: '23:00', end: '23:59' }),
];
const task = (title: string, dueDate: string, calendarId: string | null): Task => ({
  id: id(), title, notes: null, dueDate, dueTime: null, priority: 'medium', calendarId, courseId: null, applicationId: null, reminders: [], status: 'todo', subtasks: [], recurrence: 'none',
  estimatedMinutes: null, source: 'manual', sourceSnippet: null, sortOrder: 0, createdAt: NOW, updatedAt: NOW, completedAt: null, nextOccurrenceId: null, rollsOver: true, repeatDays: [], missedAt: null,
});
// Listed with the later due date first, to catch a pop-up and a Now card that disagree about which comes first.
const tasks = [task('Lab report', '2026-11-20', SCHOOL), task('Problem set', '2026-11-14', SCHOOL), task('Unrelated errand', '2026-11-13', GYM)];
const src: PlanSources = { templates: [template], blocks, semesters: [], events: [], timeBlocks: [], tasks, calendars: [{ id: SCHOOL, color: 'indigo' }, { id: GYM, color: 'teal' }], overrides: [] };
const settings = { ...DEFAULT_POPUP_SETTINGS };

describe('a whole day, minute by minute', () => {
  const popups = popupsForDay(src, FRIDAY, settings);
  const at = (m: string) => popups.find((p) => p.at === m);
  const plan = planDay(src, FRIDAY);
  const minutes: string[] = [];
  for (let m = `${FRIDAY}T06:00`; m <= `${SATURDAY}T02:00`; m = addMinutes(m, 1)) minutes.push(m);

  it('is the same day all the way from 6:00 AM to bedtime, even after midnight', () => {
    expect(plan.bed).toBe(`${SATURDAY}T02:00`);
    for (const m of minutes.slice(0, -1)) expect(planningDate(src.templates, m), m).toBe(FRIDAY);
    expect(planningDate(src.templates, `${SATURDAY}T02:00`)).toBe(SATURDAY); // at bedtime a new day starts
  });

  it('shows something on the Now card whenever a pop-up says a block starts or stops', () => {
    for (const m of minutes) {
      const p = at(m);
      if (!p) continue;
      for (const key of p.keys) {
        const item = plan.items.find((i) => key === `start:${i.key}` || key === `stop:${i.key}`);
        if (!item) continue;
        const current = currentItem(plan.items, m);
        if (key.startsWith('start:')) {
          // The block that starts is under way now, unless a stronger one starting in the same minute took the card; either way, its line is in the pop-up.
          expect(`${p.title}\n${p.body}`, m).toContain(`Now: ${item.title} until`);
          expect(current && current.start <= m && m < current.end, m).toBe(true);
        } else {
          expect(current?.key === item.key, `${m}: ${item.title} should be over`).toBe(false);
        }
      }
    }
  });

  it('names a block exactly when it starts, and says what is next', () => {
    const study = plan.items.find((i) => i.title === 'Study')!;
    const p = at(study.start)!;
    expect(p.title).toBe('Now: Study until 11:00 AM · Next: Lunch · Problem set +1 more · Soundtrack: lofi');
    expect(nextItem(plan.items, study.start)?.title).toBe('Lunch');
  });

  it('lists the same to-dos in the same order on the Now card and in the start pop-up', () => {
    const study = plan.items.find((i) => i.title === 'Study')!;
    const card = duringBlock(tasks, study).map((t) => t.title);
    expect(card).toEqual(['Problem set', 'Lab report']); // soonest due first
    expect(at(study.start)!.title).toContain(` · ${card[0]} +${card.length - 1} more`);
    // A block with no matching category (or not a work block) names no to-dos.
    expect(duringBlock(tasks, plan.items.find((i) => i.title === 'Breakfast'))).toEqual([]);
    expect(at(plan.items.find((i) => i.title === 'Breakfast')!.start)!.title).not.toContain('·  ');
  });

  it('warns before the commitment, closes the day after the last real block, and says bedtime with tomorrow\'s start', () => {
    const meeting = plan.items.find((i) => i.title === 'Team meeting')!;
    expect(at(addMinutes(meeting.start, -5))!.title).toBe('In 5 min: Team meeting at 2:00 PM');
    const last = [...plan.items].reverse().find((i) => i.kind !== 'open' && i.kind !== 'task' && i.priority !== 'free')!;
    expect(last.title).toBe('Game night');
    const close = popups.find((p) => p.keys.includes(`close:${FRIDAY}`))!;
    expect(close).toMatchObject({ at: last.end, url: `/checkin?date=${FRIDAY}` });
    const bed = popups.find((p) => p.keys.includes(`bed:${FRIDAY}`))!;
    expect(bed).toMatchObject({ at: `${SATURDAY}T02:00`, title: 'Bedtime. Tomorrow starts at 8:00 AM' });
    // Nothing is sent after bedtime.
    expect(popups.filter((p) => p.at > bed.at)).toEqual([]);
  });

  it('has a check-in row for everything that pops up, and no pop-up fires twice in a minute', () => {
    const rows = plannedRows(plan.items);
    for (const p of popups.filter((x) => x.keys.some((k) => k.startsWith('start:')))) for (const k of p.keys.filter((x) => x.startsWith('start:'))) {
      const item = plan.items.find((i) => `start:${i.key}` === k)!;
      expect(rows.some((r) => r.key === item.key.replace(/#\d+$/, '')), item.title).toBe(true);
    }
    const seen = new Set<string>();
    for (const p of popups as Popup[]) { expect(seen.has(p.at), p.at).toBe(false); seen.add(p.at); }
    expect(minutesBetween(plan.items.find((i) => i.title === 'Gym')!.start, `${FRIDAY}T07:30`)).toBe(70);
  });
});
