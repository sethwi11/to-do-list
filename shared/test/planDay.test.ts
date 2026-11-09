import { describe, expect, it } from 'vitest';
import { activeTemplate, openBumps, openSlots, parseQuotes, planDay, planningDate, quoteFor, quotesToText, strongerOverlaps, type Event, type PlanSources, type RoutineBlock, type RoutineOverride, type Semester, type WeekTemplate } from '../src';

// A made-up student's week.
const NOW = '2026-01-01T00:00:00.000Z';
const CAL = '00000000-0000-4000-8000-0000000000c1';
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

const template = (over: Partial<WeekTemplate> = {}): WeekTemplate => ({
  id: id(), name: 'Fall', effectiveFrom: '2026-09-01', effectiveTo: '2026-12-15',
  days: [{ weekday: 3, wake: '06:00', bed: '02:00' }, { weekday: 4, wake: '08:00', bed: '22:00' }],
  meetingWindows: [], createdAt: NOW, updatedAt: NOW, ...over,
});
const block = (t: WeekTemplate, over: Partial<RoutineBlock>): RoutineBlock => ({
  id: id(), templateId: t.id, weekday: 3, start: '09:00', end: '10:00', title: 'Study', calendarId: CAL, altTitle: null, altCalendarId: null,
  priority: 'normal', focus: false, soundtrack: null, notify: true, schoolDaysOnly: false, notes: null, createdAt: NOW, updatedAt: NOW, ...over,
});
const ev = (over: Partial<Event>): Event => ({
  id: id(), title: 'Lab', start: `2026-11-11T09:30`, end: `2026-11-11T10:30`, allDay: false, calendarId: CAL, typeId: null, location: null, link: null, notes: null, color: 'teal',
  reminderMinutes: null, recurrence: null, recurringEventId: null, originalStart: null, courseId: null, applicationId: null, source: 'manual', createdAt: NOW, updatedAt: NOW, ...over,
});
const override = (over: Partial<RoutineOverride>): RoutineOverride => ({
  id: id(), date: '2026-11-11', routineBlockId: null, action: 'skip', start: null, end: null, title: null, calendarId: null, taskId: null, eventId: null, sourceDate: null, createdAt: NOW, updatedAt: NOW, ...over,
});
const semester: Semester = { id: id(), name: 'Fall', startDate: '2026-08-20', endDate: '2026-12-10', excludedRanges: [{ start: '2026-11-25', end: '2026-11-29', label: 'Thanksgiving' }], archived: false, createdAt: NOW };
const sources = (templates: WeekTemplate[], blocks: RoutineBlock[], extra: Partial<PlanSources> = {}): PlanSources => ({
  templates, blocks, semesters: [semester], events: [], timeBlocks: [], tasks: [], calendars: [{ id: CAL, color: 'indigo' }], overrides: [], ...extra,
});

// 2026-11-11 is a Wednesday.
const WED = '2026-11-11';

