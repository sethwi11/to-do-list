import { describe, expect, it } from 'vitest';
import { biggestWants, budgetSummary, formatCents, holdingStats, parseCents, periodOf, planMove, portfolio, recurringCosts, savingsProgress, unsettledPeriods, type Expense, type Holding, type MoneyMove, type SavingsGoal } from '../src';

const NOW = '2026-01-01T00:00:00.000Z';
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const FOOD = id();
const FUN = id();
const exp = (date: string, amountCents: number, over: Partial<Expense> = {}): Expense => ({ id: id(), amountCents, what: 'Lunch', categoryId: FOOD, date, kind: 'need', recurring: false, createdAt: NOW, updatedAt: NOW, ...over });
const move = (over: Partial<MoneyMove>): MoneyMove => ({ id: id(), date: '2026-11-02', periodStart: null, toType: 'kept', toId: null, amountCents: 1, note: null, createdAt: NOW, ...over });

describe('typing and showing money', () => {
  it('reads what you type as whole cents, and rejects anything else', () => {
    expect(parseCents('12.5')).toBe(1250);
    expect(parseCents('$1,234.56')).toBe(123456);
    expect(parseCents('.99')).toBe(99);
    expect(parseCents('7')).toBe(700);
    for (const bad of ['', 'abc', '0', '-5', '1.234', '1.2.3', '$', '99999999999']) expect(parseCents(bad), bad).toBeNull();
    expect(parseCents('0', { allowZero: true })).toBe(0); // what a holding is worth can be nothing
    expect(parseCents('-1', { allowZero: true })).toBeNull();
  });
  it('shows U.S. style, dropping .00', () => {
    expect([120000, 1250, 5, 0, -500, 123456789].map(formatCents)).toEqual(['$1,200', '$12.50', '$0.05', '$0', '-$5', '$1,234,567.89']);
  });
});

describe('budget periods', () => {
  it('a month runs from the 1st; a week from Monday, across month and year ends', () => {
    expect(periodOf('2026-11-18', 'month')).toEqual({ start: '2026-11-01', end: '2026-12-01' });
    expect(periodOf('2026-12-31', 'month')).toEqual({ start: '2026-12-01', end: '2027-01-01' });
    expect(periodOf('2026-11-08', 'week')).toEqual({ start: '2026-11-02', end: '2026-11-09' }); // a Sunday belongs to the week before
    expect(periodOf('2026-11-09', 'week')).toEqual({ start: '2026-11-09', end: '2026-11-16' });
  });
});

describe('the budget summary', () => {
  const expenses = [
    exp('2026-10-20', 30000), // last month
    exp('2026-11-02', 10000, { categoryId: FOOD }),
    exp('2026-11-03', 5000, { categoryId: FUN, kind: 'want' }),
    exp('2026-11-04', 2500, { categoryId: FUN, kind: 'want' }),
    exp('2026-11-05', 4000, { categoryId: null, kind: 'want' }),
    exp('2026-12-01', 99999), // next month: not counted
  ];
  const s = budgetSummary(expenses, 100000, 'month', '2026-11-10');

  it('adds up what is spent and left, and what was spent last period', () => {
    expect(s).toMatchObject({ spentCents: 21500, leftCents: 78500, lastSpentCents: 30000, wantCents: 11500, needCents: 10000 });
  });
  it('projects the pace from the days gone: $215 in 10 of 30 days is $645', () => {
    expect(s).toMatchObject({ days: 30, elapsed: 10, paceCents: 64500 });
  });
  it('can go over budget, counts the first day of a period as one day, and works by the week', () => {
    expect(budgetSummary([exp('2026-11-02', 50000)], 20000, 'month', '2026-11-10').leftCents).toBe(-30000);
    expect(budgetSummary([exp('2026-12-01', 3000)], 100000, 'month', '2026-12-01')).toMatchObject({ elapsed: 1, paceCents: 93000 });
    expect(budgetSummary(expenses, 100000, 'week', '2026-11-04')).toMatchObject({ period: { start: '2026-11-02', end: '2026-11-09' }, spentCents: 21500, elapsed: 3 });
  });
  it('groups by category, biggest first, and names the three biggest wants', () => {
    expect(s.byCategory.map((c) => [c.categoryId, c.cents])).toEqual([[FOOD, 10000], [FUN, 7500], [null, 4000]]);
    expect(biggestWants(s).map((c) => [c.categoryId, c.wantCents])).toEqual([[FUN, 7500], [null, 4000]]); // food was all a need
  });
});

describe('recurring costs', () => {
  it('lists each once at its latest amount, and says whether this month has been entered', () => {
    const list = recurringCosts([
      exp('2026-09-05', 1000, { what: 'Music', recurring: true }),
      exp('2026-10-05', 1200, { what: 'music ', recurring: true }),
      exp('2026-11-02', 4500, { what: 'Gym', recurring: true }),
      exp('2026-11-03', 999, { what: 'Coffee' }),
    ], '2026-11-10');
    expect(list.map((c) => [c.what, c.amountCents, c.enteredThisMonth])).toEqual([['Gym', 4500, true], ['music ', 1200, false]]);
  });
});

