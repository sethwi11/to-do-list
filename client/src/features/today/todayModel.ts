import { addDays, addMinutes, combine, conflictMap, expandOccurrences, isOverdue, minutesBetween, soonestFirst, type DayPlan, type Event, type EventOccurrence, type PlanItem, type PlanKind, type Task, type TimeBlock } from '@todo/shared';

// The logic behind the Today page, apart from any drawing.

/** How far ahead the Now card looks for what's next when today is finished. */
export const UP_NEXT_DAYS = 14;

/** The next timed event to start after `now`, today or in the next two weeks. */
export function nextUpcoming(events: Event[], now: string): EventOccurrence | undefined {
  const today = now.slice(0, 10);
  return expandOccurrences(events, today, addDays(today, UP_NEXT_DAYS)).find((o) => !o.allDay && o.start > now);
}

export interface Summary {
  /** Everything on the schedule today, all-day included. */
  events: number;
  /** Time set aside today to work on to-dos. */
  blocks: number;
  /** To-dos due today that aren't done. */
  tasks: number;
  overdue: number;
  /** Pairs of events that overlap. */
  conflicts: number;
}

export function summarize(todays: EventOccurrence[], tasks: Task[], today: string, blocks = 0): Summary {
  const open = tasks.filter((t) => t.status === 'todo' && t.dueDate !== null);
  // Each overlapping pair shows up once in each event's list, so halve it.
  const conflicts = [...conflictMap(todays).values()].reduce((sum, list) => sum + list.length, 0) / 2;
  return {
    events: todays.length,
    blocks,
    tasks: open.filter((t) => t.dueDate === today).length,
    overdue: open.filter((t) => isOverdue(t, today)).length,
    conflicts,
  };
}

const STRENGTH: Record<PlanKind, number> = { class: 0, event: 0, task: 1, routine: 2, open: 3 };
const RANK = { commitment: 0, high: 1, normal: 2, free: 3 };

/** What's under way at `now`: a class or event over the routine, then the stronger routine block (volleyball over club work), free and open time last. */
export function currentItem(items: readonly PlanItem[], now: string): PlanItem | undefined {
  const rank = (i: PlanItem) => RANK[i.priority ?? 'normal'];
  return items.filter((i) => i.start <= now && now < i.end).sort((a, b) => STRENGTH[a.kind] - STRENGTH[b.kind] || rank(a) - rank(b))[0];
}

/** The next thing to start after `now`, skipping open time. */
export const nextItem = (items: readonly PlanItem[], now: string) => items.find((i) => i.kind !== 'open' && i.start > now);


/** During a routine block: every open to-do in its category or its alt category, soonest due first, then priority. Uncategorized to-dos never match. */
export function duringBlock(tasks: readonly Task[], item: Pick<PlanItem, 'kind' | 'calendarId' | 'altCalendarId'> | undefined): Task[] {
  if (item?.kind !== 'routine') return [];
  const ids = [item.calendarId, item.altCalendarId].filter((id): id is string => id !== null);
  return tasks.filter((t) => t.status === 'todo' && t.calendarId !== null && ids.includes(t.calendarId)).sort(soonestFirst);
}

/** What you set out to do now: to-dos with time set aside right now, and to-dos due during the current item (or the next hour when nothing is on). */
export function supposedToBeDoing(tasks: readonly Task[], blocks: readonly TimeBlock[], now: string, span: { start: string; end: string } | undefined): Task[] {
  const window = span ?? { start: now, end: addMinutes(now, 60) };
  const scheduled = new Set(blocks.filter((b) => b.start <= now && now < b.end).map((b) => b.taskId));
  return tasks
    .filter((t) => t.status === 'todo' && (scheduled.has(t.id) || (t.dueDate && t.dueTime && combine(t.dueDate, t.dueTime) >= window.start && combine(t.dueDate, t.dueTime) < window.end)))
    .sort(soonestFirst);
}

/** Overlapping items sit side by side: each gets a lane, and the number of lanes its overlapping group needs. */
export function layoutLanes(sorted: readonly PlanItem[]): Map<string, { lane: number; lanes: number }> {
  const out = new Map<string, { lane: number; lanes: number }>();
  let group: { key: string; lane: number }[] = [];
  const laneEnds: string[] = [];
  let groupEnd = '';
  const flush = () => {
    const lanes = Math.max(...group.map((g) => g.lane)) + 1;
    for (const g of group) out.set(g.key, { lane: g.lane, lanes });
    group = [];
    laneEnds.length = 0;
  };
  for (const item of sorted) {
    if (group.length > 0 && item.start >= groupEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = item.end;
    group.push({ key: item.key, lane });
    if (group.length === 1 || item.end > groupEnd) groupEnd = item.end;
  }
  if (group.length > 0) flush();
  return out;
}

/** Minutes from the date's midnight. */
export const minutesInto = (date: string, dt: string) => minutesBetween(combine(date), dt);

/** The hours the agenda shows, in minutes from midnight: 6 AM to 10 PM, stretched to whole hours around anything earlier or later. */
export function agendaRange(plan: Pick<DayPlan, 'date' | 'items'>): { from: number; to: number } {
  const starts = plan.items.map((i) => minutesInto(plan.date, i.start));
  const ends = plan.items.map((i) => minutesInto(plan.date, i.end));
  return { from: Math.max(0, Math.floor(Math.min(360, ...starts) / 60) * 60), to: Math.ceil(Math.max(1320, ...ends) / 60) * 60 };
}

/** Where the agenda opens: now, in minutes from the day's midnight. Null (open at the top) before the day starts, once it has ended, or when now is off the agenda. */
export function openAtMinutes(plan: Pick<DayPlan, 'date' | 'wake' | 'bed' | 'items'>, now: string): number | null {
  if (now < plan.wake || now >= plan.bed) return null;
  const { from, to } = agendaRange(plan);
  const at = minutesInto(plan.date, now);
  return at >= from && at <= to ? at : null;
}

export const greeting = (hour: number) => (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');
