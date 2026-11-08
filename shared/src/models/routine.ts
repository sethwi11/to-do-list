import { z } from 'zod';
import { hasFields, LocalDateSchema, LocalTimeSchema, NO_FIELDS_MESSAGE } from '../localTime';

// The weekly routine: a template of blocks per weekday, valid for a range of dates.

const WeekdaySchema = z.number().int().min(0).max(6); // 0 = Sunday

/** Wake and bed times for one weekday. A bed at or before wake means after midnight (02:00). */
export const RoutineDaySchema = z.object({ weekday: WeekdaySchema, wake: LocalTimeSchema, bed: LocalTimeSchema });
export type RoutineDay = z.infer<typeof RoutineDaySchema>;

/** When meetings and interviews should be suggested first. */
export const MeetingWindowSchema = z
  .object({ weekday: WeekdaySchema, start: LocalTimeSchema, end: LocalTimeSchema })
  .refine((w) => w.end > w.start, { message: 'The window must end after it starts', path: ['end'] });

export const WeekTemplateFieldsSchema = z.object({
  name: z.string().trim().min(1).max(60),
  effectiveFrom: LocalDateSchema,
  /** null = no end date. */
  effectiveTo: LocalDateSchema.nullable(),
  days: z.array(RoutineDaySchema).max(7),
  meetingWindows: z.array(MeetingWindowSchema).max(50),
});
export const WeekTemplateSchema = WeekTemplateFieldsSchema.extend({ id: z.uuid(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() });
const datesInOrder = (v: { effectiveFrom?: string; effectiveTo?: string | null }) => !v.effectiveFrom || !v.effectiveTo || v.effectiveTo >= v.effectiveFrom;
const DATES_REFINE = { message: 'The end date must be on or after the start date', path: ['effectiveTo'] };
export const CreateWeekTemplateInputSchema = WeekTemplateFieldsSchema.partial()
  .required({ name: true, effectiveFrom: true })
  .extend({ id: z.uuid().optional() })
  .refine(datesInOrder, DATES_REFINE);
export const UpdateWeekTemplateInputSchema = WeekTemplateFieldsSchema.partial().refine(hasFields, NO_FIELDS_MESSAGE).refine(datesInOrder, DATES_REFINE);
export type WeekTemplate = z.infer<typeof WeekTemplateSchema>;
export type CreateWeekTemplateInput = z.infer<typeof CreateWeekTemplateInputSchema>;
export type UpdateWeekTemplateInput = z.infer<typeof UpdateWeekTemplateInputSchema>;

/** Who keeps a slot when things overlap, strongest first. */
export const ROUTINE_PRIORITIES = ['commitment', 'high', 'normal', 'free'] as const;
export const RoutinePrioritySchema = z.enum(ROUTINE_PRIORITIES);
export type RoutinePriority = z.infer<typeof RoutinePrioritySchema>;

export const RoutineBlockFieldsSchema = z.object({
  templateId: z.uuid(),
  weekday: WeekdaySchema,
  start: LocalTimeSchema,
  /** At or before `start` means it ends after midnight. */
  end: LocalTimeSchema,
  title: z.string().trim().min(1).max(100),
  /** null for free time, which has no category color. */
  calendarId: z.uuid().nullable(),
  /** The other thing this block can be (the check-in asks which one happened). */
  altTitle: z.string().trim().min(1).max(100).nullable(),
  altCalendarId: z.uuid().nullable(),
  priority: RoutinePrioritySchema,
  focus: z.boolean(),
  soundtrack: z.string().trim().min(1).max(40).nullable(),
  notify: z.boolean(),
  /** Hidden outside the semester and during its breaks. */
  schoolDaysOnly: z.boolean(),
  notes: z.string().max(2000).nullable(),
});
export const RoutineBlockSchema = RoutineBlockFieldsSchema.extend({ id: z.uuid(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() });
const notZeroLength = (v: { start?: string; end?: string }) => !v.start || !v.end || v.start !== v.end;
const LENGTH_REFINE = { message: 'The block must end at a different time than it starts', path: ['end'] };
export const CreateRoutineBlockInputSchema = RoutineBlockFieldsSchema.partial()
  .required({ templateId: true, weekday: true, start: true, end: true, title: true })
  .extend({ id: z.uuid().optional() })
  .refine(notZeroLength, LENGTH_REFINE);
export const UpdateRoutineBlockInputSchema = RoutineBlockFieldsSchema.partial().refine(hasFields, NO_FIELDS_MESSAGE).refine(notZeroLength, LENGTH_REFINE);
/** Copying a day or a template writes many blocks at once, and Undo removes them again. */
export const RoutineBlockBatchInputSchema = z.object({
  put: z.array(RoutineBlockSchema.refine(notZeroLength, LENGTH_REFINE)).max(500),
  remove: z.array(z.uuid()).max(500),
});
export type RoutineBlock = z.infer<typeof RoutineBlockSchema>;
export type CreateRoutineBlockInput = z.infer<typeof CreateRoutineBlockInputSchema>;
export type UpdateRoutineBlockInput = z.infer<typeof UpdateRoutineBlockInputSchema>;
export type RoutineBlockBatchInput = z.infer<typeof RoutineBlockBatchInputSchema>;
