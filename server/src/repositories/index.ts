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
  Event,
  EventBatchInput,
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
} from './entities';
import { SqliteApplicationRepository } from './SqliteApplicationRepository';
import { SqliteSettingsRepository, type SettingsRepository } from './SqliteSettingsRepository';
import { SqliteTaskRepository } from './SqliteTaskRepository';
import type { TaskRepository } from './TaskRepository';
import type { CrudRepository, RestorableRepository } from './types';

/** Everything the HTTP layer needs, typed as interfaces so routes never see SQLite. */
export interface Repositories {
  tasks: TaskRepository;
  calendars: CrudRepository<Calendar, CreateCalendarInput, UpdateCalendarInput>;
  eventTypes: CrudRepository<EventType, CreateEventTypeInput, UpdateEventTypeInput>;
  events: RestorableRepository<Event, CreateEventInput, UpdateEventInput> & {
    applyBatch(batch: EventBatchInput): Promise<{ put: Event[]; removed: string[] }>;
  };
  timeBlocks: RestorableRepository<TimeBlock, CreateTimeBlockInput, UpdateTimeBlockInput>;
  semesters: CrudRepository<Semester, CreateSemesterInput, UpdateSemesterInput>;
  courses: CrudRepository<Course, CreateCourseInput, UpdateCourseInput>;
  applications: CrudRepository<Application, CreateApplicationInput, UpdateApplicationInput>;
  templates: CrudRepository<Template, CreateTemplateInput, UpdateTemplateInput>;
  focusSessions: CrudRepository<FocusSession, CreateFocusSessionInput, never>;
  weeklyReviews: CrudRepository<WeeklyReview, CreateWeeklyReviewInput, UpdateWeeklyReviewInput>;
  settings: SettingsRepository;
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
    settings: new SqliteSettingsRepository(db),
  };
  return { ...concrete, backup: new BackupRepository(db, concrete) };
}