describe('planDay', () => {
  it('lays out the template blocks for that weekday in the category color, with Open time in the gaps', () => {
    const t = template();
    const plan = planDay(sources([t], [block(t, {}), block(t, { start: '10:00', end: '11:00', title: 'Read' }), block(t, { weekday: 4, title: 'Not today' })]), WED);
    expect(plan.wake).toBe(`${WED}T06:00`);
    expect(plan.bed).toBe('2026-11-12T02:00');
    const routine = plan.items.filter((i) => i.kind === 'routine');
    expect(routine.map((i) => [i.title, i.start, i.end, i.color])).toEqual([
      ['Study', `${WED}T09:00`, `${WED}T10:00`, 'indigo'],
      ['Read', `${WED}T10:00`, `${WED}T11:00`, 'indigo'],
    ]);
    expect(plan.items.filter((i) => i.kind === 'open').map((i) => [i.start, i.end])).toEqual([
      [`${WED}T06:00`, `${WED}T09:00`],
      [`${WED}T11:00`, '2026-11-12T02:00'],
    ]);
  });

  it('a block that ends at or before it starts runs past midnight, and free time has no color', () => {
    const t = template();
    const plan = planDay(sources([t], [block(t, { start: '22:00', end: '02:00', title: 'Free', priority: 'free', calendarId: null })]), WED);
    expect(plan.items.find((i) => i.title === 'Free')).toMatchObject({ start: `${WED}T22:00`, end: '2026-11-12T02:00', color: null, priority: 'free' });
  });

  it('shows no routine and no Open time on a date outside every template', () => {
    const t = template();
    const plan = planDay(sources([t], [block(t, { weekday: 3 })]), '2027-01-13');
    expect(plan.templateId).toBeNull();
    expect(plan.items).toEqual([]);
  });

  it('uses the most recently started template when ranges overlap', () => {
    const fall = template();
    const later = template({ effectiveFrom: '2026-11-01', effectiveTo: null });
    expect(activeTemplate([fall, later], WED)?.id).toBe(later.id);
    expect(activeTemplate([fall, later], '2026-10-14')?.id).toBe(fall.id);
  });

  it('hides school-days blocks outside the semester and during its breaks', () => {
    const t = template({ effectiveTo: null });
    const drive = block(t, { title: 'Drive to campus', schoolDaysOnly: true });
    const titles = (date: string) => planDay(sources([t], [drive]), date).items.map((i) => i.title);
    expect(titles(WED)).toContain('Drive to campus');
    expect(titles('2026-11-25')).not.toContain('Drive to campus'); // Thanksgiving week
    expect(titles('2026-12-16')).not.toContain('Drive to campus'); // after the semester
  });

  it('adds classes and events (classes marked as such), and an event after midnight belongs to the night before bedtime', () => {
    const t = template();
    const plan = planDay(sources([t], [], { events: [ev({ courseId: id() }), ev({ title: 'Late show', start: '2026-11-12T00:30', end: '2026-11-12T01:30', color: null })] }), WED);
    expect(plan.items.find((i) => i.title === 'Lab')).toMatchObject({ kind: 'class', color: 'teal' });
    expect(plan.items.find((i) => i.title === 'Late show')).toMatchObject({ kind: 'event', color: 'indigo' });
  });
});

describe('planningDate', () => {
  it('keeps showing yesterday until its bedtime after midnight, then switches', () => {
    const t = template();
    expect(planningDate([t], '2026-11-12T01:00')).toBe(WED); // Wednesday's free night runs to 2:00 AM
    expect(planningDate([t], '2026-11-12T02:00')).toBe('2026-11-12');
    expect(planningDate([t], '2026-11-13T01:00')).toBe('2026-11-13'); // Thursday's bed is 10:00 PM
  });
});

describe('strongerOverlaps', () => {
  it('marks a block covered by a stronger one on the same day, and leaves equals side by side', () => {
    const t = template();
    const work = block(t, { start: '17:00', end: '17:30', title: 'Club work' });
    const game = block(t, { start: '17:00', end: '19:30', title: 'Volleyball', priority: 'high' });
    const read = block(t, { start: '19:00', end: '20:00', title: 'Read' });
    const other = block(t, { start: '19:00', end: '20:00', title: 'Also normal' });
    const covered = strongerOverlaps([work, game, read, other]);
    expect(covered.get(work.id)?.title).toBe('Volleyball');
    expect(covered.get(read.id)?.title).toBe('Volleyball');
    expect(covered.has(game.id)).toBe(false);
    expect(covered.get(other.id)?.id).toBe(game.id); // two normal blocks don't cover each other, but volleyball covers both
  });
});

describe('quoteFor', () => {
  it('gives the same quote all day and the next one tomorrow', () => {
    const quotes = [{ text: 'a', by: 'x' }, { text: 'b', by: 'y' }];
    expect(quoteFor(WED, quotes)).toBe(quoteFor(WED, quotes));
    expect(quoteFor(WED, quotes)).not.toBe(quoteFor('2026-11-12', quotes));
    expect(quoteFor(WED, [])).toBeUndefined();
  });
});

