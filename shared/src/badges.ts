import { appliedDate } from './applications';
import { addDays, dayOfWeek } from './dateMath';
import { eachDate } from './dateTime';
import type { Application } from './models/applications';
import type { CheckIn } from './models/checkins';
import type { SavingsGoal, MoneyMove } from './models/money';
import type { Milestone } from './models/path';
import { stageTwoDate } from './path';
import { planDay, type PlanSources } from './planDay';
import { plannedRows } from './scoreboard';
import { didIt, LEETCODE, streakMilestones } from './streaks';

// Badges come only from real data: a streak, a full week of check-ins, work done, a goal's progress, a milestone you marked reached, Stage 2 opening. Opening the app earns nothing.

export interface EarnedBadge {
  /** Which badge, so it's awarded once. */
  key: string;
  title: string;
  earnedOn: string;
}

export interface BadgeInputs {
  src: PlanSources;
  checkIns: readonly CheckIn[];
  focusDates: ReadonlySet<string>;
  applications: readonly Application[];
  goals: readonly SavingsGoal[];
  moves: readonly MoneyMove[];
  milestones: readonly Milestone[];
  birthday: string | null;
  today: string;
}

/** Every Nth item of a dated list: the date of the Nth, 2Nth, and so on. */
const everyNth = (dates: readonly string[], n: number) => {
  const sorted = [...dates].sort();
  return Array.from({ length: Math.floor(sorted.length / n) }, (_, i) => ({ count: (i + 1) * n, on: sorted[(i + 1) * n - 1]! }));
};

/** The first week (Mon to Sun, already over) in which every planned item on every day was checked in; the date is its Sunday. */
function firstCheckedInWeek(src: PlanSources, checkIns: readonly CheckIn[], today: string): string | null {
  if (checkIns.length === 0) return null;
  const firstDate = checkIns.reduce((min, c) => (c.date < min ? c.date : min), today);
  const marked = new Set(checkIns.map((c) => `${c.date}|${c.itemKey}`));
  for (let monday = addDays(firstDate, -((dayOfWeek(firstDate) + 6) % 7)); addDays(monday, 6) <= today; monday = addDays(monday, 7)) {
    const rows = eachDate(monday, addDays(monday, 7)).flatMap((d) => plannedRows(planDay(src, d).items).map((r) => `${d}|${r.key}`));
    if (rows.length > 0 && rows.every((r) => marked.has(r))) return addDays(monday, 6);
  }
  return null;
}

/** Every badge the data earns as of `today`, oldest first. */
export function earnedBadges(inp: BadgeInputs): EarnedBadge[] {
  const out: EarnedBadge[] = [];
  const earn = (key: string, title: string, earnedOn: string) => out.push({ key, title, earnedOn });

  for (const m of streakMilestones(inp.src, inp.checkIns, inp.focusDates, inp.today)) earn(`streak:${m.id}:${m.days}`, `${m.label} streak: ${m.days} days`, m.on);

  const week = firstCheckedInWeek(inp.src, inp.checkIns, inp.today);
  if (week) earn('week:first', 'First fully checked-in week', week);

  for (const { count, on } of everyNth(inp.checkIns.filter((c) => didIt(LEETCODE, c)).map((c) => c.date), 25)) earn(`leetcode:${count}`, `${count} LeetCode sessions`, on);

  const sent = inp.applications.map(appliedDate).filter((d): d is string => d !== null);
  for (const { count, on } of everyNth(sent, 10)) earn(`applications:${count}`, `${count} applications sent`, on);

  for (const g of inp.goals) {
    const mine = inp.moves.filter((m) => m.toType === 'goal' && m.toId === g.id).sort((a, b) => a.date.localeCompare(b.date));
    for (const quarter of [25, 50, 75, 100]) {
      let saved = 0;
      const crossing = mine.find((m) => (saved += m.amountCents) * 100 >= quarter * g.targetCents);
      if (crossing) earn(`goal:${g.id}:${quarter}`, `“${g.name}”: ${quarter}% saved`, crossing.date);
    }
  }

  for (const m of inp.milestones) if (m.reachedOn) earn(`milestone:${m.id}`, `Milestone reached: ${m.title}`, m.reachedOn);

  const stageTwo = stageTwoDate(inp.birthday);
  if (stageTwo && inp.today >= stageTwo) earn('stage:2', 'Stage 2 unlocked', stageTwo);

  return out.sort((a, b) => a.earnedOn.localeCompare(b.earnedOn) || a.key.localeCompare(b.key));
}
