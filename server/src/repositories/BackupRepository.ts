import { BACKUP_VERSION, type Backup } from '@todo/shared';
import type { Db } from '../db/connection';
import type {
  CalendarRepo,
  CourseRepo,
  EventRepo,
  EventTypeRepo,
  FocusSessionRepo,
  SemesterRepo,
  TemplateRepo,
  TimeBlockRepo,
  WeeklyReviewRepo,
} from './entities';
import type { SqliteApplicationRepository } from './SqliteApplicationRepository';
import type { SqliteSettingsRepository } from './SqliteSettingsRepository';
import type { SqliteTaskRepository } from './SqliteTaskRepository';

/** The concrete repositories a backup reads from and writes to. */
export interface BackupSources {
  calendars: CalendarRepo;
  eventTypes: EventTypeRepo;
  tasks: SqliteTaskRepository;
  events: EventRepo;
  timeBlocks: TimeBlockRepo;
  semesters: SemesterRepo;
  courses: CourseRepo;
  applications: SqliteApplicationRepository;
  templates: TemplateRepo;
  focusSessions: FocusSessionRepo;
  weeklyReviews: WeeklyReviewRepo;
  settings: SqliteSettingsRepository;
}

/** Per-table counts of what an import did. */
export type ImportSummary = Record<string, { added: number; updated: number }>;

/** Export/import of everything as one JSON document. */
export class BackupRepository {
  constructor(
    private readonly db: Db,
    private readonly r: BackupSources,
  ) {}

  async export(): Promise<Backup> {
    const r = this.r;
    return {
      app: 'voice-todo',
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      calendars: r.calendars.listSync(),
      eventTypes: r.eventTypes.listSync(),
      tasks: await r.tasks.list(),
      events: r.events.listSync(),
      timeBlocks: r.timeBlocks.listSync(),
      semesters: r.semesters.listSync(),
      courses: r.courses.listSync(),
      applications: await r.applications.list(),
      templates: r.templates.listSync(),
      focusSessions: r.focusSessions.listSync(),
      weeklyReviews: r.weeklyReviews.listSync(),
      settings: r.settings.getSync(),
    };
  }

  async import(backup: Backup): Promise<ImportSummary> {
    const r = this.r;
    const summary: ImportSummary = {};
    const count = (table: string, existed: boolean) => {
      const entry = (summary[table] ??= { added: 0, updated: 0 });
      if (existed) entry.updated++;
      else entry.added++;
    };

    this.db.transaction(() => {
      // Imported id -> the id used here, for rows matched by name.
      const calendarIds = new Map<string, string>();
      const typeIds = new Map<string, string>();
      const mapCalendar = (id: string | null) => (id ? (calendarIds.get(id) ?? id) : null);

      const existingCalendars = r.calendars.listSync();
      for (const c of backup.calendars) {
        const match =
          existingCalendars.find((e) => e.id === c.id) ??
          existingCalendars.find((e) => e.name.toLowerCase() === c.name.toLowerCase());
        const id = match?.id ?? c.id;
        calendarIds.set(c.id, id);
        count('calendars', r.calendars.upsertSync({ ...c, id }));
        if (!match) existingCalendars.push({ ...c, id });
      }

      const existingTypes = r.eventTypes.listSync();
      for (const t of backup.eventTypes) {
        const match =
          existingTypes.find((e) => e.id === t.id) ?? existingTypes.find((e) => e.name.toLowerCase() === t.name.toLowerCase());
        const id = match?.id ?? t.id;
        typeIds.set(t.id, id);
        count('eventTypes', r.eventTypes.upsertSync({ ...t, id }));
        if (!match) existingTypes.push({ ...t, id });
      }

      for (const s of backup.semesters) count('semesters', r.semesters.upsertSync(s));
      for (const a of backup.applications) count('applications', r.applications.upsertApplicationSync(a));
      for (const c of backup.courses) count('courses', r.courses.upsertSync({ ...c, calendarId: mapCalendar(c.calendarId) }));
      for (const t of backup.tasks) count('tasks', r.tasks.upsertSync({ ...t, calendarId: mapCalendar(t.calendarId) }));

      // A series must exist before the one-off overrides that point at it.
      const events = [...backup.events].sort((a, b) => Number(a.recurringEventId !== null) - Number(b.recurringEventId !== null));
      for (const e of events) {
        const typeId = e.typeId ? (typeIds.get(e.typeId) ?? e.typeId) : null;
        count('events', r.events.upsertSync({ ...e, calendarId: mapCalendar(e.calendarId), typeId }));
      }
      for (const b of backup.timeBlocks) count('timeBlocks', r.timeBlocks.upsertSync(b));

      const existingTemplates = r.templates.listSync();
      for (const t of backup.templates) {
        // The three built-ins already exist here (with their own ids); keep one copy.
        const twin = t.builtIn && existingTemplates.find((e) => e.builtIn && e.name === t.name);
        count('templates', r.templates.upsertSync(twin ? { ...t, id: twin.id } : t));
      }

      for (const f of backup.focusSessions) count('focusSessions', r.focusSessions.upsertSync(f));

      // One review per week: if this week already has one, the imported notes replace it.
      const existingReviews = r.weeklyReviews.listSync();
      for (const w of backup.weeklyReviews) {
        const same = existingReviews.find((e) => e.weekStart === w.weekStart);
        count('weeklyReviews', r.weeklyReviews.upsertSync(same ? { ...w, id: same.id } : w));
      }

      if (backup.settings) {
        r.settings.setSync(backup.settings);
        count('settings', true);
      }
    })();

    return summary;
  }
}
