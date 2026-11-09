import {
  CALENDAR_COLORS,
  type Calendar,
  type Course,
  type CreateCalendarInput,
  type CreateCourseInput,
  type CreateEventInput,
  type CreateEventTypeInput,
  type CreateFocusSessionInput,
  type CreateSemesterInput,
  type CreateTemplateInput,
  type CreateTimeBlockInput,
  type CreateWeeklyReviewInput,
  type Badge,
  type CreateBadgeInput,
  type CreateMilestoneInput,
  type Milestone,
  type UpdateMilestoneInput,
  type CreateWeekTemplateInput,
  type CreateRoutineBlockInput,
  type RoutineBlock,
  type UpdateRoutineBlockInput,
  type UpdateWeekTemplateInput,
  type WeekTemplate,
  type RoutineOverride,
  type CheckIn,
  type CreateExpenseCategoryInput,
  type CreateExpenseInput,
  type CreateHoldingInput,
  type CreateMoneyMoveInput,
  type CreateSavingsGoalInput,
  type Expense,
  type ExpenseCategory,
  type Holding,
  type MoneyMove,
  type SavingsGoal,
  type UpdateExpenseCategoryInput,
  type UpdateExpenseInput,
  type UpdateHoldingInput,
  type UpdateSavingsGoalInput,
  type CreateCheckInInput,
  type UpdateCheckInInput,
  type CreateRoutineOverrideInput,
  type UpdateRoutineOverrideInput,
  type Event,
  type EventType,
  type FocusSession,
  type Semester,
  type Template,
  type TimeBlock,
  type UpdateCalendarInput,
  type UpdateCourseInput,
  type UpdateEventInput,
  type UpdateEventTypeInput,
  type UpdateSemesterInput,
  type UpdateTemplateInput,
  type UpdateTimeBlockInput,
  type UpdateWeeklyReviewInput,
  type WeeklyReview,
} from '@todo/shared';
import type { Db } from '../db/connection';
import { HttpError } from '../errors';
import { SqliteEntityRepository } from './SqliteEntityRepository';

// One small configuration per table.

export const createCalendarRepository = (db: Db) =>
  new SqliteEntityRepository<Calendar, CreateCalendarInput, UpdateCalendarInput>(db, {
    table: 'calendars',
    orderBy: 'sort_order, created_at',
    build: (input, { id, now, sortOrder, count }) => ({
      id,
      name: input.name,
      // No color chosen: cycle through the palette so new calendars look distinct.
      color: input.color ?? CALENDAR_COLORS[count % CALENDAR_COLORS.length]!,
      sortOrder,
      createdAt: now,
    }),
  });

export const createEventTypeRepository = (db: Db) =>
  new SqliteEntityRepository<EventType, CreateEventTypeInput, UpdateEventTypeInput>(db, {
    table: 'event_types',
    orderBy: 'sort_order',
    build: (input, { id, sortOrder }) => ({ id, name: input.name, sortOrder }),
  });

// `end` is reserved in SQL, so these two fields live in start_at / end_at columns.
const TIME_COLUMNS = { start: 'start_at', end: 'end_at' } as const;
const endAfterStart = (v: { start: string; end: string }) => (v.end > v.start ? null : 'The end must be after the start');

export const createEventRepository = (db: Db) =>
  new SqliteEntityRepository<Event, CreateEventInput, UpdateEventInput>(db, {
    table: 'events',
    orderBy: 'start_at, created_at',
    json: ['recurrence'],
    bool: ['allDay'],
    columns: TIME_COLUMNS,
    softDelete: true,
    check: endAfterStart,
    build: (i, { id, now }) => ({
      id,
      title: i.title,
      start: i.start,
      end: i.end,
      allDay: i.allDay ?? false,
      calendarId: i.calendarId ?? null,
      typeId: i.typeId ?? null,
      location: i.location ?? null,
      link: i.link ?? null,
      notes: i.notes ?? null,
      color: i.color ?? null,
      reminderMinutes: i.reminderMinutes ?? null,
      recurrence: i.recurrence ?? null,
      recurringEventId: i.recurringEventId ?? null,
      originalStart: i.originalStart ?? null,
      courseId: i.courseId ?? null,
      applicationId: i.applicationId ?? null,
      source: i.source ?? 'manual',
      createdAt: now,
      updatedAt: now,
    }),
  });

