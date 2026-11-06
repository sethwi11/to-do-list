import express from 'express';
import {
  CreateApplicationInputSchema,
  CreateCalendarInputSchema,
  CreateCourseInputSchema,
  CreateEventInputSchema,
  CreateEventTypeInputSchema,
  CreateFocusSessionInputSchema,
  CreateSemesterInputSchema,
  CreateTemplateInputSchema,
  CreateTimeBlockInputSchema,
  CreateWeeklyReviewInputSchema,
  UpdateApplicationInputSchema,
  UpdateCalendarInputSchema,
  UpdateCourseInputSchema,
  UpdateEventInputSchema,
  UpdateEventTypeInputSchema,
  UpdateSemesterInputSchema,
  UpdateTemplateInputSchema,
  UpdateTimeBlockInputSchema,
  UpdateWeeklyReviewInputSchema,
} from '@todo/shared';
import { errorHandler, notFound } from './middleware/errorHandler';
import type { Repositories } from './repositories';
import { attachmentsRouter } from './routes/attachments';
import { backupRouter } from './routes/backup';
import { crudRouter } from './routes/crudRouter';
import { eventsBatchRouter } from './routes/events';
import { settingsRouter } from './routes/settings';
import { tasksRouter } from './routes/tasks';

/**
 * Builds the Express app without starting it. Keeping "build" separate from
 * "listen" lets tests drive the app in-process with supertest (no real port,
 * no real database file).
 */
export function createApp(repos: Repositories, options: { uploadsDir: string }) {
  const app = express();

  // 5 MB, so a JSON backup import fits; normal requests are tiny.
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Tasks have their own router (recurrence and reordering); everything else is the generic one.
  app.use('/api/tasks', tasksRouter(repos.tasks));
  app.use('/api/calendars', crudRouter(repos.calendars, { label: 'Calendar', create: CreateCalendarInputSchema, update: UpdateCalendarInputSchema }));
  app.use('/api/event-types', crudRouter(repos.eventTypes, { label: 'Event type', create: CreateEventTypeInputSchema, update: UpdateEventTypeInputSchema }));
  app.use('/api/events', eventsBatchRouter(repos.events));
  app.use('/api/events', crudRouter(repos.events, { label: 'Event', create: CreateEventInputSchema, update: UpdateEventInputSchema }));
  app.use('/api/time-blocks', crudRouter(repos.timeBlocks, { label: 'Time block', create: CreateTimeBlockInputSchema, update: UpdateTimeBlockInputSchema }));
  app.use('/api/semesters', crudRouter(repos.semesters, { label: 'Semester', create: CreateSemesterInputSchema, update: UpdateSemesterInputSchema }));
  app.use('/api/courses', crudRouter(repos.courses, { label: 'Course', create: CreateCourseInputSchema, update: UpdateCourseInputSchema }));
  app.use('/api/applications', crudRouter(repos.applications, { label: 'Application', create: CreateApplicationInputSchema, update: UpdateApplicationInputSchema }));
  app.use('/api/templates', crudRouter(repos.templates, { label: 'Template', create: CreateTemplateInputSchema, update: UpdateTemplateInputSchema }));
  app.use('/api/focus-sessions', crudRouter(repos.focusSessions, { label: 'Focus session', create: CreateFocusSessionInputSchema, update: null }));
  app.use('/api/weekly-reviews', crudRouter(repos.weeklyReviews, { label: 'Weekly review', create: CreateWeeklyReviewInputSchema, update: UpdateWeeklyReviewInputSchema }));
  app.use('/api/attachments', attachmentsRouter(repos.attachments, options.uploadsDir));
  app.use('/api/settings', settingsRouter(repos.settings));
  app.use('/api/backup', backupRouter(repos.backup));

  app.use('/api', notFound);
  app.use(errorHandler);

  return app;
}
