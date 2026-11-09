import { describe, expect, it } from 'vitest';
import { DEFAULT_BUDGET, openBumps, reviewSummary, scoreboard, weekRange, workloadByDay, type MoneyMove, type ScoreInputs, type Expense } from '../src';
import { CALENDARS, CS, GYM, NOW, READING, REAL_ESTATE, SCHOOL, block, checkIn, gymBlocks, id, otherBlocks, override, sentOn, source, studyBlocks } from './week';

const WEEK = '2026-11-02';
// Each weekday has its own Study block, so a skip names that day's.
const studyOn = (weekday: number) => studyBlocks.find((b) => b.weekday === weekday)!;

const all = [...gymBlocks, ...studyBlocks, ...otherBlocks];
const exp = (date: string, amountCents: number): Expense => ({ id: id(), amountCents, what: 'Lunch', categoryId: null, date, kind: 'need', recurring: false, createdAt: NOW, updatedAt: NOW });
const move = (date: string, toType: MoneyMove['toType'], amountCents: number): MoneyMove => ({ id: id(), date, periodStart: null, toType, toId: null, amountCents, note: null, createdAt: NOW });

function inputs(over: Partial<ScoreInputs> = {}): ScoreInputs {
  const src = over.src ?? source(all);
  const c = (date: string, title: string, status: 'done' | 'part' | 'skipped' = 'done', o = {}) => checkIn(src, date, title, status, o);
  const checkIns = over.checkIns ?? [
      c('2026-11-02', 'Gym'), c('2026-11-03', 'Gym'), c('2026-11-04', 'Gym'), c('2026-11-05', 'Gym', 'part'), c('2026-11-06', 'Gym', 'skipped'),
      c('2026-11-02', 'Study'), c('2026-11-03', 'Study', 'done', { usedAlt: true }), c('2026-11-04', 'Study', 'part'),
      c('2026-11-03', 'Property research'), c('2026-11-02', 'LeetCode'), c('2026-11-04', 'LeetCode'),
    ];
  return {
    src,
    checkIns,
    applications: [sentOn('2026-11-03'), sentOn('2026-11-08'), sentOn('2026-11-09')],
    calendars: CALENDARS,
    expenses: [exp('2026-10-30', 700), exp('2026-11-02', 1000), exp('2026-11-08', 500)],
    moves: [move('2026-10-30', 'goal', 9999), move('2026-11-05', 'goal', 2000), move('2026-11-06', 'holding', 3000), move('2026-11-07', 'kept', 400)],
    budget: { amountCents: 100000, period: 'month' },
    ...over,
  };
}

describe('weekRange', () => {
  it('runs Monday to Sunday, and a Sunday belongs to the week before it', () => {
    expect(weekRange('2026-11-04')).toEqual(['2026-11-02', '2026-11-08']);
    expect(weekRange('2026-11-08')).toEqual(['2026-11-02', '2026-11-08']);
    expect(weekRange('2026-11-09')).toEqual(['2026-11-09', '2026-11-15']);
  });
});

describe('the weekly scoreboard', () => {
  // Thu 5 and Fri 6 of Study are skipped (bumped), so only Mon to Wed of Study are planned.
  const skips = [override({ date: '2026-11-05', routineBlockId: studyOn(4).id, action: 'skip' }), override({ date: '2026-11-06', routineBlockId: studyOn(5).id, action: 'skip' })];
  const letGo = override({ date: '2026-11-06', routineBlockId: studyOn(5).id, action: 'letgo', sourceDate: '2026-11-06' });
  const week = scoreboard(inputs({ src: source(all, [...skips, letGo]) }), WEEK, '2026-11-08');
  const hours = (calendarId: string) => week.categories.find((c) => c.calendarId === calendarId);

  it('adds planned and done minutes per category: Done counts in full, Part for half, Skipped for nothing, free time not at all', () => {
    expect(hours(GYM)).toMatchObject({ plannedMinutes: 360, doneMinutes: 210 }); // 3 done + half of 1 part
    expect(hours(CS)).toMatchObject({ plannedMinutes: 120, doneMinutes: 120 });
    expect(hours(REAL_ESTATE)).toMatchObject({ plannedMinutes: 60, doneMinutes: 60 });
    expect(week.categories.some((c) => c.calendarId === null)).toBe(false);
  });
  it('counts the "or instead" for its own category', () => {
    expect(hours(SCHOOL)).toMatchObject({ plannedMinutes: 360, doneMinutes: 180 }); // Monday done + half of Wednesday
    expect(hours(READING)).toMatchObject({ plannedMinutes: 0, doneMinutes: 120 }); // Tuesday's Study was Reading
  });
  it('sorts by what was planned', () => {
    expect(week.categories.map((c) => c.calendarId)).toEqual([GYM, SCHOOL, CS, REAL_ESTATE, READING]);
  });
  it('counts gym days (a part counts, a skip does not) and LeetCode sessions', () => {
    expect(week.gymDays).toBe(4);
    expect(week.leetcodeSessions).toBe(2);
  });
  it('reads real estate and reading hours from the categories by name', () => {
    expect(week.realEstateMinutes).toBe(60);
    expect(week.readingMinutes).toBe(120);
  });
  it('counts applications sent that week only', () => {
    expect(week.applicationsSent).toBe(2);
  });
  it('totals the money: spent against the month, and saved and invested that week only', () => {
    expect(week).toMatchObject({ spentCents: 1500, periodSpentCents: 1500, budgetCents: 100000, budgetPeriod: 'month', savedCents: 2400, investedCents: 3000 });
  });
  it('splits bumped time into made up, let go and still open', () => {
    expect(week.bumped).toEqual({ madeUpMinutes: 0, letGoMinutes: 120, openMinutes: 120 });
    const madeUp = override({ date: '2026-11-07', routineBlockId: studyOn(4).id, action: 'makeup', start: '2026-11-07T16:00', end: '2026-11-07T18:00', sourceDate: '2026-11-05' });
    const again = scoreboard(inputs({ src: source(all, [skips[0]!, madeUp]) }), WEEK, '2026-11-08');
    expect(again.bumped).toEqual({ madeUpMinutes: 120, letGoMinutes: 0, openMinutes: 0 });
  });
  it('does not score days that have not happened yet', () => {
    const wed = scoreboard(inputs(), WEEK, '2026-11-04');
    expect(wed.categories.find((c) => c.calendarId === GYM)?.plannedMinutes).toBe(180); // Mon to Wed
    expect(wed.weekEnd).toBe('2026-11-08');
  });
  it('is all zeros for a week with nothing in it', () => {
    const empty = scoreboard(inputs({ src: source([]), checkIns: [], applications: [], expenses: [], moves: [], budget: DEFAULT_BUDGET }), WEEK, '2026-11-08');
    expect(empty).toMatchObject({ categories: [], gymDays: 0, leetcodeSessions: 0, applicationsSent: 0, spentCents: 0, savedCents: 0, investedCents: 0, bumped: { madeUpMinutes: 0, letGoMinutes: 0, openMinutes: 0 } });
  });
});