export const createTimeBlockRepository = (db: Db) =>
  new SqliteEntityRepository<TimeBlock, CreateTimeBlockInput, UpdateTimeBlockInput>(db, {
    table: 'time_blocks',
    orderBy: 'start_at',
    columns: TIME_COLUMNS,
    softDelete: true,
    check: endAfterStart,
    build: (i, { id, now }) => ({ id, taskId: i.taskId, start: i.start, end: i.end, createdAt: now, updatedAt: now }),
  });

export const createSemesterRepository = (db: Db) =>
  new SqliteEntityRepository<Semester, CreateSemesterInput, UpdateSemesterInput>(db, {
    table: 'semesters',
    orderBy: 'start_date DESC',
    json: ['excludedRanges'],
    bool: ['archived'],
    check: (v) => (v.endDate >= v.startDate ? null : 'The semester must end on or after it starts'),
    build: (i, { id, now }) => ({
      id,
      name: i.name,
      startDate: i.startDate,
      endDate: i.endDate,
      excludedRanges: i.excludedRanges ?? [],
      archived: i.archived ?? false,
      createdAt: now,
    }),
  });

export const createCourseRepository = (db: Db) =>
  new SqliteEntityRepository<Course, CreateCourseInput, UpdateCourseInput>(db, {
    table: 'courses',
    orderBy: 'name',
    json: ['meetingDays'],
    check: (v) => (v.endTime > v.startTime ? null : 'Class must end after it starts'),
    build: (i, { id, now, count }) => ({
      id,
      semesterId: i.semesterId,
      name: i.name,
      code: i.code ?? null,
      color: i.color ?? CALENDAR_COLORS[count % CALENDAR_COLORS.length]!,
      calendarId: i.calendarId ?? null,
      meetingDays: i.meetingDays,
      startTime: i.startTime,
      endTime: i.endTime,
      location: i.location ?? null,
      instructor: i.instructor ?? null,
      notes: i.notes ?? null,
      createdAt: now,
      updatedAt: now,
    }),
  });

class SqliteTemplateRepository extends SqliteEntityRepository<Template, CreateTemplateInput, UpdateTemplateInput> {
  override async delete(id: string): Promise<boolean> {
    if (this.getSync(id)?.builtIn) throw new HttpError(403, "Built-in templates can't be deleted. You can edit them, though.");
    return super.delete(id);
  }
}

export const createTemplateRepository = (db: Db) =>
  new SqliteTemplateRepository(db, {
    table: 'templates',
    orderBy: 'built_in DESC, name',
    json: ['items'],
    bool: ['builtIn'],
    // builtIn is never taken from a client: anything created through the API is the user's own.
    build: (i, { id, now }) => ({ id, name: i.name, items: i.items, builtIn: false, createdAt: now, updatedAt: now }),
  });

export const createFocusSessionRepository = (db: Db) =>
  new SqliteEntityRepository<FocusSession, CreateFocusSessionInput, never>(db, {
    table: 'focus_sessions',
    orderBy: 'started_at DESC',
    build: (i, { id, now }) => ({ id, taskId: i.taskId, startedAt: i.startedAt, durationSeconds: i.durationSeconds, createdAt: now }),
  });

export const createWeeklyReviewRepository = (db: Db) =>
  new SqliteEntityRepository<WeeklyReview, CreateWeeklyReviewInput, UpdateWeeklyReviewInput>(db, {
    table: 'weekly_reviews',
    orderBy: 'week_start DESC',
    json: ['priorities'],
    build: (i, { id, now }) => ({ id, weekStart: i.weekStart, notes: i.notes ?? '', priorities: i.priorities ?? [], createdAt: now, updatedAt: now }),
  });

