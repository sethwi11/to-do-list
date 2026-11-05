import { z } from 'zod';
import { hasFields, NO_FIELDS_MESSAGE } from '../localTime';

/**
 * A reusable checklist. Applied to a task, its items become subtasks.
 * Applied to an event, each item becomes a linked task due `offsetDays`
 * from the event's date (negative = before, positive = after, 0 = the same day).
 */
export const TemplateItemSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(200),
  offsetDays: z.number().int().min(-365).max(365),
});
export type TemplateItem = z.infer<typeof TemplateItemSchema>;

export const TemplateFieldsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  items: z.array(TemplateItemSchema).max(100),
});
export const TemplateSchema = TemplateFieldsSchema.extend({
  id: z.uuid(),
  /** Built-in templates can be edited but not deleted, so there's always a starting point. */
  builtIn: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const CreateTemplateInputSchema = TemplateFieldsSchema.extend({ id: z.uuid().optional() });
export const UpdateTemplateInputSchema = TemplateFieldsSchema.partial().refine(hasFields, NO_FIELDS_MESSAGE);
export type Template = z.infer<typeof TemplateSchema>;
export type CreateTemplateInput = z.infer<typeof CreateTemplateInputSchema>;
export type UpdateTemplateInput = z.infer<typeof UpdateTemplateInputSchema>;

/** The checklists every install starts with. Offsets are a first guess; edit them to taste. */
export const BUILT_IN_TEMPLATES: readonly { name: string; items: readonly { title: string; offsetDays: number }[] }[] = [
  {
    name: 'Interview prep',
    items: [
      { title: 'Research the company', offsetDays: -3 },
      { title: 'Review the job description', offsetDays: -3 },
      { title: 'Update resume', offsetDays: -3 },
      { title: 'Prep 3 STAR stories', offsetDays: -2 },
      { title: 'Prep questions to ask', offsetDays: -2 },
      { title: 'Test camera and mic', offsetDays: -1 },
      { title: 'Send thank-you note', offsetDays: 1 },
    ],
  },
  {
    name: 'Exam prep',
    items: [
      { title: 'Gather notes', offsetDays: -7 },
      { title: 'Make study guide', offsetDays: -5 },
      { title: 'Practice problems', offsetDays: -3 },
      { title: 'Review session', offsetDays: -2 },
      { title: 'Final review', offsetDays: -1 },
    ],
  },
  {
    name: 'Org event planning',
    items: [
      { title: 'Book room', offsetDays: -14 },
      { title: 'Make flyer', offsetDays: -10 },
      { title: 'Post on socials', offsetDays: -7 },
      { title: 'Order food', offsetDays: -3 },
      { title: 'Set up', offsetDays: 0 },
      { title: 'Send recap', offsetDays: 1 },
    ],
  },
];