describe('the summary for Claude', () => {
  const src = source(all, [override({ date: '2026-11-05', routineBlockId: studyOn(4).id, action: 'skip' })]);
  const score = scoreboard(inputs({ src }), WEEK, '2026-11-08');
  const names = new Map(CALENDARS.map((c) => [c.id, c.name]));
  // One task due Wednesday makes it the only day with anything planned.
  const nextWeek = [...workloadByDay('2026-11-09', '2026-11-16', { events: [], blocks: [], tasks: [{ dueDate: '2026-11-11', priority: 'high', status: 'todo' }] }).values()];
  const base = { score, names, unmadeUp: openBumps(src, WEEK, '2026-11-08'), missedTasks: ['Call the landlord'], learned: [{ date: '2026-11-03', title: 'LeetCode', learned: 'Two pointers beat nested loops' }], nextWeek, priorities: ['Send 5 applications', 'Gym every day'], notes: '' };
  const text = reviewSummary(base);

  it('is plain Markdown that ends where the questions go', () => {
    expect(text.startsWith('# Week of Nov 2 to Nov 8\n')).toBe(true); // a finished week has no "so far"
    expect(reviewSummary({ ...base, score: scoreboard(inputs({ src }), WEEK, '2026-11-04') }).startsWith('# Week of Nov 2 to Nov 8 (so far, through Wed Nov 4)\n')).toBe(true);
    expect(text.endsWith('\nQuestions for Claude:')).toBe(true);
    expect(text).not.toMatch(/undefined|NaN|\[object/);
  });
  it('leads with the numbers and then what needs a decision', () => {
    expect(text).toContain('## Hours done of planned (Part counts half)\n');
    expect(text).toContain('- Gym: 3h 30m of 6h');
    expect(text).toContain('Gym days 4 · LeetCode sessions 2 · Applications sent 2');
    expect(text).toContain('Spent $15 ($15 of $1,000 this month) · saved $24 · invested $30');
    expect(text).toContain('- Study (Thu Nov 5, 2h)');
    expect(text).toContain('- Call the landlord');
    expect(text).toContain('- Tue Nov 3, LeetCode: Two pointers beat nested loops');
    expect(text).toContain('1. Send 5 applications\n2. Gym every day');
    // Only days with something on them get a line, with how heavy; the empty days share one.
    expect(text).toContain('## Next week\n- Wed Nov 11: Moderate, 1 task due\n- Nothing planned: Mon Nov 9, Tue Nov 10, Thu Nov 12, Fri Nov 13, Sat Nov 14, Sun Nov 15\n');
  });
  it('leaves out sections with nothing in them', () => {
    const quiet = reviewSummary({ ...base, unmadeUp: [], missedTasks: [], learned: [], nextWeek: [], priorities: [], notes: '' });
    for (const heading of ['Not made up', 'Missed to-dos', 'Learned', 'Next week', 'My priorities', 'Notes']) expect(quiet).not.toContain(heading);
    expect(quiet.endsWith('Questions for Claude:')).toBe(true);
  });
  it('adds your notes when there are some', () => {
    expect(reviewSummary({ ...base, notes: ' Tired after Thursday. ' })).toContain('## Notes\nTired after Thursday.');
  });
});
