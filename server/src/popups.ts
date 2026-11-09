import { addDays, datePart, planningDate, popupsForDay, type PlanSources, type Popup } from '@todo/shared';
import type { Repositories } from './repositories';

/** Sends one pop-up (a native notification in the running app; a fake in tests). */
export type SendPopup = (popup: Popup) => void;

/** Everything planDay reads, straight from the database: as the app shows it (no deleted templates, no classes of archived semesters, no missed to-dos). */
export async function planSources(r: Repositories): Promise<PlanSources> {
  const [templates, blocks, overrides, semesters, courses, events, timeBlocks, tasks, calendars] = await Promise.all([
    r.weekTemplates.list(), r.routineBlocks.list(), r.routineOverrides.list(), r.semesters.list(), r.courses.list(), r.events.list(), r.timeBlocks.list(), r.tasks.list(), r.calendars.list(),
  ]);
  const archived = new Set(courses.filter((c) => semesters.find((s) => s.id === c.semesterId)?.archived).map((c) => c.id));
  const live = tasks.filter((t) => t.missedAt === null);
  return {
    templates,
    blocks: blocks.filter((b) => templates.some((t) => t.id === b.templateId)),
    overrides,
    semesters,
    events: events.filter((e) => !e.courseId || !archived.has(e.courseId)),
    timeBlocks: timeBlocks.filter((b) => live.some((t) => t.id === b.taskId)),
    tasks: live,
    calendars,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
/** This minute on the computer's clock, as "YYYY-MM-DDTHH:mm". */
export const localMinute = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Checks the plan and sends what's due this minute, each thing once (the day still going after midnight counts, as on Today). */
export function createPopupScheduler(r: Repositories, send: SendPopup, now: () => string = localMinute) {
  const sent = new Set<string>();
  return async function tick(): Promise<Popup[]> {
    const app = await r.settings.get();
    const minute = now();
    const src = await planSources(r);
    // Yesterday too: a bedtime after midnight is yesterday's, and its minute is the first of the new day's planning.
    const dates = [...new Set([addDays(datePart(minute), -1), planningDate(src.templates, minute), datePart(minute)])];
    const due = dates.flatMap((d) => popupsForDay(src, d, app.popups, app.sundayReviewReminder)).filter((p) => p.at === minute && p.keys.some((k) => !sent.has(k)));
    for (const p of due) {
      p.keys.forEach((k) => sent.add(k));
      send(p);
    }
    return due;
  };
}
