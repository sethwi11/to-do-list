import { goalProgress } from './applications';
import { weekdayName } from './dateMath';
import { formatCents, savingsProgress } from './money';
import type { Application } from './models/applications';
import type { MoneyMove, SavingsGoal } from './models/money';
import type { Milestone } from './models/path';
import { countdown } from './path';
import type { Bump } from './planDay';
import type { Scoreboard } from './scoreboard';
import { formatMinutes } from './timeBlocks';
import { describeLoad, LOAD_LEVEL_NAMES, type DayLoad } from './workload';

// The Sunday review as one Markdown block you paste into a Claude chat: short, numbers first, ending where your questions go.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Nov 9" */
const short = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
/** "Mon Nov 9" */
const day = (iso: string) => `${weekdayName(iso).slice(0, 3)} ${short(iso)}`;

export interface GoalInputs {
  applications: readonly Application[];
  offerGoal: number;
  offerTargetDate: string;
  goals: readonly SavingsGoal[];
  moves: readonly MoneyMove[];
  milestones: readonly Milestone[];
  today: string;
}

/** Where each goal stands, one line each: the offers, every savings goal, and the milestones. */
export function goalStandings(g: GoalInputs): string[] {
  const offers = goalProgress(g.applications, g.offerGoal, g.offerTargetDate, g.today);
  const lines = [`Internship offers: ${offers.offers} of ${offers.goal} (${offers.daysLeft >= 0 ? `${countdown(offers.daysLeft)} left` : 'target date has passed'})`];
  for (const goal of g.goals) lines.push(`${goal.name}: ${formatCents(savingsProgress(goal, g.moves).savedCents)} of ${formatCents(goal.targetCents)}`);
  const open = g.milestones.filter((m) => !m.reachedOn);
  if (g.milestones.length > 0) lines.push(`Milestones: ${g.milestones.length - open.length} of ${g.milestones.length} reached${open.length > 0 ? ` (still open: ${open.map((m) => m.title).join('; ')})` : ''}`);
  return lines;
}

export interface ReviewData {
  score: Scoreboard;
  /** Category names by calendar id; a category with no entry is "No category". */
  names: ReadonlyMap<string, string>;
  /** Bumped time that wasn't made up or let go. */
  unmadeUp: readonly Bump[];
  missedTasks: readonly string[];
  learned: readonly { date: string; title: string; learned: string }[];
  /** From goalStandings. */
  goals: readonly string[];
  nextWeek: readonly DayLoad[];
  priorities: readonly string[];
  notes: string;
}

/** "Nothing" lines are left out, so what's there is what mattered. */
export function reviewSummary(d: ReviewData): string {
  const s = d.score;
  // A week still going is only scored up to today, which Claude can't guess.
  const lines: string[] = [`# Week of ${short(s.weekStart)} to ${short(s.weekEnd)}${s.through < s.weekEnd ? ` (so far, through ${day(s.through)})` : ''}`, ''];
  const section = (title: string, body: readonly string[]) => {
    if (body.length > 0) lines.push(`## ${title}`, ...body, '');
  };

  const hours = s.categories
    .filter((c) => c.plannedMinutes > 0 || c.doneMinutes > 0)
    .map((c) => `${c.calendarId ? (d.names.get(c.calendarId) ?? 'No category') : 'No category'}: ${formatMinutes(c.doneMinutes)} of ${formatMinutes(c.plannedMinutes)}`);
  const counts = [
    `Gym days ${s.gymDays}`,
    `LeetCode sessions ${s.leetcodeSessions}`,
    `Applications sent ${s.applicationsSent}`,
    s.realEstateMinutes > 0 && `Real estate ${formatMinutes(s.realEstateMinutes)}`,
    s.readingMinutes > 0 && `Reading ${formatMinutes(s.readingMinutes)}`,
  ].filter(Boolean);
  const money = [
    s.budgetCents > 0 ? `Spent ${formatCents(s.spentCents)} (${formatCents(s.periodSpentCents)} of ${formatCents(s.budgetCents)} this ${s.budgetPeriod})` : `Spent ${formatCents(s.spentCents)}`,
    s.savedCents > 0 && `saved ${formatCents(s.savedCents)}`,
    s.investedCents > 0 && `invested ${formatCents(s.investedCents)}`,
  ].filter(Boolean);
  const b = s.bumped;
  const bumped = [b.madeUpMinutes > 0 && `${formatMinutes(b.madeUpMinutes)} made up`, b.letGoMinutes > 0 && `${formatMinutes(b.letGoMinutes)} let go`, b.openMinutes > 0 && `${formatMinutes(b.openMinutes)} not made up`].filter(Boolean);

  const busy = d.nextWeek.filter((l) => l.level > 0);
  const idle = d.nextWeek.filter((l) => l.level === 0);

  section('Hours done of planned (Part counts half)', hours.map((h) => `- ${h}`));
  section('Scoreboard', [`- ${counts.join(' · ')}`, `- ${money.join(' · ')}`, ...(bumped.length > 0 ? [`- Bumped time: ${bumped.join(', ')}`] : [])]);
  section('Where my goals stand', d.goals.map((g) => `- ${g}`));
  section('Not made up', d.unmadeUp.map((u) => `- ${u.title} (${day(u.date)}, ${formatMinutes(u.minutes)})`));
  section('Missed to-dos', d.missedTasks.map((t) => `- ${t}`));
  section('Learned', d.learned.map((l) => `- ${day(l.date)}, ${l.title}: ${l.learned}`));
  section('Next week', [...busy.map((l) => `- ${day(l.date)}: ${LOAD_LEVEL_NAMES[l.level]}, ${describeLoad(l)}`), ...(idle.length > 0 ? [`- Nothing planned: ${idle.map((l) => day(l.date)).join(', ')}`] : [])]);
  section('My priorities for next week', d.priorities.map((p, i) => `${i + 1}. ${p}`));
  if (d.notes.trim()) section('Notes', [d.notes.trim()]);

  lines.push('Questions for Claude:');
  return lines.join('\n');
}
