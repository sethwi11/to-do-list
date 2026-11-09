import { z } from 'zod';
import { hasFields, LocalDateSchema, NO_FIELDS_MESSAGE } from '../localTime';

// The Path: where you're headed (every date computed from your birthday), milestones that show the inputs feeding them, and badges earned from real data.

/** One line of the north star in your own words, and the age you want it by ("My goal", 30). */
export const NorthStarSchema = z.object({ text: z.string().trim().min(1).max(80), age: z.number().int().min(1).max(120) });
export type NorthStar = z.infer<typeof NorthStarSchema>;

export const PathSettingsSchema = z.object({
  /** Every date on the Path is computed from this. null until you set it. */
  birthday: LocalDateSchema.nullable(),
  northStar: z.array(NorthStarSchema).max(6),
  /** What Stage 2 holds. The server refuses to change it until Stage 2 unlocks. */
  stage2Notes: z.string().max(5_000),
});
export type PathSettings = z.infer<typeof PathSettingsSchema>;
export const DEFAULT_PATH_SETTINGS: PathSettings = { birthday: null, northStar: [], stage2Notes: '' };

export const MilestoneFieldsSchema = z.object({
  title: z.string().trim().min(1).max(120),
  targetDate: LocalDateSchema.nullable(),
  /** The day you marked it reached; earns a badge. */
  reachedOn: LocalDateSchema.nullable(),
  /** Inputs feeding it, all optional: categories whose hours count, a savings goal, and the offers goal from Applications. */
  calendarIds: z.array(z.uuid()).max(20),
  savingsGoalId: z.uuid().nullable(),
  trackOffers: z.boolean(),
});
export const MilestoneSchema = MilestoneFieldsSchema.extend({ id: z.uuid(), sortOrder: z.number(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() });
export const CreateMilestoneInputSchema = MilestoneFieldsSchema.partial({ targetDate: true, reachedOn: true, calendarIds: true, savingsGoalId: true, trackOffers: true }).extend({ id: z.uuid().optional() });
export const UpdateMilestoneInputSchema = MilestoneFieldsSchema.partial().refine(hasFields, NO_FIELDS_MESSAGE);
export type Milestone = z.infer<typeof MilestoneSchema>;
export type CreateMilestoneInput = z.infer<typeof CreateMilestoneInputSchema>;
export type UpdateMilestoneInput = z.infer<typeof UpdateMilestoneInputSchema>;

/** A badge, kept once earned (even if the data behind it later changes). `key` says which one, so it's never awarded twice. */
export const BadgeFieldsSchema = z.object({ key: z.string().trim().min(1).max(120), title: z.string().trim().min(1).max(160), earnedOn: LocalDateSchema });
export const BadgeSchema = BadgeFieldsSchema.extend({ id: z.uuid(), createdAt: z.iso.datetime() });
export const CreateBadgeInputSchema = BadgeFieldsSchema.extend({ id: z.uuid().optional() });
export type Badge = z.infer<typeof BadgeSchema>;
export type CreateBadgeInput = z.infer<typeof CreateBadgeInputSchema>;
