import { z } from 'zod';
import { hasFields, LocalDateSchema, NO_FIELDS_MESSAGE } from '../localTime';

export const APPLICATION_STATUSES = [
  'Wishlist',
  'Applied',
  'Online Assessment',
  'Interviewing',
  'Offer',
  'Rejected',
  'Withdrawn',
] as const;
export const ApplicationStatusSchema = z.enum(APPLICATION_STATUSES);
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

/** One entry in an application's timeline. `date` is a real instant: when the change was made. */
export const StatusChangeSchema = z.object({ status: ApplicationStatusSchema, date: z.iso.datetime() });
export type StatusChange = z.infer<typeof StatusChangeSchema>;

export const ApplicationFieldsSchema = z.object({
  company: z.string().trim().min(1).max(100),
  role: z.string().trim().min(1).max(150),
  location: z.string().trim().max(150).nullable(),
  jobLink: z.url({ protocol: /^https?$/ }).max(2000).nullable(),
  status: ApplicationStatusSchema,
  dateApplied: LocalDateSchema.nullable(),
  deadline: LocalDateSchema.nullable(),
  contactName: z.string().trim().max(100).nullable(),
  contactEmail: z.email().max(200).nullable(),
  /** Markdown. */
  notes: z.string().max(20_000).nullable(),
  /** Position within its kanban column. */
  sortOrder: z.number(),
  /**
   * When you answered the "time to follow up?" suggestion (by accepting or dismissing it). The suggestion
   * stays away until the status changes again, so it's judged against the latest status change.
   */
  followUpHandledAt: z.iso.datetime().nullable(),
});

/**
 * statusHistory is server-owned: the server appends to it whenever `status`
 * changes, so the timeline can't be forgotten (or forged) by a client.
 *
 * `followUpHandledAt` defaults to null here (and only here) so that backup files made before it existed
 * still load. The default is deliberately NOT on the fields above: a PATCH that doesn't mention it must leave it alone.
 */
export const ApplicationSchema = ApplicationFieldsSchema.extend({
  id: z.uuid(),
  followUpHandledAt: z.iso.datetime().nullable().default(null),
  statusHistory: z.array(StatusChangeSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const CreateApplicationInputSchema = ApplicationFieldsSchema.partial()
  .required({ company: true, role: true })
  .extend({ id: z.uuid().optional() });
export const UpdateApplicationInputSchema = ApplicationFieldsSchema.partial().refine(hasFields, NO_FIELDS_MESSAGE);
export type Application = z.infer<typeof ApplicationSchema>;
export type CreateApplicationInput = z.infer<typeof CreateApplicationInputSchema>;
export type UpdateApplicationInput = z.infer<typeof UpdateApplicationInputSchema>;
