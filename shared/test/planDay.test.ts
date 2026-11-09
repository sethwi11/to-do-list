import { describe, expect, it } from 'vitest';
import { activeTemplate, planDay, planningDate, parseQuotes, quoteFor, quotesToText, strongerOverlaps, type Event, type PlanSources, type RoutineBlock, type Semester, type WeekTemplate } from '../src';

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
const semester: Semester = { id: id(), name: 'Fall', startDate: '2026-08-20', endDate: '2026-12-10', excludedRanges: [{ start: '2026-11-25', end: '2026-11-29', label: 'Thanksgiving' }], archived: false, createdAt: NOW };
const sources = (templates: WeekTemplate[], blocks: RoutineBlock[], extra: Partial<PlanSources> = {}): PlanSources => ({
  templates, blocks, semesters: [semester], events: [], timeBlocks: [], tasks: [], calendars: [{ id: CAL, color: 'indigo' }], ...extra,
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

  it('adds classes and events, classes marked as such, sitting beside overlapping routine', () => {
    const t = template();
    const ev = (over: Partial<Event>): Event => ({
      id: id(), title: 'Lab', start: `${WED}T09:30`, end: `${WED}T10:30`, allDay: false, calendarId: CAL, typeId: null, location: null, link: null, notes: null, color: 'teal',
      reminderMinutes: null, recurrence: null, recurringEventId: null, originalStart: null, courseId: null, applicationId: null, source: 'manual', createdAt: NOW, updatedAt: NOW, ...over,
    });
    const plan = planDay(sources([t], [block(t, {})], { events: [ev({ courseId: id() }), ev({ title: 'Late show', start: '2026-11-12T00:30', end: '2026-11-12T01:30', color: null })] }), WED);
    expect(plan.items.find((i) => i.title === 'Lab')).toMatchObject({ kind: 'class', color: 'teal' });
    expect(plan.items.find((i) => i.title === 'Late show')).toMatchObject({ kind: 'event', color: 'indigo' }); // after midnight, before bedtime
    expect(plan.items.some((i) => i.title === 'Study')).toBe(true);
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
