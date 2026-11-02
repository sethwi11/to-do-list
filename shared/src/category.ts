import { z } from 'zod';

/*
 * Category colors are stored as palette *names*, not hex codes.
 * The client maps each name to Tailwind classes, so one name can render
 * correctly in both light and dark mode (a fixed hex can't).
 */
export const CATEGORY_COLORS = [
  'slate',
  'red',
  'orange',
  'amber',
  'green',
  'teal',
  'blue',
  'indigo',
  'purple',
  'pink',
] as const;
export const CategoryColorSchema = z.enum(CATEGORY_COLORS);

export const CategorySchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(50),
  color: CategoryColorSchema,
  sortOrder: z.number(),
  createdAt: z.iso.datetime(),
});

export type CategoryColor = z.infer<typeof CategoryColorSchema>;
export type Category = z.infer<typeof CategorySchema>;

export const CreateCategoryInputSchema = z.object({
  name: CategorySchema.shape.name,
  color: CategoryColorSchema.optional(),
});

export const UpdateCategoryInputSchema = z
  .object({
    name: CategorySchema.shape.name.optional(),
    color: CategoryColorSchema.optional(),
    sortOrder: z.number().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export type CreateCategoryInput = z.infer<typeof CreateCategoryInputSchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategoryInputSchema>;
