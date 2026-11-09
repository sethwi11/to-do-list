import { z } from 'zod';
import { hasFields, LocalDateSchema, NO_FIELDS_MESSAGE } from '../localTime';

// The daily journal: a few paragraphs on how the day went, and a score. One entry per day.

export const JournalEntryFieldsSchema = z.object({
  date: LocalDateSchema,
  text: z.string().max(20_000),
  /** How the day went, 1 to 10; null until you pick one. */
  rating: z.number().int().min(1).max(10).nullable(),
});
export const JournalEntrySchema = JournalEntryFieldsSchema.extend({ id: z.uuid(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() });
export const CreateJournalEntryInputSchema = JournalEntryFieldsSchema.partial({ text: true, rating: true }).extend({ id: z.uuid().optional() });
export const UpdateJournalEntryInputSchema = JournalEntryFieldsSchema.pick({ text: true, rating: true }).partial().refine(hasFields, NO_FIELDS_MESSAGE);
export type JournalEntry = z.infer<typeof JournalEntrySchema>;
export type CreateJournalEntryInput = z.infer<typeof CreateJournalEntryInputSchema>;
export type UpdateJournalEntryInput = z.infer<typeof UpdateJournalEntryInputSchema>;
