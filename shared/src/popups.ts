import { z } from 'zod';
import { addDays } from './dateMath';
import { addMinutes, combine, minutesBetween, timePart } from './dateTime';
import { expandOccurrences } from './eventSeries';
import { LocalDateTimeSchema } from './localTime';
import { activeTemplate, dayBounds, planDay, type PlanItem, type PlanSources } from './planDay';

// Pop-ups: one pure function turns a planned day into the notifications the server sends.

export const PopupSettingsSchema = z.object({
  enabled: z.boolean(),
  /** Before classes, events and commitments. */
  headsUpMinutes: z.number().int().min(0).max(120),
  focusWarning: z.boolean(),
  bedtime: z.boolean(),
  mutedCalendarIds: z.array(z.uuid()).max(100),
  pausedUntil: LocalDateTimeSchema.nullable(),
});
export type PopupSettings = z.infer<typeof PopupSettingsSchema>;
export const DEFAULT_POPUP_SETTINGS: PopupSettings = { enabled: true, headsUpMinutes: 5, focusWarning: true, bedtime: true, mutedCalendarIds: [], pausedUntil: null };

/** One notification: what it says, when, and where clicking it goes. */
export interface Popup {
  at: string;
  title: string;
  body: string;
  url: string;
  /** What it covers, so the same thing is never sent twice. */
  keys: string[];
}

/** The minute a to-do without a time reminds on its due date. */
export const DEFAULT_REMINDER_TIME = '09:00';

type Note = { at: string; rank: number; line: string; key: string; url: string };
// Which line leads when several land in the same minute.
const RANK = { closeDay: 0, start: 1, headsUp: 2, warning: 3, due: 4, reminder: 5, stop: 6, bedtime: 7 };

const clock = (dt: string) => {
  const [h, m] = timePart(dt).split(':').map(Number);
  return `${h! % 12 || 12}:${String(m).padStart(2, '0')} ${h! < 12 ? 'AM' : 'PM'}`;
};

/** Every pop-up for a planned day, one per minute (lines that land together are combined). */
export function popupsForDay(src: PlanSources, date: string, settings: PopupSettings): Popup[] {
  if (!settings.enabled) return [];
  const plan = planDay(src, date);
  const dayStart = combine(date);
  const dayEnd = plan.bed > combine(addDays(date, 1)) ? plan.bed : combine(addDays(date, 1));
  const muted = (calendarId: string | null) => calendarId !== null && settings.mutedCalendarIds.includes(calendarId);
  const blockOf = (item: PlanItem) => src.blocks.find((b) => b.id === item.sourceId);
  const wanted = (i: PlanItem) => i.kind !== 'open' && i.kind !== 'task' && !muted(i.calendarId) && (i.kind !== 'routine' || blockOf(i)?.notify !== false);
  const items = plan.items.filter(wanted);
  const classes = plan.items.filter((i) => i.kind === 'class');
  const notes: Note[] = [];
  const add = (at: string, rank: number, line: string, key: string, url = '/') => notes.push({ at, rank, line, key, url });

  const nextAfter = (item: PlanItem) => plan.items.find((i) => i.kind !== 'open' && i.start >= item.end && i.key !== item.key);
  // To-dos are named only for work blocks: "Ride home · Finish the lab" is noise.
  const matching = (item: PlanItem) => {
    if (item.kind !== 'routine' || !(item.focus || blockOf(item)?.reschedulable)) return '';
    const ids = [item.calendarId, item.altCalendarId].filter((id): id is string => id !== null);
    const open = src.tasks.filter((t) => t.status === 'todo' && t.calendarId !== null && ids.includes(t.calendarId));
    return open.length === 0 ? '' : ` · ${open[0]!.title}${open.length > 1 ? ` +${open.length - 1} more` : ''}`;
  };

  for (const item of items) {
    const protectedTime = item.kind === 'class' || item.kind === 'event' || item.priority === 'commitment';
    if (protectedTime && settings.headsUpMinutes > 0) add(addMinutes(item.start, -settings.headsUpMinutes), RANK.headsUp, `In ${settings.headsUpMinutes} min: ${item.title} at ${clock(item.start)}`, `heads:${item.key}`);
    // A class gets only the heads-up: nothing pops up during it.
    if (item.kind === 'class') continue;
    const next = nextAfter(item);
    const soundtrack = item.soundtrack ? ` · Soundtrack: ${item.soundtrack}` : '';
    add(item.start, RANK.start, `Now: ${item.title} until ${clock(item.end)}${next ? ` · Next: ${next.title}` : ''}${matching(item)}${soundtrack}`, `start:${item.key}`);
    add(item.end, RANK.stop, `Done: ${item.title}${next && next.start > item.end ? ` · Next: ${next.title} at ${clock(next.start)}` : ''}`, `stop:${item.key}`);
    if (item.focus && settings.focusWarning && minutesBetween(item.start, item.end) >= 15) add(addMinutes(item.end, -5), RANK.warning, `5 minutes left: ${item.title}`, `warn:${item.key}`);
  }

  // When the day's last non-free block ends: the one-minute check-in.
  const last = [...plan.items].reverse().find((i) => i.kind !== 'open' && i.kind !== 'task' && i.priority !== 'free');
  if (last && plan.templateId) add(last.end, RANK.closeDay, 'Close the day: a one-minute check-in', `close:${date}`, `/checkin?date=${date}`);

  if (settings.bedtime && plan.templateId) {
    const tomorrow = addDays(date, 1);
    const wake = dayBounds(activeTemplate(src.templates, tomorrow), tomorrow).wake;
    add(plan.bed, RANK.bedtime, `Bedtime. Tomorrow starts at ${clock(wake)}`, `bed:${date}`);
  }

  // To-dos: at their due time, and at each reminder before it.
  for (const t of src.tasks) {
    if (t.status !== 'todo' || !t.dueDate || muted(t.calendarId)) continue;
    const due = combine(t.dueDate, t.dueTime ?? DEFAULT_REMINDER_TIME);
    const message = t.notes?.split('\n')[0]?.trim();
    if (t.dueTime) add(due, RANK.due, `Due now: ${t.title}${message ? ` · ${message}` : ''}`, `due:${t.id}@${due}`, '/tasks');
    for (const m of t.reminders) add(addMinutes(due, -m), RANK.reminder, `Reminder: ${t.title} is due ${clock(due)}${t.dueDate !== date ? ` on ${t.dueDate}` : ''}`, `remind:${t.id}@${m}`, '/tasks');
  }

  // Event reminders (an event a few days out can remind today).
  for (const o of expandOccurrences(src.events, dayStart, addDays(date, 8))) {
    if (o.allDay || o.event.reminderMinutes === null || muted(o.event.calendarId)) continue;
    add(addMinutes(o.start, -o.event.reminderMinutes), RANK.reminder, `Reminder: ${o.event.title} at ${clock(o.start)}`, `event:${o.key}`);
  }

  const quiet = (at: string) => classes.some((c) => c.start < at && at < c.end) || (settings.pausedUntil !== null && at < settings.pausedUntil);
  const byMinute = new Map<string, Note[]>();
  for (const n of notes) {
    if (n.at < dayStart || n.at >= dayEnd || quiet(n.at)) continue;
    byMinute.set(n.at, [...(byMinute.get(n.at) ?? []), n]);
  }
  return [...byMinute.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([at, list]) => {
      const sorted = list.sort((a, b) => a.rank - b.rank);
      return { at, title: sorted[0]!.line, body: sorted.slice(1).map((n) => n.line).join('\n'), url: sorted[0]!.url, keys: sorted.map((n) => n.key) };
    });
}
