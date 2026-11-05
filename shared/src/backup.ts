import { z } from 'zod';
import { CalendarSchema } from './calendarModel';
import { DEFAULT_CALENDARS, toPaletteColor } from './palette';
import { TaskSchema, TASK_SOURCES } from './task';
import { ApplicationSchema } from './models/applications';
import { CourseSchema, SemesterSchema } from './models/courses';
import { EventSchema, EventTypeSchema, TimeBlockSchema } from './models/events';
import { AppSettingsSchema, FocusSessionSchema, WeeklyReviewSchema } from './models/misc';
import { TemplateSchema } from './models/templates';

export const BACKUP_VERSION = 2;

/**
 * The JSON file format for export/import, versioned so a future format can
 * still read old files. Attachments' files are not included (only the app's
 * data is); they'd make the file huge, and they live in server/uploads.
 */
export const BackupSchema = z.object({
  app: z.literal('voice-todo'),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.iso.datetime(),
  calendars: z.array(CalendarSchema),
  eventTypes: z.array(EventTypeSchema).default([]),
  tasks: z.array(TaskSchema),
  events: z.array(EventSchema).default([]),
  timeBlocks: z.array(TimeBlockSchema).default([]),
  semesters: z.array(SemesterSchema).default([]),
  courses: z.array(CourseSchema).default([]),
  applications: z.array(ApplicationSchema).default([]),
  templates: z.array(TemplateSchema).default([]),
  focusSessions: z.array(FocusSessionSchema).default([]),
  weeklyReviews: z.array(WeeklyReviewSchema).default([]),
  /** Omitted in older files: importing one then leaves your settings alone. */
  settings: AppSettingsSchema.optional(),
});

export type Backup = z.output<typeof BackupSchema>;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Old lists -> calendars, by the same rules as the database upgrade (migration 3), so
 * restoring an old export gives the same colors and order as upgrading the database did:
 * "Fraternity" becomes "Kappa Alpha Psi"; the default calendars get their palette color
 * and position; your own calendars keep their relative order after them, with old color
 * names translated.
 */
function upgradeCalendars(categories: Record<string, unknown>[]) {
  const rank = (name: string) => DEFAULT_CALENDARS.findIndex((d) => d.name.toLowerCase() === name.toLowerCase());
  let custom = 0;
  return [...categories]
    .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))
    .map((c) => {
      const name = String(c.name).toLowerCase() === 'fraternity' ? 'Kappa Alpha Psi' : String(c.name);
      const i = rank(name);
      return i >= 0
        ? { ...c, name, color: DEFAULT_CALENDARS[i]!.color, sortOrder: (i + 1) * 1024 }
        : { ...c, name, color: toPaletteColor(String(c.color)), sortOrder: (DEFAULT_CALENDARS.length + ++custom) * 1024 };
    });
}

/**
 * Version 1 files (from the original to-do app) have "categories" and tasks
 * with a categoryId. Rewrite one into the version 2 shape so it can be
 * validated and imported like any other. Anything that isn't a v1 file is returned untouched.
 */
export function upgradeBackup(raw: unknown): unknown {
  if (!isRecord(raw) || raw.version !== 1) return raw;

  const categories = Array.isArray(raw.categories) ? raw.categories : [];
  const tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
  return {
    app: raw.app,
    version: BACKUP_VERSION,
    exportedAt: raw.exportedAt,
    calendars: upgradeCalendars(categories.filter(isRecord)),
    tasks: tasks.filter(isRecord).map(({ categoryId, ...task }) => ({
      ...task,
      calendarId: categoryId ?? null,
      courseId: null,
      applicationId: null,
      reminders: [],
      source: (TASK_SOURCES as readonly unknown[]).includes(task.source) ? task.source : 'manual',
    })),
  };
}
