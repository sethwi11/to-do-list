import { addDays, addMonths, dayOfWeek } from './dateMath';
import { daysBetween } from './dateTime';
import type { BudgetSettings, Expense, ExpenseKind, Holding, HoldingType, MoneyMove, MoveTarget, SavingsGoal } from './models/money';

// The money math: budget periods, what's left, pace, leftovers to move, goals and holdings. Whole cents throughout; tracking only, never advice.

/** "$12.50", "$1,200", "-$5": whole dollars drop the cents. Always U.S. style, whatever the device's region. */
export function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100).toLocaleString('en-US');
  const rest = abs % 100;
  return `${cents < 0 ? '-' : ''}$${dollars}${rest ? `.${String(rest).padStart(2, '0')}` : ''}`;
}

/** What you typed ("12.5", "$1,234.56") as cents, or null if it isn't a positive amount of at most two decimals (`allowZero` lets 0 through, for what a holding is worth). */
export function parseCents(text: string, { allowZero = false }: { allowZero?: boolean } = {}): number | null {
  const clean = text.trim().replace(/^\$/, '').replace(/[,\s]/g, '');
  if (!/^(\d+\.?\d{0,2}|\.\d{1,2})$/.test(clean)) return null;
  const [whole = '', fraction = ''] = clean.split('.');
  const cents = Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0'));
  return cents >= (allowZero ? 0 : 1) && cents <= 1_000_000_000 ? cents : null;
}

/** A budget period: its first day and the day after its last. */
export interface Period {
  start: string;
  end: string;
}

/** The month (from the 1st) or the week (from Monday) a date is in. */
export function periodOf(date: string, period: BudgetSettings['period']): Period {
  if (period === 'month') {
    const start = `${date.slice(0, 8)}01`;
    return { start, end: addMonths(start, 1) };
  }
  const start = addDays(date, -((dayOfWeek(date) + 6) % 7));
  return { start, end: addDays(start, 7) };
}

export const previousPeriod = (p: Period, period: BudgetSettings['period']): Period => periodOf(addDays(p.start, -1), period);
const inPeriod = (date: string, p: Period) => date >= p.start && date < p.end;
const sum = (xs: readonly { amountCents: number }[]) => xs.reduce((n, x) => n + x.amountCents, 0);
export const spentIn = (expenses: readonly Expense[], p: Period) => sum(expenses.filter((e) => inPeriod(e.date, p)));

export interface CategorySpend {
  categoryId: string | null;
  cents: number;
  wantCents: number;
}

export interface BudgetSummary {
  period: Period;
  budgetCents: number;
  spentCents: number;
  /** Negative when over. */
  leftCents: number;
  days: number;
  /** Days gone, today included (clamped to the period). */
  elapsed: number;
  /** Where spending lands by the end of the period at this rate. */
  paceCents: number;
  byCategory: CategorySpend[];
  wantCents: number;
  needCents: number;
  lastSpentCents: number;
}

export function budgetSummary(expenses: readonly Expense[], budgetCents: number, period: BudgetSettings['period'], today: string): BudgetSummary {
  const p = periodOf(today, period);
  const mine = expenses.filter((e) => inPeriod(e.date, p));
  const days = daysBetween(p.start, p.end);
  const elapsed = Math.min(days, Math.max(1, daysBetween(p.start, today) + 1));
  const spent = sum(mine);
  const byCategory = new Map<string | null, CategorySpend>();
  for (const e of mine) {
    const c = byCategory.get(e.categoryId) ?? { categoryId: e.categoryId, cents: 0, wantCents: 0 };
    c.cents += e.amountCents;
    if (e.kind === 'want') c.wantCents += e.amountCents;
    byCategory.set(e.categoryId, c);
  }
  const wantCents = sum(mine.filter((e) => e.kind === 'want'));
  return {
    period: p,
    budgetCents,
    spentCents: spent,
    leftCents: budgetCents - spent,
    days,
    elapsed,
    paceCents: Math.round((spent / elapsed) * days),
    byCategory: [...byCategory.values()].sort((a, b) => b.cents - a.cents),
    wantCents,
    needCents: spent - wantCents,
    lastSpentCents: spentIn(expenses, previousPeriod(p, period)),
  };
}

/** Your biggest "want" categories this period, as plain numbers (no advice). */
export const biggestWants = (summary: BudgetSummary, n = 3): CategorySpend[] => summary.byCategory.filter((c) => c.wantCents > 0).sort((a, b) => b.wantCents - a.wantCents).slice(0, n);

export interface RecurringCost {
  what: string;
  amountCents: number;
  categoryId: string | null;
  kind: ExpenseKind;
  lastDate: string;
  /** Already entered this calendar month. */
  enteredThisMonth: boolean;
}

/** Costs marked "repeats every month": each one's latest amount, and whether this month's has been entered yet. */
export function recurringCosts(expenses: readonly Expense[], today: string): RecurringCost[] {
  const month = today.slice(0, 7);
  const groups = new Map<string, Expense[]>();
  for (const e of expenses.filter((x) => x.recurring)) {
    const key = e.what.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups.values()]
    .map((list) => {
      const latest = list.reduce((a, b) => (b.date >= a.date ? b : a));
      return { what: latest.what, amountCents: latest.amountCents, categoryId: latest.categoryId, kind: latest.kind, lastDate: latest.date, enteredThisMonth: list.some((e) => e.date.slice(0, 7) === month) };
    })
    .sort((a, b) => b.amountCents - a.amountCents);
}

