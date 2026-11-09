import { z } from 'zod';
import { hasFields, LocalDateSchema, NO_FIELDS_MESSAGE } from '../localTime';

// The nightly check-in: how each planned item went. Title, category and minutes are copied in, so later template edits never change history.

export const CHECK_IN_STATUSES = ['done', 'part', 'skipped'] as const;
export const CheckInStatusSchema = z.enum(CHECK_IN_STATUSES);
export type CheckInStatus = z.infer<typeof CheckInStatusSchema>;

export const CheckInFieldsSchema = z.object({
  date: LocalDateSchema,
  /** Which planned item: its key in that day's plan. */
  itemKey: z.string().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  calendarId: z.uuid().nullable(),
  minutes: z.number().int().min(0).max(24 * 60),
  status: CheckInStatusSchema,
  /** Did the block's "or instead" happen? */
  usedAlt: z.boolean(),
  /** One line for the learning log. */
  learned: z.string().trim().max(300).nullable(),
});
export const CheckInSchema = CheckInFieldsSchema.extend({ id: z.uuid(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() });
export const CreateCheckInInputSchema = CheckInFieldsSchema.partial({ usedAlt: true, learned: true }).extend({ id: z.uuid().optional() });
export const UpdateCheckInInputSchema = CheckInFieldsSchema.pick({ status: true, usedAlt: true, learned: true, title: true, calendarId: true }).partial().refine(hasFields, NO_FIELDS_MESSAGE);
export type CheckIn = z.infer<typeof CheckInSchema>;
export type CreateCheckInInput = z.infer<typeof CreateCheckInInputSchema>;
export type UpdateCheckInInput = z.infer<typeof UpdateCheckInInputSchema>;
