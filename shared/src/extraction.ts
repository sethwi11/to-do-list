import { z } from 'zod';
import { LocalDateSchema, LocalTimeSchema, PrioritySchema, RecurrenceSchema } from './task';

/*
 * The contract for AI extraction, shared by three parties:
 *   - the client builds an ExtractRequest,
 *   - the server sends ExtractionResultSchema to Claude as a structured-output
 *     schema (Claude's reply is *constrained* to match it),
 *   - the server re-validates the result with the same schema before returning it.
 *
 * Optional values are `nullable`, not `.optional()`: structured outputs
 * require every property to be present, so "no due date" is an explicit null.
 */

// ---- request ---------------------------------------------------------------

export const ExtractModeSchema = z.enum(['brain-dump', 'voice', 'conversation']);

export const ExtractRequestSchema = z.object({
  text: z.string().trim().min(1, 'Nothing to extract').max(20_000),
  mode: ExtractModeSchema,
  /** The user's clock, so "tomorrow" and "tonight" resolve in their timezone. */
  clientNow: z.object({
    date: LocalDateSchema,
    time: LocalTimeSchema,
    timezone: z.string().max(64),
  }),
  /** The previous transcript chunks (conversation mode), so a task split across chunks isn't lost. */
  recentContext: z.array(z.string().max(20_000)).max(3).default([]),
  /** Open tasks, so the model can target actions by id and avoid duplicates. */
  existingTasks: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        dueDate: LocalDateSchema.nullable(),
        dueTime: LocalTimeSchema.nullable(),
        status: z.enum(['todo', 'done']),
      }),
    )
    .max(500)
    .default([]),
  /** Titles already extracted this session (pending review), so they aren't proposed twice. */
  alreadyExtracted: z.array(z.string()).max(200).default([]),
  /** A question the app asked last turn; the new text may be its answer. */
  pendingQuestion: z.string().max(500).nullable().default(null),
  categories: z.array(z.string()).max(100).default([]),
});

// ---- result ----------------------------------------------------------------

const Confidence = z.number().min(0).max(1);

export const ExtractedTaskSchema = z.object({
  title: z.string().describe('Short, action-oriented, starts with a verb. e.g. "Email Valencia about the lab"'),
  notes: z.string().nullable(),
  dueDate: LocalDateSchema.nullable().describe('YYYY-MM-DD, resolved against the user\'s local date'),
  dueTime: LocalTimeSchema.nullable().describe('24h HH:mm, only if a time was stated or clearly implied'),
  priority: PrioritySchema,
  category: z.string().nullable().describe("Exactly one of the user's list names, or null"),
  subtasks: z.array(z.string()),
  recurrence: RecurrenceSchema,
  estimatedMinutes: z.number().int().nullable(),
  confidence: Confidence,
  sourceSnippet: z.string().describe('The words from the transcript this task came from'),
});

export const TaskChangesSchema = z.object({
  title: z.string().nullable(),
  notes: z.string().nullable(),
  dueDate: LocalDateSchema.nullable(),
  dueTime: LocalTimeSchema.nullable(),
  priority: PrioritySchema.nullable(),
  category: z.string().nullable(),
});

export const QueryRangeSchema = z.enum(['today', 'tomorrow', 'upcoming', 'overdue', 'all']);

export const ExtractedActionSchema = z.object({
  type: z.enum(['complete', 'update', 'delete', 'query']),
  targetTaskId: z.string().nullable().describe('Id from existingTasks; null for queries'),
  /** For `update`: only the fields to change; null means "leave as is". */
  changes: TaskChangesSchema.nullable(),
  /** For `query`: which slice of the list the user asked about. */
  queryRange: QueryRangeSchema.nullable(),
  description: z.string().describe('Human-readable summary, e.g. "Move \\"COMP 365 lab\\" to Thursday"'),
  confidence: Confidence,
});

export const ExtractionResultSchema = z.object({
  tasks: z.array(ExtractedTaskSchema),
  actions: z.array(ExtractedActionSchema),
  spokenReply: z.string().describe('One short sentence to read aloud'),
  clarifyingQuestion: z.string().nullable(),
});

export type ExtractMode = z.infer<typeof ExtractModeSchema>;
export type ExtractRequest = z.input<typeof ExtractRequestSchema>;
export type ParsedExtractRequest = z.infer<typeof ExtractRequestSchema>;
export type ExtractedTask = z.infer<typeof ExtractedTaskSchema>;
export type ExtractedAction = z.infer<typeof ExtractedActionSchema>;
export type TaskChanges = z.infer<typeof TaskChangesSchema>;
export type QueryRange = z.infer<typeof QueryRangeSchema>;
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

/** Below this, items are flagged in the review panel and unchecked by default. */
export const LOW_CONFIDENCE = 0.6;

// ---- plan my day -----------------------------------------------------------

export const PlanRequestSchema = z.object({
  clientNow: ExtractRequestSchema.shape.clientNow,
  /** When the day should end, "HH:mm". */
  dayEnd: LocalTimeSchema.default('22:00'),
  tasks: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        priority: PrioritySchema,
        estimatedMinutes: z.number().int().nullable(),
        dueTime: LocalTimeSchema.nullable(),
        overdue: z.boolean(),
      }),
    )
    .min(1, 'No tasks to plan')
    .max(100),
});

export const PlanResultSchema = z.object({
  blocks: z.array(
    z.object({
      taskId: z.string(),
      start: LocalTimeSchema,
      end: LocalTimeSchema,
      note: z.string().nullable().describe('Optional short tip, e.g. "do this while you have energy"'),
    }),
  ),
  unscheduledTaskIds: z.array(z.string()),
  summary: z.string().describe('Two or three sentences, suitable to read aloud'),
});

export type PlanRequest = z.input<typeof PlanRequestSchema>;
export type ParsedPlanRequest = z.infer<typeof PlanRequestSchema>;
export type PlanResult = z.infer<typeof PlanResultSchema>;