describe('editing quotes as text', () => {
  it('round-trips, strips quote marks, and reports lines with no author instead of guessing', () => {
    const quotes = [{ text: 'Keep going — always.', by: 'Someone Jr.' }]; // a dash inside the quote is fine: the author follows the last one
    expect(parseQuotes(quotesToText(quotes)).quotes).toEqual(quotes);
    expect(parseQuotes('“Be kind.” — A. Person\n\nNo author here\n — Nobody')).toEqual({ quotes: [{ text: 'Be kind.', by: 'A. Person' }], problems: [3, 4] });
  });
});

describe('life happens: who keeps a slot', () => {
  const titles = (plan: ReturnType<typeof planDay>) => plan.items.filter((i) => i.kind !== 'open').map((i) => `${i.title} ${i.start.slice(11)}-${i.end.slice(11)}`);

  it('an event over a high block takes it completely: the event says what it replaced, and the minutes go to Bumped', () => {
    const t = template();
    const game = block(t, { start: '18:00', end: '20:00', title: 'Volleyball', priority: 'high' });
    const plan = planDay(sources([t], [game], { events: [ev({ title: 'Service event', start: `${WED}T18:00`, end: `${WED}T20:00`, color: 'olive' })] }), WED);
    expect(titles(plan)).toEqual(['Service event 18:00-20:00']);
    expect(plan.items.find((i) => i.title === 'Service event')).toMatchObject({ replaces: ['Volleyball'], color: 'olive' });
    expect(plan.bumped).toEqual([expect.objectContaining({ blockId: game.id, minutes: 120, by: 'Service event' })]);
  });

  it('an event in the middle of a block leaves the pieces around it, and only the overlap counts as bumped', () => {
    const t = template();
    const study = block(t, { start: '13:00', end: '15:00' });
    const plan = planDay(sources([t], [study], { events: [ev({ title: 'Call', start: `${WED}T13:45`, end: `${WED}T14:15` })] }), WED);
    expect(titles(plan)).toEqual(['Study 13:00-13:45', 'Call 13:45-14:15', 'Study 14:15-15:00']);
    expect(plan.items.filter((i) => i.title === 'Study').every((i) => i.status === 'trimmed')).toBe(true);
    expect(plan.bumped[0]!.minutes).toBe(30);
  });

  it('drops a leftover piece under 15 minutes', () => {
    const t = template();
    const plan = planDay(sources([t], [block(t, { start: '13:00', end: '14:00' })], { events: [ev({ start: `${WED}T13:10`, end: `${WED}T14:00` })] }), WED);
    expect(plan.items.some((i) => i.title === 'Study')).toBe(false);
  });

  it('an event over a commitment bumps nothing and shows the conflict', () => {
    const t = template();
    const hours = block(t, { start: '12:00', end: '13:00', title: 'Office hours', priority: 'commitment' });
    const plan = planDay(sources([t], [hours], { events: [ev({ title: 'Interview', start: `${WED}T12:30`, end: `${WED}T13:30` })] }), WED);
    expect(plan.bumped).toEqual([]);
    expect(plan.items.find((i) => i.title === 'Office hours')).toMatchObject({ start: `${WED}T12:00`, end: `${WED}T13:00` });
    expect(plan.items.find((i) => i.title === 'Interview')?.clashes).toEqual(['Office hours']);
  });

  it('free time gives way to events but never goes to Bumped', () => {
    const t = template();
    const plan = planDay(sources([t], [block(t, { start: '22:00', end: '23:00', title: 'Free', priority: 'free', calendarId: null })], { events: [ev({ start: `${WED}T22:00`, end: `${WED}T23:00` })] }), WED);
    expect(plan.bumped).toEqual([]);
  });

  it('inside the template the high block hides the part of a normal block it covers (not bumped), and skipping it brings that part back', () => {
    const t = template();
    const work = block(t, { start: '17:00', end: '17:30', title: 'Club work' });
    const game = block(t, { start: '17:00', end: '19:30', title: 'Volleyball', priority: 'high' });
    expect(titles(planDay(sources([t], [work, game]), WED))).toEqual(['Volleyball 17:00-19:30']);
    expect(planDay(sources([t], [work, game]), WED).bumped).toEqual([]);
    const skipped = planDay(sources([t], [work, game], { overrides: [override({ routineBlockId: game.id })] }), WED);
    expect(titles(skipped)).toEqual(['Club work 17:00-17:30']);
    expect(skipped.bumped).toEqual([expect.objectContaining({ title: 'Volleyball', minutes: 150, by: 'Skipped' })]);
  });

  it('moves a block for one day without bumping it, and a make-up adds a block on another day', () => {
    const t = template();
    const study = block(t, { start: '13:00', end: '15:00' });
    const moved = planDay(sources([t], [study], { overrides: [override({ routineBlockId: study.id, action: 'move', start: `${WED}T16:00`, end: `${WED}T18:00` })] }), WED);
    expect(titles(moved)).toEqual(['Study 16:00-18:00']);
    expect(moved.bumped).toEqual([]);
    const makeup = override({ date: '2026-11-12', routineBlockId: study.id, action: 'makeup', start: '2026-11-12T10:00', end: '2026-11-12T11:00', sourceDate: WED });
    expect(planDay(sources([t], [study], { overrides: [makeup] }), '2026-11-12').items.find((i) => i.makeup)).toMatchObject({ title: 'Study', start: '2026-11-12T10:00' });
  });

  it('lists bumped time until it is made up or let go', () => {
    const t = template();
    const study = block(t, { start: '13:00', end: '15:00' });
    const src = sources([t], [study], { events: [ev({ start: `${WED}T13:00`, end: `${WED}T14:00` })] });
    expect(openBumps(src, '2026-11-09', '2026-11-13')).toHaveLength(1);
    const letgo = override({ routineBlockId: study.id, action: 'letgo', sourceDate: WED });
    expect(openBumps({ ...src, overrides: [letgo] }, '2026-11-09', '2026-11-13')).toEqual([]);
  });

  it('suggests make-up slots only in Open time: never on classes, events, commitments, high or free blocks', () => {
    const t = template({ days: [{ weekday: 3, wake: '08:00', bed: '12:00' }, { weekday: 4, wake: '08:00', bed: '10:00' }] });
    const blocks = [
      block(t, { start: '08:00', end: '09:00', title: 'Commitment', priority: 'commitment' }),
      block(t, { start: '09:00', end: '10:00', title: 'Game', priority: 'high' }),
      block(t, { start: '10:00', end: '11:00', title: 'Free', priority: 'free', calendarId: null }),
    ];
    const src = sources([t], blocks, { events: [ev({ start: `${WED}T11:00`, end: `${WED}T11:30` })] });
    expect(openSlots(src, 30, `${WED}T07:00`, { days: 1 })).toEqual([
      { start: `${WED}T11:30`, end: `${WED}T12:00`, inWindow: false },
      { start: '2026-11-12T08:00', end: '2026-11-12T08:30', inWindow: false },
    ]);
  });

  it('finds a time inside the meeting windows first', () => {
    const t = template({ days: [{ weekday: 3, wake: '08:00', bed: '20:00' }], meetingWindows: [{ weekday: 3, start: '15:00', end: '18:00' }] });
    const slots = openSlots(sources([t], []), 60, `${WED}T08:00`, { days: 0, windowsFirst: true, count: 2 });
    expect(slots[0]).toEqual({ start: `${WED}T15:00`, end: `${WED}T16:00`, inWindow: true });
  });
});
