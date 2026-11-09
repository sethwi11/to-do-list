import { z } from 'zod';
import { hasFields, LocalDateSchema, NO_FIELDS_MESSAGE } from '../localTime';
import { DEFAULT_QUOTES, QuoteSchema } from '../quotes';
import { BudgetSettingsSchema, DEFAULT_BUDGET } from './money';
import { DEFAULT_PATH_SETTINGS, PathSettingsSchema } from './path';
import { DEFAULT_POPUP_SETTINGS, PopupSettingsSchema } from '../popups';

// ---- focus sessions -----------------------------------------------------

/** One finished focus (Pomodoro) session. Created by the timer; never edited. */
export const FocusSessionFieldsSchema = z.object({
  taskId: z.uuid().nullable(),
  /** A real instant: when the session began. */
  startedAt: z.iso.datetime(),
  durationSeconds: z.number().int().positive().max(24 * 3600),
});
export const FocusSessionSchema = FocusSessionFieldsSchema.extend({ id: z.uuid(), createdAt: z.iso.datetime() });
export const CreateFocusSessionInputSchema = FocusSessionFieldsSchema.extend({ id: z.uuid().optional() });
export type FocusSession = z.infer<typeof FocusSessionSchema>;
export type CreateFocusSessionInput = z.infer<typeof CreateFocusSessionInputSchema>;

// ---- weekly reviews -----------------------------------------------------

/** One week's review: reflection notes and up to three priorities for the week after. `weekStart` is that week's Monday. */
export const WeeklyReviewFieldsSchema = z.object({
  weekStart: LocalDateSchema,
  notes: z.string().max(20_000),
  priorities: z.array(z.string().trim().min(1).max(200)).max(3),
});
export const WeeklyReviewSchema = WeeklyReviewFieldsSchema.extend({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const CreateWeeklyReviewInputSchema = WeeklyReviewFieldsSchema.partial({ notes: true, priorities: true }).extend({ id: z.uuid().optional() });
export const UpdateWeeklyReviewInputSchema = WeeklyReviewFieldsSchema.pick({ notes: true, priorities: true }).partial().refine(hasFields, NO_FIELDS_MESSAGE);
export type WeeklyReview = z.infer<typeof WeeklyReviewSchema>;
export type CreateWeeklyReviewInput = z.infer<typeof CreateWeeklyReviewInputSchema>;
export type UpdateWeeklyReviewInput = z.infer<typeof UpdateWeeklyReviewInputSchema>;

// ---- settings -----------------------------------------------------------

/** A soundtrack: a link (opens in a new tab) and/or a folder of audio files on this Mac (played by the app). Nothing loads until you press play. */
export const SoundtrackSchema = z.object({
  name: z.string().trim().min(1).max(40),
  link: z.url({ protocol: /^https?$/ }).nullable(),
  folder: z.string().trim().min(1).max(500).nullable(),
});
export type Soundtrack = z.infer<typeof SoundtrackSchema>;

export const FocusSettingsSchema = z.object({
  focusMinutes: z.number().int().min(1).max(180),
  breakMinutes: z.number().int().min(1).max(60),
  longBreakMinutes: z.number().int().min(1).max(120),
  /** A long break after this many focus sessions. */
  longBreakEvery: z.number().int().min(1).max(12),
  sound: z.boolean(),
  notify: z.boolean(),
});

/**
 * Settings that belong to your data (and so should follow it to another
 * device). Per-device preferences like the theme live in the browser instead.
 */
export const AppSettingsSchema = z.object({
  offerGoal: z.number().int().min(1).max(1000),
  offerTargetDate: LocalDateSchema,
  focus: FocusSettingsSchema,
  sundayReviewReminder: z.boolean(),
  /** The morning view shows one a day. */
  quotes: z.array(QuoteSchema).max(500),
  popups: PopupSettingsSchema,
  soundtracks: z.array(SoundtrackSchema).max(30),
  budget: BudgetSettingsSchema,
  path: PathSettingsSchema,
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
  offerGoal: 10,
  offerTargetDate: '2027-05-01',
  focus: { focusMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4, sound: true, notify: true },
  sundayReviewReminder: false,
  quotes: DEFAULT_QUOTES,
  popups: DEFAULT_POPUP_SETTINGS,
  soundtracks: ['lofi', 'news', 'house'].map((name) => ({ name, link: null, folder: null })),
  budget: DEFAULT_BUDGET,
  path: DEFAULT_PATH_SETTINGS,
};

export const UpdateSettingsInputSchema = AppSettingsSchema.partial()
  .extend({ focus: FocusSettingsSchema.partial().optional(), popups: PopupSettingsSchema.partial().optional(), budget: BudgetSettingsSchema.partial().optional(), path: PathSettingsSchema.partial().optional() })
  .refine(hasFields, NO_FIELDS_MESSAGE);
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsInputSchema>;

/** Merge a stored/partial settings object over the defaults (one level deep for `focus`, `popups`, `budget` and `path`). */
export function mergeSettings(base: AppSettings, patch: UpdateSettingsInput | Partial<AppSettings>): AppSettings {
  return { ...base, ...patch, focus: { ...base.focus, ...(patch.focus ?? {}) }, popups: { ...base.popups, ...(patch.popups ?? {}) }, budget: { ...base.budget, ...(patch.budget ?? {}) }, path: { ...base.path, ...(patch.path ?? {}) } };
}

// ---- attachments --------------------------------------------------------

export const ATTACHMENT_OWNER_TYPES = ['task', 'event', 'application', 'course'] as const;
export const AttachmentOwnerTypeSchema = z.enum(ATTACHMENT_OWNER_TYPES);
export type AttachmentOwnerType = z.infer<typeof AttachmentOwnerTypeSchema>;

/**
 * File metadata. The bytes live on disk under server/uploads; the database
 * only stores where. A file can be linked to several items (the same syllabus
 * on a course and on each deadline made from it), which is why the links
 * are a separate table, so deleting one item can ask "delete the file too?"
 * only when nothing else still uses it.
 */
export const AttachmentSchema = z.object({
  id: z.uuid(),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(127),
  size: z.number().int().nonnegative(),
  path: z.string().min(1).max(500),
  createdAt: z.iso.datetime(),
});
export const AttachmentLinkSchema = z.object({
  attachmentId: z.uuid(),
  ownerType: AttachmentOwnerTypeSchema,
  ownerId: z.uuid(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;
export type AttachmentLink = z.infer<typeof AttachmentLinkSchema>;
