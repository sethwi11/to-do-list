import { addDays, dayOfWeek } from './dateMath';
import { daysBetween } from './dateTime';
import { APPLICATION_STATUSES, type Application, type ApplicationStatus } from './models/applications';
import type { Template } from './models/templates';
import type { CreateTaskInput, Task, UpdateTaskInput } from './models/tasks';

// The internship tracker's logic, kept free of screens so it can be tested on its own: the stats, the goal, the "time to follow up?" rule, the reminder that follows a wishlist deadline, the prep to-dos for an interview, and the ordering of cards on the board.

/** Statuses that mean the application was actually sent and is still going, or ended well. */
export const APPLIED_STAGES: readonly ApplicationStatus[] = ['Applied', 'Online Assessment', 'Interviewing', 'Offer'];
/** Statuses that mean the company answered. (A rejection is an answer; withdrawing is your own decision, so it isn't.) */
export const RESPONSE_STAGES: readonly ApplicationStatus[] = ['Online Assessment', 'Interviewing', 'Offer', 'Rejected'];
const INTERVIEW_STAGES: readonly ApplicationStatus[] = ['Interviewing', 'Offer'];

/** Days in Applied, with no change, before the tracker suggests a follow-up. */
export const FOLLOW_UP_AFTER_DAYS = 14;
/** How far ahead of a wishlist deadline the reminder fires. */
export const DEADLINE_REMINDER_DAYS = 3;
export const DEADLINE_REMINDER_MINUTES = DEADLINE_REMINDER_DAYS * 24 * 60;
/** The built-in checklist offered for a new interview. */
export const INTERVIEW_PREP_TEMPLATE = 'Interview prep';
export const INTERVIEW_EVENT_TYPE = 'Interview';

/** "2026-11-04T15:30:00.000Z" -> the date it was on this computer's clock ("2026-11-04"). */
export function localDateOf(instant: string): string {
  const d = new Date(instant);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** An application still in play (everything except Rejected and Withdrawn). */
export const isOpen = (status: ApplicationStatus) => status !== 'Rejected' && status !== 'Withdrawn';

/** Every status the application has been in, including this one. */
function reachedStatuses(app: Application): Set<ApplicationStatus> {
  return new Set<ApplicationStatus>([app.status, ...app.statusHistory.map((h) => h.status)]);
}
const reachedAny = (app: Application, stages: readonly ApplicationStatus[]) => {
  const reached = reachedStatuses(app);
  return stages.some((s) => reached.has(s));
};

export const hasApplied = (app: Application) => app.dateApplied !== null || reachedAny(app, APPLIED_STAGES);
export const hasResponded = (app: Application) => hasApplied(app) && reachedAny(app, RESPONSE_STAGES);
export const hasInterviewed = (app: Application) => reachedAny(app, INTERVIEW_STAGES);
export const hasOffer = (app: Application) => reachedStatuses(app).has('Offer');

/** The day it was applied: the date you entered, or else the day it first moved out of the wishlist. */
export function appliedDate(app: Application): string | null {
  if (app.dateApplied) return app.dateApplied;
  const first = app.statusHistory.find((h) => APPLIED_STAGES.includes(h.status));
  return first ? localDateOf(first.date) : null;
}

/** When it entered its current status (the latest entry in its timeline). */
export const enteredStatusAt = (app: Application): string => app.statusHistory.at(-1)?.date ?? app.createdAt;
export const daysInStatus = (app: Application, today: string) => Math.max(0, daysBetween(localDateOf(enteredStatusAt(app)), today));

// ---- stats and the goal ---------------------------------------------------

export function stageCounts(apps: readonly Application[]): Record<ApplicationStatus, number> {
  const counts = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0])) as Record<ApplicationStatus, number>;
  for (const a of apps) counts[a.status]++;
  return counts;
}

export interface WeekCount {
  /** The Sunday that starts the week (the app's calendar weeks start on Sunday). */
  weekStart: string;
  count: number;
}