export interface UnsettledPeriod {
  period: Period;
  /** What was left of the budget when it ended. */
  leftCents: number;
  /** Already moved (or kept) from it. */
  movedCents: number;
  remainingCents: number;
}

/** Finished periods with money left over that hasn't all been moved yet, oldest first. Only periods from your first expense on, and at most `max` back. */
export function unsettledPeriods(expenses: readonly Expense[], moves: readonly MoneyMove[], budgetCents: number, period: BudgetSettings['period'], today: string, max = 12): UnsettledPeriod[] {
  if (budgetCents <= 0 || expenses.length === 0) return [];
  const first = periodOf(expenses.reduce((d, e) => (e.date < d ? e.date : d), expenses[0]!.date), period);
  const out: UnsettledPeriod[] = [];
  let p = previousPeriod(periodOf(today, period), period);
  for (let i = 0; i < max && p.start >= first.start; i++, p = previousPeriod(p, period)) {
    const leftCents = budgetCents - spentIn(expenses, p);
    const movedCents = sum(moves.filter((m) => m.periodStart === p.start));
    if (leftCents > 0 && leftCents > movedCents) out.unshift({ period: p, leftCents, movedCents, remainingCents: leftCents - movedCents });
  }
  return out;
}

export interface Allocation {
  toType: MoveTarget;
  toId: string | null;
  amountCents: number;
}

/** Splits a leftover between goals and holdings; whatever isn't allocated is kept as cash, which settles the period. */
export function planMove(remainingCents: number, allocations: readonly Allocation[]): { rows: Allocation[] } | { error: string } {
  const rows = allocations.filter((a) => a.amountCents > 0);
  if (rows.some((a) => !Number.isInteger(a.amountCents) || a.toType === 'kept' || a.toId === null)) return { error: 'Each amount must go to a goal or a holding.' };
  const moved = rows.reduce((n, a) => n + a.amountCents, 0);
  if (moved > remainingCents) return { error: `That's ${formatCents(moved - remainingCents)} more than what's left (${formatCents(remainingCents)}).` };
  return { rows: moved < remainingCents ? [...rows, { toType: 'kept', toId: null, amountCents: remainingCents - moved }] : rows };
}

const movedTo = (moves: readonly MoneyMove[], toType: MoveTarget, toId: string) => moves.filter((m) => m.toType === toType && m.toId === toId);

export function savingsProgress(goal: SavingsGoal, moves: readonly MoneyMove[]): { savedCents: number; share: number } {
  const savedCents = sum(movedTo(moves, 'goal', goal.id));
  return { savedCents, share: Math.min(1, savedCents / goal.targetCents) };
}

export interface HoldingStats {
  putInCents: number;
  worthCents: number;
  gainCents: number;
  /** Gain as a fraction of what was put in (0.1 = 10%); null before anything is put in. */
  gainRatio: number | null;
  /** This calendar month's contributions against its monthly target, if it has one. */
  monthly: { targetCents: number; thisMonthCents: number } | null;
}

export function holdingStats(holding: Holding, moves: readonly MoneyMove[], today: string): HoldingStats {
  const mine = movedTo(moves, 'holding', holding.id);
  const putInCents = sum(mine);
  const gainCents = holding.valueCents - putInCents;
  return {
    putInCents,
    worthCents: holding.valueCents,
    gainCents,
    gainRatio: putInCents > 0 ? gainCents / putInCents : null,
    monthly: holding.monthlyTargetCents ? { targetCents: holding.monthlyTargetCents, thisMonthCents: sum(mine.filter((m) => m.date.slice(0, 7) === today.slice(0, 7))) } : null,
  };
}

export interface Portfolio {
  putInCents: number;
  worthCents: number;
  gainCents: number;
  gainRatio: number | null;
  /** Each type's share of what everything is worth now, largest first. */
  allocation: { type: HoldingType; cents: number; share: number }[];
}

export function portfolio(holdings: readonly Holding[], moves: readonly MoneyMove[], today: string): Portfolio {
  const stats = holdings.map((h) => holdingStats(h, moves, today));
  const putInCents = stats.reduce((n, s) => n + s.putInCents, 0);
  const worthCents = stats.reduce((n, s) => n + s.worthCents, 0);
  const byType = new Map<HoldingType, number>();
  holdings.forEach((h) => byType.set(h.type, (byType.get(h.type) ?? 0) + h.valueCents));
  return {
    putInCents,
    worthCents,
    gainCents: worthCents - putInCents,
    gainRatio: putInCents > 0 ? (worthCents - putInCents) / putInCents : null,
    allocation: [...byType.entries()].filter(([, cents]) => cents > 0).map(([type, cents]) => ({ type, cents, share: cents / worthCents })).sort((a, b) => b.cents - a.cents),
  };
}
