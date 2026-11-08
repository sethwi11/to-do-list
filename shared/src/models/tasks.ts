import { z } from 'zod';
import { hasFields, LocalDateSchema, LocalTimeSchema, NO_FIELDS_MESSAGE } from '../localTime';

/*
 * Single source of truth for the data model.
 *
 * Each zod schema below does two jobs:
 *   1. Runtime validation (the server rejects bad request bodies with a 400).
 *   2. Static types via z.infer, so client and server can't drift apart.
 *
 * Convention for "empty" optional fields: we use `null`, not `undefined`.
 * JSON has no `undefined`, and on PATCH requests the difference matters:
 *   { dueDate: null }  -> "clear the due date"
 *   {}                 -> "don't touch the due date"
 */

export const PRIORITIES = ['low', 'medium', 'high'] as const;
export const PrioritySchema = z.enum(PRIORITIES);

export const STATUSES = ['todo', 'done'] as const;
export const StatusSchema = z.enum(STATUSES);

export const RECURRENCES = ['none', 'daily', 'weekdays', 'weekly', 'monthly'] as const;
export const RecurrenceSchema = z.enum(RECURRENCES);

/** 'application-deadline' marks the "Apply to ..." to-do the tracker keeps in step with a wishlist application's deadline. */
export const TASK_SOURCES = ['manual', 'voice', 'file-import', 'ics-import', 'application-deadline'] as const;
export const TaskSourceSchema = z.enum(TASK_SOURCES);

export const SubtaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  done: z.boolean(),
});

export const TaskSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(200),
  notes: z.string().max(5000).nullable(),
  dueDate: LocalDateSchema.nullable(),
  dueTime: LocalTimeSchema.nullable(),
  priority: PrioritySchema,
  calendarId: z.uuid().nullable(),
  /** Set for tasks that belong to a class (e.g. an assignment from the syllabus). */
  courseId: z.uuid().nullable(),
  /** Set for follow-ups and prep tasks tied to an internship application. */
  applicationId: z.uuid().nullable(),
  /** Minutes before the due date/time to remind, e.g. [4320, 1440] = 3 days and 1 day before. */
  reminders: z.array(z.number().int().positive().max(60 * 24 * 60)).max(10),
  status: StatusSchema,
  subtasks: z.array(SubtaskSchema),
  recurrence: RecurrenceSchema,
  estimatedMinutes: z.number().int().positive().max(24 * 60).nullable(),
  source: TaskSourceSchema,
  sourceSnippet: z.string().max(2000).nullable(),
  /** Position for manual (drag-and-drop) ordering. Lower = higher in the list. */
  sortOrder: z.number(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  /**
   * For a completed recurring task: the id of the occurrence its completion
   * created. Lets the server remove that occurrence again if you un-complete
   * (or undo), so toggling a checkbox never piles up duplicates.
   */
  nextOccurrenceId: z.uuid().nullable(),
});

/**
 * What a client may send when creating a task. Server-owned fields
 * (id, timestamps, status, sortOrder) are excluded; everything except
 * the title has a sensible default.
 */
export const CreateTaskInputSchema = z.object({
  /** Clients may generate the id themselves, so a create made offline can be replayed safely. */
  id: z.uuid().optional(),
  title: TaskSchema.shape.title,
  notes: TaskSchema.shape.notes.optional(),
  dueDate: TaskSchema.shape.dueDate.optional(),
  dueTime: TaskSchema.shape.dueTime.optional(),
  priority: PrioritySchema.optional(),
  calendarId: TaskSchema.shape.calendarId.optional(),
  courseId: TaskSchema.shape.courseId.optional(),
  applicationId: TaskSchema.shape.applicationId.optional(),
  reminders: TaskSchema.shape.reminders.optional(),
  subtasks: z.array(SubtaskSchema).optional(),
  recurrence: RecurrenceSchema.optional(),
  estimatedMinutes: TaskSchema.shape.estimatedMinutes.optional(),
  source: TaskSourceSchema.optional(),
  sourceSnippet: TaskSchema.shape.sourceSnippet.optional(),
});

/** PATCH body: every field optional, plus status and manual ordering. */
export const UpdateTaskInputSchema = CreateTaskInputSchema.partial()
  .extend({
    status: StatusSchema.optional(),
    sortOrder: z.number().optional(),
  })
  .refine(hasFields, NO_FIELDS_MESSAGE);

export type Priority = z.infer<typeof PrioritySchema>;
export type TaskStatus = z.infer<typeof StatusSchema>;
export type Recurrence = z.infer<typeof RecurrenceSchema>;
export type TaskSource = z.infer<typeof TaskSourceSchema>;
export type Subtask = z.infer<typeof SubtaskSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;