/** Applications sent per week for the last `weeks` weeks, oldest first, ending with the current week. */
export function weeklyApplied(apps: readonly Application[], today: string, weeks = 8): WeekCount[] {
  const thisWeek = addDays(today, -dayOfWeek(today));
  const buckets: WeekCount[] = Array.from({ length: weeks }, (_, i) => ({ weekStart: addDays(thisWeek, -7 * (weeks - 1 - i)), count: 0 }));
  for (const a of apps) {
    const date = hasApplied(a) ? appliedDate(a) : null;
    if (!date) continue;
    const week = addDays(date, -dayOfWeek(date));
    const bucket = buckets.find((b) => b.weekStart === week);
    if (bucket) bucket.count++;
  }
  return buckets;
}

export interface ApplicationStats {
  total: number;
  applied: number;
  responded: number;
  interviewed: number;
  offers: number;
  /** Of the applications you sent, the share that got any answer. Null until you've sent one. */
  responseRate: number | null;
  /** Of the applications you sent, the share that reached an interview. */
  interviewRate: number | null;
  /** Sent in the last four weeks, per week. */
  perWeek: number;
  thisWeek: number;
}

export function applicationStats(apps: readonly Application[], today: string): ApplicationStats {
  const applied = apps.filter(hasApplied);
  const rate = (n: number) => (applied.length === 0 ? null : n / applied.length);
  const weeks = weeklyApplied(apps, today, 4);
  return {
    total: apps.length,
    applied: applied.length,
    responded: applied.filter(hasResponded).length,
    interviewed: applied.filter(hasInterviewed).length,
    offers: apps.filter(hasOffer).length,
    responseRate: rate(applied.filter(hasResponded).length),
    interviewRate: rate(applied.filter(hasInterviewed).length),
    perWeek: weeks.reduce((sum, w) => sum + w.count, 0) / weeks.length,
    thisWeek: weeks.at(-1)!.count,
  };
}

export interface GoalProgress {
  offers: number;
  goal: number;
  /** Whole days until the target date; negative once it has passed. */
  daysLeft: number;
}

/** Offers so far against the goal. An offer you later turned down still counts: you earned it. */
export function goalProgress(apps: readonly Application[], goal: number, targetDate: string, today: string): GoalProgress {
  return { offers: apps.filter(hasOffer).length, goal, daysLeft: daysBetween(today, targetDate) };
}

// ---- the follow-up suggestion --------------------------------------------

export interface FollowUpSuggestion {
  application: Application;
  /** The day it was applied (or entered Applied), which the wait is counted from. */
  since: string;
  days: number;
}

/** Applications that have sat in Applied for FOLLOW_UP_AFTER_DAYS or more with no change, and that you haven't already answered the suggestion for. */
export function followUpSuggestions(apps: readonly Application[], today: string): FollowUpSuggestion[] {
  const out: FollowUpSuggestion[] = [];
  for (const application of apps) {
    if (application.status !== 'Applied') continue;
    const entered = enteredStatusAt(application);
    if (application.followUpHandledAt && application.followUpHandledAt >= entered) continue;
    const since = application.dateApplied ?? localDateOf(entered);
    const days = daysBetween(since, today);
    if (days >= FOLLOW_UP_AFTER_DAYS) out.push({ application, since, days });
  }
  return out.sort((a, b) => b.days - a.days);
}

/** The to-do made when you accept a follow-up suggestion. It's due today: the point is to send the note. */
export function followUpTask(s: FollowUpSuggestion, today: string, calendarId: string | null): CreateTaskInput {
  const { company, role } = s.application;
  return {
    title: `Follow up with ${company}`.slice(0, 200),
    notes: `Applied for ${role} ${s.days} days ago (${s.since}) and haven't heard back.`,
    dueDate: today,
    priority: 'medium',
    calendarId,
    applicationId: s.application.id,
    source: 'manual',
  };
}

// ---- the wishlist-deadline reminder --------------------------------------

