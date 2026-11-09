import { appliedDate } from './applications';
import { addDays, dayOfWeek } from './dateMath';
import { eachDate, minutesBetween } from './dateTime';
import { budgetSummary } from './money';
import type { Application } from './models/applications';
import type { Calendar } from './models/calendars';
import type { CheckIn } from './models/checkins';
import type { BudgetSettings, Expense, MoneyMove } from './models/money';
import { planDay, type PlanItem, type PlanSources } from './planDay';
import { didIt, GYM, LEETCODE } from './streaks';

// The weekly scoreboard: what the week's plan and check-ins add up to. Everything here comes from data you entered; nothing is guessed.

/** Monday to Sunday of the week a date is in. */
export function weekRange(date: string): [string, string] {
  const monday = addDays(date, -((dayOfWeek(date) + 6) % 7));
  return [monday, addDays(monday, 6)];
}

/** One planned thing on a day: a block cut into pieces counts once, and open time isn't one. The nightly check-in has one row each. */
export interface PlannedRow {
  key: string;
  item: PlanItem;
  minutes: number;
}
export function plannedRows(items: readonly PlanItem[]): PlannedRow[] {
  const out: PlannedRow[] = [];
  for (const item of items.filter((i) => i.kind !== 'open')) {
    const key = item.key.replace(/#\d+$/, '');
    const same = out.find((r) => r.key === key);
    if (same) same.minutes += minutesBetween(item.start, item.end);
    else out.push({ key, item, minutes: minutesBetween(item.start, item.end) });
  }
  return out;
}

/** Minutes a check-in counts for: all of Done, half of Part (we don't know how much), none of Skipped. */
export const creditedMinutes = (c: Pick<CheckIn, 'status' | 'minutes'>) => (c.status === 'done' ? c.minutes : c.status === 'part' ? Math.round(c.minutes / 2) : 0);

/** Minutes done in the given categories between two dates, inclusive. */
export const doneMinutes = (checkIns: readonly CheckIn[], calendarIds: readonly string[], from: string, to: string) =>
  checkIns.filter((c) => c.calendarId !== null && calendarIds.includes(c.calendarId) && c.date >= from && c.date <= to).reduce((n, c) => n + creditedMinutes(c), 0);

export interface CategoryHours {
  calendarId: string | null;
  plannedMinutes: number;
  doneMinutes: number;
}

export interface Scoreboard {
  weekStart: string;
  weekEnd: string;
  /** The last day counted: the week's end, or today while the week is still going. */
  through: string;
  categories: CategoryHours[];
  gymDays: number;
  leetcodeSessions: number;
  applicationsSent: number;
  realEstateMinutes: number;
  readingMinutes: number;
  /** Spent in the week, and in the whole budget period it falls in, against the budget (0 = none set). */
  spentCents: number;
  periodSpentCents: number;
  budgetCents: number;
  budgetPeriod: BudgetSettings['period'];
  /** Moved to goals (or kept as cash) that week, and put into holdings. */
  savedCents: number;
  investedCents: number;
  /** Bumped time by what happened to it. */
  bumped: { madeUpMinutes: number; letGoMinutes: number; openMinutes: number };
}

export interface ScoreInputs {
  src: PlanSources;
  checkIns: readonly CheckIn[];
  applications: readonly Application[];
  calendars: readonly Pick<Calendar, 'id' | 'name'>[];
  expenses: readonly Expense[];
  moves: readonly MoneyMove[];
  budget: BudgetSettings;
}

const REAL_ESTATE = /real estate/i;
const READING = /reading/i;
const sum = (xs: readonly number[]) => xs.reduce((n, x) => n + x, 0);

/** The week starting `weekStart` (a Monday). Days after `today` aren't counted, so a week still going isn't scored against hours not yet lived. */
export function scoreboard(inp: ScoreInputs, weekStart: string, today: string): Scoreboard {
  const weekEnd = addDays(weekStart, 6);
  const last = weekEnd < today ? weekEnd : today;
  const planned = new Map<string | null, number>();
  const done = new Map<string | null, number>();
  const add = (m: Map<string | null, number>, id: string | null, n: number) => m.set(id, (m.get(id) ?? 0) + n);
  const resolution = new Map(inp.src.overrides.filter((o) => (o.action === 'makeup' || o.action === 'letgo') && o.sourceDate).map((o) => [`${o.routineBlockId}@${o.sourceDate}`, o.action]));
  const bumped = { madeUpMinutes: 0, letGoMinutes: 0, openMinutes: 0 };

  for (const date of eachDate(weekStart, addDays(last, 1))) {
    const plan = planDay(inp.src, date);
    const mine = inp.checkIns.filter((c) => c.date === date);
    for (const row of plannedRows(plan.items)) {
      if (row.item.priority === 'free') continue;
      add(planned, row.item.calendarId, row.minutes);
      const c = mine.find((x) => x.itemKey === row.key);
      // When the block's "or instead" happened, the time counts for that category.
      if (c) add(done, c.usedAlt ? (row.item.altCalendarId ?? row.item.calendarId) : row.item.calendarId, creditedMinutes(c));
    }
    for (const b of plan.bumped) {
      const how = resolution.get(`${b.blockId}@${b.date}`);
      if (how === 'makeup') bumped.madeUpMinutes += b.minutes;
      else if (how === 'letgo') bumped.letGoMinutes += b.minutes;
      else bumped.openMinutes += b.minutes;
    }
  }

  const categories = [...new Set([...planned.keys(), ...done.keys()])]
    .map((calendarId) => ({ calendarId, plannedMinutes: planned.get(calendarId) ?? 0, doneMinutes: done.get(calendarId) ?? 0 }))
    .sort((a, b) => b.plannedMinutes - a.plannedMinutes || b.doneMinutes - a.doneMinutes);
  const named = (pattern: RegExp) => sum(categories.filter((c) => inp.calendars.find((k) => k.id === c.calendarId && pattern.test(k.name))).map((c) => c.doneMinutes));
  const week = inp.checkIns.filter((c) => c.date >= weekStart && c.date <= weekEnd);
  const inWeek = (date: string) => date >= weekStart && date <= weekEnd;
  const moved = (types: readonly MoneyMove['toType'][]) => sum(inp.moves.filter((m) => inWeek(m.date) && types.includes(m.toType)).map((m) => m.amountCents));

  return {
    weekStart,
    weekEnd,
    through: last,
    categories,
    gymDays: new Set(week.filter((c) => didIt(GYM, c)).map((c) => c.date)).size,
    leetcodeSessions: week.filter((c) => didIt(LEETCODE, c)).length,
    applicationsSent: inp.applications.filter((a) => {
      const d = appliedDate(a);
      return d !== null && inWeek(d);
    }).length,
    realEstateMinutes: named(REAL_ESTATE),
    readingMinutes: named(READING),
    spentCents: sum(inp.expenses.filter((e) => inWeek(e.date)).map((e) => e.amountCents)),
    periodSpentCents: budgetSummary(inp.expenses, inp.budget.amountCents, inp.budget.period, last).spentCents,
    budgetCents: inp.budget.amountCents,
    budgetPeriod: inp.budget.period,
    savedCents: moved(['goal', 'kept']),
    investedCents: moved(['holding']),
    bumped,
  };
}
