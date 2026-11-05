import { z } from 'zod';

/*
 * Date and time primitives shared by every model.
 *
 * Everything the user schedules is "floating" local time: the wall-clock
 * numbers you'd write on a paper planner, with no timezone attached.
 * "Class at 10:00 every Tuesday" must stay 10:00 when daylight saving
 * changes, which a UTC timestamp can't do. Moments the *computer* records
 * (createdAt, a focus session's start) are real instants and stay ISO UTC.
 */

/**
 * A calendar date in the user's local timezone, e.g. "2026-10-24".
 * Deliberately NOT a timestamp: "due Friday" is a day on the calendar,
 * not an instant, so it must not shift when converted between timezones.
 */
export const LocalDateSchema = z.iso.date();

/** 24-hour local wall-clock time, "HH:mm". */
export const LocalTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a time in HH:mm format');

/** A local date and time with no timezone: "2026-10-24T14:30". */
export const LocalDateTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/, 'Expected a date and time like 2026-10-24T14:30')
  .refine((v) => LocalDateSchema.safeParse(v.slice(0, 10)).success, 'Not a real calendar date');

/** Rejects `{}` bodies on PATCH: an update that changes nothing is almost certainly a bug. */
export const hasFields = (v: object) => Object.keys(v).length > 0;
export const NO_FIELDS_MESSAGE = { message: 'No fields to update' };