export interface ReminderPlan {
  create: CreateTaskInput | null;
  update: { id: string; changes: UpdateTaskInput }[];
  /** Open reminder to-dos to tick off (the application moved on, so applying is no longer pending). */
  complete: string[];
  /** Open reminder to-dos to delete (the deadline was removed). */
  remove: string[];
}

export const deadlineReminderTitle = (app: Pick<Application, 'company' | 'role'>) => `Apply to ${app.company} (${app.role})`.slice(0, 200);

/** Keeps one "Apply to ..." to-do in step with a wishlist application's deadline: due on the deadline, with a reminder three days before (the same way a syllabus deadline gets its reminders). */
export function planDeadlineReminder(app: Application, tasks: readonly Task[], today: string, calendarId: string | null): ReminderPlan {
  const mine = tasks.filter((t) => t.applicationId === app.id && t.source === 'application-deadline');
  const open = mine.filter((t) => t.status === 'todo');
  const plan: ReminderPlan = { create: null, update: [], complete: [], remove: [] };

  if (app.status !== 'Wishlist') {
    plan.complete = open.map((t) => t.id);
    return plan;
  }
  if (!app.deadline) {
    plan.remove = open.map((t) => t.id);
    return plan;
  }

  const title = deadlineReminderTitle(app);
  if (open.length === 0) {
    if (mine.length === 0 && app.deadline >= today) {
      plan.create = {
        title,
        notes: app.jobLink ?? null,
        dueDate: app.deadline,
        priority: 'high',
        calendarId,
        applicationId: app.id,
        reminders: [DEADLINE_REMINDER_MINUTES],
        source: 'application-deadline',
      };
    }
    return plan;
  }
  for (const t of open) {
    const changes: UpdateTaskInput = {};
    if (t.title !== title) changes.title = title;
    if (t.dueDate !== app.deadline) changes.dueDate = app.deadline;
    if (Object.keys(changes).length > 0) plan.update.push({ id: t.id, changes });
  }
  return plan;
}

/** The date to record as "applied" when an application moves to `status`: today, if it has none yet and this means it was sent. */
export function dateAppliedAfterMove(app: Pick<Application, 'dateApplied'>, status: ApplicationStatus, today: string): string | undefined {
  return app.dateApplied === null && APPLIED_STAGES.includes(status) ? today : undefined;
}

// ---- matching an interview to an application ------------------------------

/** The open application whose company is named in `text` ("Stripe interview with Sam" -> Stripe), when exactly one is. */
export function guessApplication(text: string, apps: readonly Application[]): Application | null {
  const haystack = text.toLowerCase();
  const hits = apps.filter((a) => isOpen(a.status) && a.company.trim().length >= 3 && haystack.includes(a.company.trim().toLowerCase()));
  return hits.length === 1 ? hits[0]! : null;
}

// ---- prep to-dos for an interview ----------------------------------------

export interface PrepPlan {
  tasks: CreateTaskInput[];
  /** How many to-dos would have been due in the past, and were set to today instead. */
  movedToToday: number;
}

/** A template applied to an event: each item becomes a to-do due `offsetDays` from the event's date (negative = before). */
export function prepTasksForEvent(
  template: Pick<Template, 'items'>,
  event: { title: string; start: string },
  today: string,
  link: { applicationId: string | null; calendarId: string | null },
): PrepPlan {
  const date = event.start.slice(0, 10);
  let movedToToday = 0;
  const tasks = template.items.map((item) => {
    let due = addDays(date, item.offsetDays);
    if (due < today) {
      due = today;
      movedToToday++;
    }
    return { item, due };
  });
  tasks.sort((a, b) => a.due.localeCompare(b.due));
  return {
    movedToToday,
    tasks: tasks.map(({ item, due }) => ({
      title: item.title,
      notes: `Prep for “${event.title}”`,
      dueDate: due,
      priority: 'medium',
      calendarId: link.calendarId,
      applicationId: link.applicationId,
    })),
  };
}