describe('leftover money and moving it', () => {
  const lastMonth = [exp('2026-10-10', 60000)]; // leaves 400.00 of a 1,000.00 budget
  it('a finished period with money left counts as saved until it is moved; the current period never does', () => {
    const [u] = unsettledPeriods([...lastMonth, exp('2026-11-02', 1000)], [], 100000, 'month', '2026-11-10');
    expect(u).toMatchObject({ period: { start: '2026-10-01' }, leftCents: 40000, movedCents: 0, remainingCents: 40000 });
    expect(unsettledPeriods([exp('2026-11-02', 1000)], [], 100000, 'month', '2026-11-10')).toEqual([]);
  });
  it('rolls over: each finished month stands alone, and months before your first expense do not count', () => {
    const list = unsettledPeriods([exp('2026-09-10', 90000), exp('2026-10-10', 100000), exp('2026-11-02', 1)], [], 100000, 'month', '2026-11-10');
    expect(list.map((p) => [p.period.start, p.leftCents])).toEqual([['2026-09-01', 10000]]); // October used it all; August is before the first expense
  });
  it('partly moved leaves the rest; fully settled (moved or kept) disappears; an overspent month never shows', () => {
    const goal = id();
    const partial = move({ periodStart: '2026-10-01', toType: 'goal', toId: goal, amountCents: 15000 });
    expect(unsettledPeriods(lastMonth, [partial], 100000, 'month', '2026-11-10')[0]).toMatchObject({ movedCents: 15000, remainingCents: 25000 });
    const kept = move({ periodStart: '2026-10-01', amountCents: 25000 });
    expect(unsettledPeriods(lastMonth, [partial, kept], 100000, 'month', '2026-11-10')).toEqual([]);
    expect(unsettledPeriods([exp('2026-10-10', 120000)], [], 100000, 'month', '2026-11-10')).toEqual([]);
    expect(unsettledPeriods(lastMonth, [], 0, 'month', '2026-11-10')).toEqual([]); // no budget set
  });
  it('splits a leftover between goals and holdings, and keeps the rest as cash so it is settled', () => {
    const goal = id();
    const hold = id();
    expect(planMove(40000, [{ toType: 'goal', toId: goal, amountCents: 20000 }, { toType: 'holding', toId: hold, amountCents: 5000 }])).toEqual({
      rows: [{ toType: 'goal', toId: goal, amountCents: 20000 }, { toType: 'holding', toId: hold, amountCents: 5000 }, { toType: 'kept', toId: null, amountCents: 15000 }],
    });
    expect(planMove(40000, [{ toType: 'goal', toId: goal, amountCents: 40000 }])).toEqual({ rows: [{ toType: 'goal', toId: goal, amountCents: 40000 }] });
    expect(planMove(40000, [])).toEqual({ rows: [{ toType: 'kept', toId: null, amountCents: 40000 }] });
  });
  it('refuses to move more than what is left', () => {
    expect(planMove(40000, [{ toType: 'goal', toId: id(), amountCents: 45000 }])).toEqual({ error: "That's $50 more than what's left ($400)." });
  });
});

describe('goals and holdings', () => {
  const goal: SavingsGoal = { id: id(), name: 'A house', targetCents: 1000000, sortOrder: 1, createdAt: NOW, updatedAt: NOW };
  const hold = (over: Partial<Holding>): Holding => ({ id: id(), name: 'Index fund', type: 'etf', valueCents: 0, valueUpdatedOn: '2026-11-01', monthlyTargetCents: null, sortOrder: 1, createdAt: NOW, updatedAt: NOW, ...over });

  it('a goal’s progress is what was moved to it, capped at the target', () => {
    const moves = [move({ toType: 'goal', toId: goal.id, amountCents: 250000 }), move({ toType: 'goal', toId: id(), amountCents: 999 })];
    expect(savingsProgress(goal, moves)).toEqual({ savedCents: 250000, share: 0.25 });
    expect(savingsProgress(goal, [move({ toType: 'goal', toId: goal.id, amountCents: 2000000 })]).share).toBe(1);
  });
  it('totals put in, worth now and gain or loss, in dollars and percent', () => {
    const a = hold({ valueCents: 55000 });
    const b = hold({ type: 'crypto', valueCents: 8000 });
    const moves = [move({ toType: 'holding', toId: a.id, amountCents: 50000 }), move({ toType: 'holding', toId: b.id, amountCents: 10000 })];
    expect(holdingStats(a, moves, '2026-11-10')).toMatchObject({ putInCents: 50000, worthCents: 55000, gainCents: 5000, gainRatio: 0.1 });
    expect(holdingStats(b, moves, '2026-11-10')).toMatchObject({ gainCents: -2000, gainRatio: -0.2 });
    expect(portfolio([a, b], moves, '2026-11-10')).toMatchObject({ putInCents: 60000, worthCents: 63000, gainCents: 3000, gainRatio: 0.05 });
  });
  it('has no percent before anything is put in, and an allocation by type that adds to the whole', () => {
    const lone = hold({ valueCents: 10000 });
    expect(holdingStats(lone, [], '2026-11-10').gainRatio).toBeNull();
    const p = portfolio([lone, hold({ type: 'savings', valueCents: 30000 }), hold({ valueCents: 10000 }), hold({ type: 'other', valueCents: 0 })], [], '2026-11-10');
    expect(p.allocation.map((a) => [a.type, a.cents, a.share])).toEqual([['etf', 20000, 0.4], ['savings', 30000, 0.6]].sort((x, y) => (y[1] as number) - (x[1] as number)));
    expect(p.allocation.reduce((s, a) => s + a.share, 0)).toBeCloseTo(1);
  });
  it('counts this month’s contributions against the monthly target', () => {
    const h = hold({ monthlyTargetCents: 5000 });
    const moves = [move({ date: '2026-11-03', toType: 'holding', toId: h.id, amountCents: 2500 }), move({ date: '2026-10-28', toType: 'holding', toId: h.id, amountCents: 5000 })];
    expect(holdingStats(h, moves, '2026-11-10').monthly).toEqual({ targetCents: 5000, thisMonthCents: 2500 });
    expect(holdingStats(hold({}), moves, '2026-11-10').monthly).toBeNull();
  });
});