export const createWeekTemplateRepository = (db: Db) =>
  new SqliteEntityRepository<WeekTemplate, CreateWeekTemplateInput, UpdateWeekTemplateInput>(db, {
    table: 'week_templates',
    orderBy: 'effective_from DESC, created_at',
    json: ['days', 'meetingWindows'],
    softDelete: true,
    check: (v) => (v.effectiveTo === null || v.effectiveTo >= v.effectiveFrom ? null : 'The end date must be on or after the start date'),
    build: (i, { id, now }) => ({ id, name: i.name, effectiveFrom: i.effectiveFrom, effectiveTo: i.effectiveTo ?? null, days: i.days ?? [], meetingWindows: i.meetingWindows ?? [], createdAt: now, updatedAt: now }),
  });

export const createRoutineBlockRepository = (db: Db) =>
  new SqliteEntityRepository<RoutineBlock, CreateRoutineBlockInput, UpdateRoutineBlockInput>(db, {
    table: 'routine_blocks',
    orderBy: 'weekday, start_time',
    bool: ['focus', 'notify', 'schoolDaysOnly', 'reschedulable'],
    columns: { start: 'start_time', end: 'end_time' },
    softDelete: true,
    check: (v) => (v.start !== v.end ? null : 'The block must end at a different time than it starts'),
    build: (i, { id, now }) => ({
      id,
      templateId: i.templateId,
      weekday: i.weekday,
      start: i.start,
      end: i.end,
      title: i.title,
      calendarId: i.calendarId ?? null,
      altTitle: i.altTitle ?? null,
      altCalendarId: i.altCalendarId ?? null,
      priority: i.priority ?? 'normal',
      focus: i.focus ?? false,
      soundtrack: i.soundtrack ?? null,
      notify: i.notify ?? true,
      schoolDaysOnly: i.schoolDaysOnly ?? false,
      reschedulable: i.reschedulable ?? false,
      notes: i.notes ?? null,
      createdAt: now,
      updatedAt: now,
    }),
  });

export const createRoutineOverrideRepository = (db: Db) =>
  new SqliteEntityRepository<RoutineOverride, CreateRoutineOverrideInput, UpdateRoutineOverrideInput>(db, {
    table: 'routine_overrides',
    orderBy: 'date, created_at',
    columns: TIME_COLUMNS,
    softDelete: true,
    build: (i, { id, now }) => ({
      id,
      date: i.date,
      routineBlockId: i.routineBlockId ?? null,
      action: i.action,
      start: i.start ?? null,
      end: i.end ?? null,
      title: i.title ?? null,
      calendarId: i.calendarId ?? null,
      taskId: i.taskId ?? null,
      eventId: i.eventId ?? null,
      sourceDate: i.sourceDate ?? null,
      createdAt: now,
      updatedAt: now,
    }),
  });

export const createCheckInRepository = (db: Db) =>
  new SqliteEntityRepository<CheckIn, CreateCheckInInput, UpdateCheckInInput>(db, {
    table: 'check_ins',
    orderBy: 'date, created_at',
    bool: ['usedAlt'],
    build: (i, { id, now }) => ({ id, date: i.date, itemKey: i.itemKey, title: i.title, calendarId: i.calendarId, minutes: i.minutes, status: i.status, usedAlt: i.usedAlt ?? false, learned: i.learned ?? null, createdAt: now, updatedAt: now }),
  });

// ---- money ----

export const createExpenseCategoryRepository = (db: Db) =>
  new SqliteEntityRepository<ExpenseCategory, CreateExpenseCategoryInput, UpdateExpenseCategoryInput>(db, {
    table: 'expense_categories',
    orderBy: 'sort_order, created_at',
    build: (i, { id, now, sortOrder }) => ({ id, name: i.name, sortOrder, createdAt: now }),
  });

export const createExpenseRepository = (db: Db) =>
  new SqliteEntityRepository<Expense, CreateExpenseInput, UpdateExpenseInput>(db, {
    table: 'expenses',
    orderBy: 'date DESC, created_at DESC',
    bool: ['recurring'],
    softDelete: true,
    build: (i, { id, now }) => ({ id, amountCents: i.amountCents, what: i.what, categoryId: i.categoryId ?? null, date: i.date, kind: i.kind ?? 'need', recurring: i.recurring ?? false, createdAt: now, updatedAt: now }),
  });