// ---- the table: filtering and sorting -------------------------------------

export type ApplicationSortKey = 'company' | 'role' | 'status' | 'dateApplied' | 'deadline' | 'updated';
export type SortDirection = 'asc' | 'desc';

export interface ApplicationFilter {
  status?: ApplicationStatus | null;
  /** Matches the company, role, location or contact, ignoring case. */
  query?: string;
  /** Applied on or after / on or before these days (YYYY-MM-DD). */
  appliedFrom?: string;
  appliedTo?: string;
}

export function filterApplications(apps: readonly Application[], f: ApplicationFilter): Application[] {
  const q = f.query?.trim().toLowerCase();
  return apps.filter((a) => {
    if (f.status && a.status !== f.status) return false;
    if (q && ![a.company, a.role, a.location, a.contactName].some((v) => v?.toLowerCase().includes(q))) return false;
    if (f.appliedFrom || f.appliedTo) {
      const date = appliedDate(a);
      if (!date) return false;
      if (f.appliedFrom && date < f.appliedFrom) return false;
      if (f.appliedTo && date > f.appliedTo) return false;
    }
    return true;
  });
}

/** Sorted copy. Dates with no value always go last, whichever way you sort. */
export function sortApplications(apps: readonly Application[], key: ApplicationSortKey, direction: SortDirection): Application[] {
  const sign = direction === 'asc' ? 1 : -1;
  const text = (a: Application, b: Application) => a[key as 'company' | 'role'].localeCompare(b[key as 'company' | 'role'], undefined, { sensitivity: 'base' });
  const dateKey = (a: Application): string | null => (key === 'dateApplied' ? appliedDate(a) : key === 'deadline' ? a.deadline : a.updatedAt);
  return [...apps].sort((a, b) => {
    if (key === 'company' || key === 'role') return sign * text(a, b) || a.company.localeCompare(b.company);
    if (key === 'status') return sign * (APPLICATION_STATUSES.indexOf(a.status) - APPLICATION_STATUSES.indexOf(b.status)) || a.company.localeCompare(b.company);
    const da = dateKey(a);
    const db = dateKey(b);
    if (da === null && db === null) return a.company.localeCompare(b.company);
    if (da === null) return 1;
    if (db === null) return -1;
    return sign * da.localeCompare(db) || a.company.localeCompare(b.company);
  });
}

// ---- the board: where a dropped card goes ---------------------------------

const GAP = 1024;
const MIN_GAP = 1e-6;

export interface MovePlan {
  status: ApplicationStatus;
  sortOrder: number;
  /** Set only when the column's gaps ran out: every card in the column gets a fresh number (including the moved one). */
  renumber: { id: string; sortOrder: number }[] | null;
}

/** Where a card lands when dropped into `status`, just before the card `beforeId` (or at the end of the column if null). */
export function planApplicationMove(apps: readonly Application[], movedId: string, status: ApplicationStatus, beforeId: string | null): MovePlan {
  const column = apps.filter((a) => a.status === status && a.id !== movedId).sort((a, b) => a.sortOrder - b.sortOrder);
  const found = beforeId === null ? -1 : column.findIndex((a) => a.id === beforeId);
  const at = found < 0 ? column.length : found; // no card to land before (or it isn't in this column): the end
  const prev = column[at - 1];
  const next = column[at];
  if (prev && next && next.sortOrder - prev.sortOrder <= MIN_GAP) {
    const ids = column.map((a) => a.id);
    ids.splice(at, 0, movedId);
    const renumber = ids.map((id, i) => ({ id, sortOrder: (i + 1) * GAP }));
    return { status, sortOrder: renumber[at]!.sortOrder, renumber };
  }
  const sortOrder = prev && next ? (prev.sortOrder + next.sortOrder) / 2 : prev ? prev.sortOrder + GAP : next ? next.sortOrder - GAP : GAP;
  return { status, sortOrder, renumber: null };
}
