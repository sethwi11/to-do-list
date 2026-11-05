import { z } from 'zod';
import { hasFields, LocalDateSchema, LocalTimeSchema, NO_FIELDS_MESSAGE } from '../localTime';
import { CalendarColorSchema } from '../palette';

/** A stretch of dates to skip when generating class meetings: fall break, Thanksgiving... */
export const ExcludedRangeSchema = z
  .object({ start: LocalDateSchema, end: LocalDateSchema, label: z.string().trim().max(60).nullable() })
  .refine((r) => r.end >= r.start, { message: 'The range must end on or after it starts', path: ['end'] });
export type ExcludedRange = z.infer<typeof ExcludedRangeSchema>;

export const SemesterFieldsSchema = z.object({
  name: z.string().trim().min(1).max(60),
  startDate: LocalDateSchema,
  endDate: LocalDateSchema,
  excludedRanges: z.array(ExcludedRangeSchema).max(50),
  /** Archiving hides a semester's courses everywhere without deleting anything. */
  archived: z.boolean(),
});
export const SemesterSchema = SemesterFieldsSchema.extend({ id: z.uuid(), createdAt: z.iso.datetime() });
const endOnOrAfterStart = (v: { startDate: string; endDate: string }) => v.endDate >= v.startDate;
const SEM_REFINE = { message: 'The semester must end on or after it starts', path: ['endDate'] };
export const CreateSemesterInputSchema = SemesterFieldsSchema.partial()
  .required({ name: true, startDate: true, endDate: true })
  .extend({ id: z.uuid().optional() })
  .refine(endOnOrAfterStart, SEM_REFINE);
export const UpdateSemesterInputSchema = SemesterFieldsSchema.partial().refine(hasFields, NO_FIELDS_MESSAGE);
export type Semester = z.infer<typeof SemesterSchema>;
export type CreateSemesterInput = z.infer<typeof CreateSemesterInputSchema>;
export type UpdateSemesterInput = z.infer<typeof UpdateSemesterInputSchema>;

export const CourseFieldsSchema = z.object({
  semesterId: z.uuid(),
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().max(30).nullable(),
  color: CalendarColorSchema,
  /** The calendar its class events appear on (usually School). */
  calendarId: z.uuid().nullable(),
  /** 0 = Sunday ... 6 = Saturday. */
  meetingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  startTime: LocalTimeSchema,
  endTime: LocalTimeSchema,
  location: z.string().trim().max(200).nullable(),
  instructor: z.string().trim().max(100).nullable(),
  notes: z.string().max(5000).nullable(),
});
export const CourseSchema = CourseFieldsSchema.extend({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
const endsAfterStart = (v: { startTime: string; endTime: string }) => v.endTime > v.startTime;
const TIME_REFINE = { message: 'Class must end after it starts', path: ['endTime'] };
export const CreateCourseInputSchema = CourseFieldsSchema.partial()
  .required({ semesterId: true, name: true, meetingDays: true, startTime: true, endTime: true })
  .extend({ id: z.uuid().optional() })
  .refine(endsAfterStart, TIME_REFINE);
export const UpdateCourseInputSchema = CourseFieldsSchema.partial().refine(hasFields, NO_FIELDS_MESSAGE);
export type Course = z.infer<typeof CourseSchema>;
export type CreateCourseInput = z.infer<typeof CreateCourseInputSchema>;
export type UpdateCourseInput = z.infer<typeof UpdateCourseInputSchema>;
