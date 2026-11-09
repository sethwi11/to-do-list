import { BACKUP_VERSION, mergeSettings, type Backup } from '@todo/shared';
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
  RoutineBlockRepo,
  WeekTemplateRepo,
  RoutineOverrideRepo,
  CheckInRepo,
  ExpenseCategoryRepo,
  ExpenseRepo,
  HoldingRepo,
  MoneyMoveRepo,
  SavingsGoalRepo,
  MilestoneRepo,
  BadgeRepo,
  JournalEntryRepo,
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
  weekTemplates: WeekTemplateRepo;
  routineBlocks: RoutineBlockRepo;
  routineOverrides: RoutineOverrideRepo;
  checkIns: CheckInRepo;
  expenseCategories: ExpenseCategoryRepo;
  expenses: ExpenseRepo;
  savingsGoals: SavingsGoalRepo;
  holdings: HoldingRepo;
  moneyMoves: MoneyMoveRepo;
  milestones: MilestoneRepo;
  badges: BadgeRepo;
  journalEntries: JournalEntryRepo;
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
      weekTemplates: r.weekTemplates.listSync(),
      routineBlocks: r.routineBlocks.listSync(),
      routineOverrides: r.routineOverrides.listSync(),
      checkIns: r.checkIns.listSync(),
      expenseCategories: r.expenseCategories.listSync(),
      expenses: r.expenses.listSync(),
      savingsGoals: r.savingsGoals.listSync(),
      holdings: r.holdings.listSync(),
      moneyMoves: r.moneyMoves.listSync(),
      milestones: r.milestones.listSync(),
      badges: r.badges.listSync(),
      journalEntries: r.journalEntries.listSync(),
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

      for (const t of backup.weekTemplates) count('weekTemplates', r.weekTemplates.upsertSync(t));
      for (const b of backup.routineBlocks) {
        count('routineBlocks', r.routineBlocks.upsertSync({ ...b, calendarId: mapCalendar(b.calendarId), altCalendarId: mapCalendar(b.altCalendarId) }));
      }

      for (const o of backup.routineOverrides) count('routineOverrides', r.routineOverrides.upsertSync({ ...o, calendarId: mapCalendar(o.calendarId) }));

      // Money. Categories are matched by name, like calendars, so the nine starting ones aren't duplicated.
      const categoryIds = new Map<string, string>();
      const existingCategories = r.expenseCategories.listSync();
      for (const c of backup.expenseCategories) {
        const match = existingCategories.find((e) => e.id === c.id) ?? existingCategories.find((e) => e.name.toLowerCase() === c.name.toLowerCase());
        const id = match?.id ?? c.id;
        categoryIds.set(c.id, id);
        count('expenseCategories', r.expenseCategories.upsertSync({ ...c, id }));
        if (!match) existingCategories.push({ ...c, id });
      }
      for (const e of backup.expenses) count('expenses', r.expenses.upsertSync({ ...e, categoryId: e.categoryId ? (categoryIds.get(e.categoryId) ?? e.categoryId) : null }));
      for (const g of backup.savingsGoals) count('savingsGoals', r.savingsGoals.upsertSync(g));
      for (const h of backup.holdings) count('holdings', r.holdings.upsertSync(h));
      for (const m of backup.moneyMoves) count('moneyMoves', r.moneyMoves.upsertSync(m));

      for (const m of backup.milestones) count('milestones', r.milestones.upsertSync({ ...m, calendarIds: m.calendarIds.map((id) => mapCalendar(id)!) }));
      // One badge per key: if this one was already earned here, the earlier row stays as it is.
      const earned = new Set(r.badges.listSync().map((b) => b.key));
      for (const b of backup.badges) if (!earned.has(b.key)) count('badges', r.badges.upsertSync(b));

      // One journal entry per day: if this day already has one, the more recently edited of the two is kept, so an import never overwrites newer writing.
      const existingEntries = r.journalEntries.listSync();
      for (const j of backup.journalEntries) {
        const same = existingEntries.find((e) => e.date === j.date);
        if (same && same.updatedAt >= j.updatedAt) continue;
        count('journalEntries', r.journalEntries.upsertSync(same ? { ...j, id: same.id } : j));
      }

      // One check-in per item per day: if this day's item already has one, the imported one replaces it.
      const existingCheckIns = r.checkIns.listSync();
      for (const c of backup.checkIns) {
        const same = existingCheckIns.find((e) => e.date === c.date && e.itemKey === c.itemKey);
        count('checkIns', r.checkIns.upsertSync({ ...c, id: same?.id ?? c.id, calendarId: mapCalendar(c.calendarId) }));
      }

      if (backup.settings) {
        r.settings.setSync(mergeSettings(r.settings.getSync(), backup.settings));
        count('settings', true);
      }
    })();

    return summary;
  }
}
