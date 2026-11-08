import { z } from 'zod';
import { CalendarColorSchema } from '../palette';
import { hasFields, NO_FIELDS_MESSAGE } from '../localTime';

/**
 * A calendar is a color-coded area of life (School, ACM, Personal...).
 * Every event and task can belong to one. (These started life as the
 * to-do app's "lists"; the same rows, renamed.)
 */
export const CalendarSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(50),
  color: CalendarColorSchema,
  sortOrder: z.number(),
  createdAt: z.iso.datetime(),
});

export type Calendar = z.infer<typeof CalendarSchema>;

export const CreateCalendarInputSchema = z.object({
  /** Clients may generate the id themselves, so a create made offline can be replayed safely. */
  id: z.uuid().optional(),
  name: CalendarSchema.shape.name,
  color: CalendarColorSchema.optional(),
});

export const UpdateCalendarInputSchema = z
  .object({
    name: CalendarSchema.shape.name.optional(),
    color: CalendarColorSchema.optional(),
    sortOrder: z.number().optional(),
  })
  .refine(hasFields, NO_FIELDS_MESSAGE);

export type CreateCalendarInput = z.infer<typeof CreateCalendarInputSchema>;
export type UpdateCalendarInput = z.infer<typeof UpdateCalendarInputSchema>;
