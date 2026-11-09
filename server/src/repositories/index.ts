import type {
  Application,
  Calendar,
  Course,
  CreateApplicationInput,
  CreateCalendarInput,
  CreateCourseInput,
  CreateEventInput,
  CreateEventTypeInput,
  CreateFocusSessionInput,
  CreateSemesterInput,
  CreateTemplateInput,
  CreateTimeBlockInput,
  CreateWeeklyReviewInput,
  Badge,
  CreateBadgeInput,
  CreateMilestoneInput,
  Milestone,
  UpdateMilestoneInput,
  CreateWeekTemplateInput,
  CreateRoutineBlockInput,
  RoutineBlock,
  UpdateRoutineBlockInput,
  UpdateWeekTemplateInput,
  WeekTemplate,
  RoutineOverride,
  CheckIn,
  CreateExpenseCategoryInput,
  CreateExpenseInput,
  CreateHoldingInput,
  CreateMoneyMoveInput,
  CreateSavingsGoalInput,
  Expense,
  ExpenseCategory,
  Holding,
  MoneyMove,
  SavingsGoal,
  UpdateExpenseCategoryInput,
  UpdateExpenseInput,
  UpdateHoldingInput,
  UpdateSavingsGoalInput,
  CreateCheckInInput,
  UpdateCheckInInput,
  CreateRoutineOverrideInput,
  UpdateRoutineOverrideInput,
  Event,
  EventType,
  FocusSession,
  Semester,
  Template,
  TimeBlock,
  UpdateApplicationInput,
  UpdateCalendarInput,
  UpdateCourseInput,
  UpdateEventInput,
  UpdateEventTypeInput,
  UpdateSemesterInput,
  UpdateTemplateInput,
  UpdateTimeBlockInput,
  UpdateWeeklyReviewInput,
  WeeklyReview,
} from '@todo/shared';
import type { Db } from '../db/connection';
import { BackupRepository } from './BackupRepository';
import {
  createCalendarRepository,
  createCourseRepository,
  createEventRepository,
  createEventTypeRepository,
  createFocusSessionRepository,
  createSemesterRepository,
  createTemplateRepository,
  createTimeBlockRepository,
  createWeeklyReviewRepository,
  createRoutineBlockRepository,
  createWeekTemplateRepository,
  createRoutineOverrideRepository,
  createCheckInRepository,
  createExpenseCategoryRepository,
  createExpenseRepository,
  createHoldingRepository,
  createMoneyMoveRepository,
  createMilestoneRepository,
  createBadgeRepository,
  createSavingsGoalRepository,
} from './entities';
import { SqliteApplicationRepository } from './SqliteApplicationRepository';
import { SqliteAttachmentRepository } from './SqliteAttachmentRepository';
import { SqliteSettingsRepository, type SettingsRepository } from './SqliteSettingsRepository';
import { SqliteTaskRepository } from './SqliteTaskRepository';
import type { TaskRepository } from './TaskRepository';
import type { CrudRepository, RestorableRepository } from './types';

type Batchable<T> = { applyBatch(batch: { put: T[]; remove: string[] }): Promise<{ put: T[]; removed: string[] }> };

/** Everything the HTTP layer needs, typed as interfaces so routes never see SQLite. */
export interface Repositories {
  tasks: TaskRepository;
  calendars: CrudRepository<Calendar, CreateCalendarInput, UpdateCalendarInput>;
  eventTypes: CrudRepository<EventType, CreateEventTypeInput, UpdateEventTypeInput>;
  events: RestorableRepository<Event, CreateEventInput, UpdateEventInput> & Batchable<Event>;
  timeBlocks: RestorableRepository<TimeBlock, CreateTimeBlockInput, UpdateTimeBlockInput>;
  semesters: CrudRepository<Semester, CreateSemesterInput, UpdateSemesterInput>;
  courses: CrudRepository<Course, CreateCourseInput, UpdateCourseInput>;
  applications: CrudRepository<Application, CreateApplicationInput, UpdateApplicationInput>;
  templates: CrudRepository<Template, CreateTemplateInput, UpdateTemplateInput>;
  focusSessions: CrudRepository<FocusSession, CreateFocusSessionInput, never>;
  weeklyReviews: CrudRepository<WeeklyReview, CreateWeeklyReviewInput, UpdateWeeklyReviewInput>;
  weekTemplates: RestorableRepository<WeekTemplate, CreateWeekTemplateInput, UpdateWeekTemplateInput>;
  routineBlocks: RestorableRepository<RoutineBlock, CreateRoutineBlockInput, UpdateRoutineBlockInput> & Batchable<RoutineBlock>;
  routineOverrides: RestorableRepository<RoutineOverride, CreateRoutineOverrideInput, UpdateRoutineOverrideInput>;
  checkIns: CrudRepository<CheckIn, CreateCheckInInput, UpdateCheckInInput>;
  expenseCategories: CrudRepository<ExpenseCategory, CreateExpenseCategoryInput, UpdateExpenseCategoryInput>;
  expenses: RestorableRepository<Expense, CreateExpenseInput, UpdateExpenseInput>;
  savingsGoals: RestorableRepository<SavingsGoal, CreateSavingsGoalInput, UpdateSavingsGoalInput>;
  holdings: RestorableRepository<Holding, CreateHoldingInput, UpdateHoldingInput>;
  moneyMoves: CrudRepository<MoneyMove, CreateMoneyMoveInput, never> & Batchable<MoneyMove>;
  milestones: RestorableRepository<Milestone, CreateMilestoneInput, UpdateMilestoneInput>;
  badges: CrudRepository<Badge, CreateBadgeInput, never>;
  settings: SettingsRepository;
  attachments: SqliteAttachmentRepository;
  backup: BackupRepository;
}

/** Builds every SQLite-backed repository. Swapping storage later means writing this one function for another database. */
export function createRepositories(db: Db): Repositories {
  const concrete = {
    calendars: createCalendarRepository(db),
    eventTypes: createEventTypeRepository(db),
    tasks: new SqliteTaskRepository(db),
    events: createEventRepository(db),
    timeBlocks: createTimeBlockRepository(db),
    semesters: createSemesterRepository(db),
    courses: createCourseRepository(db),
    applications: new SqliteApplicationRepository(db),
    templates: createTemplateRepository(db),
    focusSessions: createFocusSessionRepository(db),
    weeklyReviews: createWeeklyReviewRepository(db),
    weekTemplates: createWeekTemplateRepository(db),
    routineBlocks: createRoutineBlockRepository(db),
    routineOverrides: createRoutineOverrideRepository(db),
    checkIns: createCheckInRepository(db),
    expenseCategories: createExpenseCategoryRepository(db),
    expenses: createExpenseRepository(db),
    savingsGoals: createSavingsGoalRepository(db),
    holdings: createHoldingRepository(db),
    moneyMoves: createMoneyMoveRepository(db),
    milestones: createMilestoneRepository(db),
    badges: createBadgeRepository(db),
    settings: new SqliteSettingsRepository(db),
  };
  return { ...concrete, attachments: new SqliteAttachmentRepository(db), backup: new BackupRepository(db, concrete) };
}
