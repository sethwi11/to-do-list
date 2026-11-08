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
  type Event,
  type EventBatchInput,
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

class SqliteEventRepository extends SqliteEntityRepository<Event, CreateEventInput, UpdateEventInput> {
  /** Write several rows and delete others as one unit: if any row is rejected, nothing changes. */
  async applyBatch({ put, remove }: EventBatchInput): Promise<{ put: Event[]; removed: string[] }> {
    return this.db.transaction(() => {
      for (const row of put) {
        const problem = this.config.check?.(row);
        if (problem) throw new HttpError(400, problem);
        this.upsertSync(row);
      }
      return { put, removed: remove.filter((id) => this.removeSync(id)) };
    })();
  }
}

export const createEventRepository = (db: Db) =>
  new SqliteEventRepository(db, {
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
    build: (i, { id, now }) => ({ id, weekStart: i.weekStart, notes: i.notes, createdAt: now, updatedAt: now }),
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
