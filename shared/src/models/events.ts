import { z } from 'zod';
import { hasFields, LocalDateSchema, LocalDateTimeSchema, NO_FIELDS_MESSAGE } from '../localTime';
import { CalendarColorSchema } from '../palette';

/*
 * Event types are a user-editable list ("Interview", "Exam"...), so they live
 * in their own table and events point at them by id. Renaming a type then
 * renames it everywhere at once.
 */
export const DEFAULT_EVENT_TYPES = [
  'Interview',
  'Class',
  'Exam',
  'Assignment Deadline',
  'School Event',
  'Meeting',
  'Org Event',
  'Personal',
  'Other',
] as const;

export const EventTypeSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(40),
  sortOrder: z.number(),
});
export const CreateEventTypeInputSchema = z.object({ id: z.uuid().optional(), name: EventTypeSchema.shape.name });
export const UpdateEventTypeInputSchema = z
  .object({ name: EventTypeSchema.shape.name.optional(), sortOrder: z.number().optional() })
  .refine(hasFields, NO_FIELDS_MESSAGE);
export type EventType = z.infer<typeof EventTypeSchema>;
export type CreateEventTypeInput = z.infer<typeof CreateEventTypeInputSchema>;
export type UpdateEventTypeInput = z.infer<typeof UpdateEventTypeInputSchema>;

/**
 * How an event repeats. A repeating event is stored ONCE, as a "series" plus
 * this rule; the individual dates are worked out on demand (see
 * expandOccurrences). Storing every occurrence instead would mean "edit all
 * future classes" rewrites hundreds of rows, and a semester of classes would
 * be hundreds of rows to keep in sync.
 *
 *  - daily / weekdays / monthly: repeat from the start date.
 *  - weekly: on the start date's weekday, or on `byWeekday` (0 = Sunday ... 6 =
 *    Saturday) for "Mon/Wed/Fri" style schedules.
 *  - until: last date the series may occur on (inclusive); null = forever.
 *  - exdates: dates removed from the series ("class cancelled on Nov 11").
 */
export const EventRecurrenceSchema = z.object({
  freq: z.enum(['daily', 'weekdays', 'weekly', 'monthly']),
  byWeekday: z.array(z.number().int().min(0).max(6)).min(1).max(7).nullable(),
  until: LocalDateSchema.nullable(),
  exdates: z.array(LocalDateSchema).max(1000),
});
export type EventRecurrence = z.infer<typeof EventRecurrenceSchema>;

export const EVENT_SOURCES = ['manual', 'file-import', 'ics-import', 'voice', 'class-schedule'] as const;
export const EventSourceSchema = z.enum(EVENT_SOURCES);
export type EventSource = z.infer<typeof EventSourceSchema>;

/** Reminder choices offered in the UI (minutes before the start). Any positive number is accepted by the API. */
export const REMINDER_CHOICES = [10, 30, 60, 1440] as const;

/**
 * The fields a person edits on an event.
 *
 * Time: `start` and `end` are floating local datetimes (no timezone). For an
 * all-day event the times are 00:00 and `end` is EXCLUSIVE (a one-day event on
 * Nov 4 runs 2026-11-04T00:00 -> 2026-11-05T00:00). That's what both
 * FullCalendar and the .ics format use, so no conversion is needed.
 *
 * Series: a row with `recurrence` set is the series itself. A row with
 * `recurringEventId` set is a one-off override of a single occurrence (a class
 * that moved to another room or time); `originalStart` says which occurrence it replaces.
 */
export const EventFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  start: LocalDateTimeSchema,
  end: LocalDateTimeSchema,
  allDay: z.boolean(),
  calendarId: z.uuid().nullable(),
  typeId: z.uuid().nullable(),
  location: z.string().trim().max(300).nullable(),
  /** Only http(s) links: anything else (javascript:, data:) could run code when clicked. */
  link: z.url({ protocol: /^https?$/ }).max(2000).nullable(),
  /** Markdown. Doubles as meeting notes. */
  notes: z.string().max(20_000).nullable(),
  /** Overrides the calendar's color for this event only. */
  color: CalendarColorSchema.nullable(),
  reminderMinutes: z.number().int().positive().max(60 * 24 * 60).nullable(),
  recurrence: EventRecurrenceSchema.nullable(),
  recurringEventId: z.uuid().nullable(),
  originalStart: LocalDateTimeSchema.nullable(),
  courseId: z.uuid().nullable(),
  applicationId: z.uuid().nullable(),
  source: EventSourceSchema,
});

export const EventSchema = EventFieldsSchema.extend({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

// ISO-like local datetimes compare correctly as plain strings.
const endAfterStart = (v: { start: string; end: string }) => v.end > v.start;
const END_AFTER_START = { message: 'The end must be after the start', path: ['end'] };

/** Create: only title, start, end, and allDay are required; the server fills the rest with defaults. */
export const CreateEventInputSchema = EventFieldsSchema.partial()
  .required({ title: true, start: true, end: true })
  .extend({ id: z.uuid().optional() })
  .refine(endAfterStart, END_AFTER_START);

/** Update: every field optional. (If only one of start/end is sent, the server re-checks them together.) */
export const UpdateEventInputSchema = EventFieldsSchema.partial().refine(hasFields, NO_FIELDS_MESSAGE);

export type Event = z.infer<typeof EventSchema>;
export type CreateEventInput = z.infer<typeof CreateEventInputSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventInputSchema>;

/**
 * Several event rows changed at once: `put` rows are inserted (or replace the row with the same
 * id, un-deleting it if needed) and `remove` ids are deleted, all in one transaction. Editing
 * "this and following events" touches two or three rows, and undoing any change is the same
 * request with the old rows, so one all-or-nothing endpoint covers both.
 */
export const EventBatchInputSchema = z.object({
  put: z.array(EventSchema.refine(endAfterStart, END_AFTER_START)).max(500),
  remove: z.array(z.uuid()).max(500),
});
export type EventBatchInput = z.infer<typeof EventBatchInputSchema>;

/**
 * A time block: a slot on the calendar reserved for working on a task,
 * separate from the task's due date. Deleting a block never deletes the task.
 */
export const TimeBlockFieldsSchema = z.object({
  taskId: z.uuid(),
  start: LocalDateTimeSchema,
  end: LocalDateTimeSchema,
});
export const TimeBlockSchema = TimeBlockFieldsSchema.extend({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const CreateTimeBlockInputSchema = TimeBlockFieldsSchema.extend({ id: z.uuid().optional() }).refine(
  endAfterStart,
  END_AFTER_START,
);
export const UpdateTimeBlockInputSchema = TimeBlockFieldsSchema.partial().refine(hasFields, NO_FIELDS_MESSAGE);
export type TimeBlock = z.infer<typeof TimeBlockSchema>;
export type CreateTimeBlockInput = z.infer<typeof CreateTimeBlockInputSchema>;
export type UpdateTimeBlockInput = z.infer<typeof UpdateTimeBlockInputSchema>;