export const createSavingsGoalRepository = (db: Db) =>
  new SqliteEntityRepository<SavingsGoal, CreateSavingsGoalInput, UpdateSavingsGoalInput>(db, {
    table: 'savings_goals',
    orderBy: 'sort_order, created_at',
    softDelete: true,
    build: (i, { id, now, sortOrder }) => ({ id, name: i.name, targetCents: i.targetCents, sortOrder, createdAt: now, updatedAt: now }),
  });

export const createHoldingRepository = (db: Db) =>
  new SqliteEntityRepository<Holding, CreateHoldingInput, UpdateHoldingInput>(db, {
    table: 'holdings',
    orderBy: 'sort_order, created_at',
    softDelete: true,
    build: (i, { id, now, sortOrder }) => ({ id, name: i.name, type: i.type, valueCents: i.valueCents, valueUpdatedOn: i.valueUpdatedOn, monthlyTargetCents: i.monthlyTargetCents ?? null, sortOrder, createdAt: now, updatedAt: now }),
  });

export const createMoneyMoveRepository = (db: Db) =>
  new SqliteEntityRepository<MoneyMove, CreateMoneyMoveInput, never>(db, {
    table: 'money_moves',
    orderBy: 'date, created_at',
    build: (i, { id, now }) => ({ id, date: i.date, periodStart: i.periodStart ?? null, toType: i.toType, toId: i.toId, amountCents: i.amountCents, note: i.note ?? null, createdAt: now }),
  });

// ---- the Path ----

export const createMilestoneRepository = (db: Db) =>
  new SqliteEntityRepository<Milestone, CreateMilestoneInput, UpdateMilestoneInput>(db, {
    table: 'milestones',
    orderBy: 'sort_order, created_at',
    json: ['calendarIds'],
    bool: ['trackOffers'],
    softDelete: true,
    build: (i, { id, now, sortOrder }) => ({ id, title: i.title, targetDate: i.targetDate ?? null, reachedOn: i.reachedOn ?? null, calendarIds: i.calendarIds ?? [], savingsGoalId: i.savingsGoalId ?? null, trackOffers: i.trackOffers ?? false, sortOrder, createdAt: now, updatedAt: now }),
  });

export const createBadgeRepository = (db: Db) =>
  new SqliteEntityRepository<Badge, CreateBadgeInput, never>(db, {
    table: 'badges',
    orderBy: 'earned_on, created_at',
    build: (i, { id, now }) => ({ id, key: i.key, title: i.title, earnedOn: i.earnedOn, createdAt: now }),
  });

export type CalendarRepo = ReturnType<typeof createCalendarRepository>;
export type EventTypeRepo = ReturnType<typeof createEventTypeRepository>;
export type EventRepo = ReturnType<typeof createEventRepository>;
export type TimeBlockRepo = ReturnType<typeof createTimeBlockRepository>;
export type SemesterRepo = ReturnType<typeof createSemesterRepository>;
export type CourseRepo = ReturnType<typeof createCourseRepository>;
export type TemplateRepo = ReturnType<typeof createTemplateRepository>;
export type FocusSessionRepo = ReturnType<typeof createFocusSessionRepository>;
export type WeeklyReviewRepo = ReturnType<typeof createWeeklyReviewRepository>;
export type WeekTemplateRepo = ReturnType<typeof createWeekTemplateRepository>;
export type RoutineBlockRepo = ReturnType<typeof createRoutineBlockRepository>;
export type RoutineOverrideRepo = ReturnType<typeof createRoutineOverrideRepository>;
export type CheckInRepo = ReturnType<typeof createCheckInRepository>;
export type ExpenseCategoryRepo = ReturnType<typeof createExpenseCategoryRepository>;
export type ExpenseRepo = ReturnType<typeof createExpenseRepository>;
export type SavingsGoalRepo = ReturnType<typeof createSavingsGoalRepository>;
export type HoldingRepo = ReturnType<typeof createHoldingRepository>;
export type MoneyMoveRepo = ReturnType<typeof createMoneyMoveRepository>;
export type MilestoneRepo = ReturnType<typeof createMilestoneRepository>;
export type BadgeRepo = ReturnType<typeof createBadgeRepository>;
