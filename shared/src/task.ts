import { z } from 'zod';

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

export const TASK_SOURCES = ['manual', 'voice', 'brain-dump'] as const;
export const TaskSourceSchema = z.enum(TASK_SOURCES);

/**
 * A calendar date in the user's local timezone, e.g. "2026-10-24".
 * Deliberately NOT a timestamp: "due Friday" is a day on the calendar,
 * not an instant, so it must not shift when converted between timezones.
 */
export const LocalDateSchema = z.iso.date();

/** 24-hour local wall-clock time, "HH:mm". */
export const LocalTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a time in HH:mm format');

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
  categoryId: z.uuid().nullable(),
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
  title: TaskSchema.shape.title,
  notes: TaskSchema.shape.notes.optional(),
  dueDate: TaskSchema.shape.dueDate.optional(),
  dueTime: TaskSchema.shape.dueTime.optional(),
  priority: PrioritySchema.optional(),
  categoryId: TaskSchema.shape.categoryId.optional(),
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
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export type Priority = z.infer<typeof PrioritySchema>;
export type TaskStatus = z.infer<typeof StatusSchema>;
export type Recurrence = z.infer<typeof RecurrenceSchema>;
export type TaskSource = z.infer<typeof TaskSourceSchema>;
export type Subtask = z.infer<typeof SubtaskSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;
