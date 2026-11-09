import path from 'node:path';
import express from 'express';
import {
  CreateApplicationInputSchema,
  CreateCalendarInputSchema,
  CreateCourseInputSchema,
  CreateEventInputSchema,
  CreateEventTypeInputSchema,
  CreateRoutineBlockInputSchema,
  CreateWeekTemplateInputSchema,
  CreateRoutineOverrideInputSchema,
  CreateCheckInInputSchema,
  CreateExpenseCategoryInputSchema,
  CreateExpenseInputSchema,
  CreateHoldingInputSchema,
  CreateMoneyMoveInputSchema,
  CreateSavingsGoalInputSchema,
  MoneyMoveBatchInputSchema,
  UpdateExpenseCategoryInputSchema,
  UpdateExpenseInputSchema,
  UpdateHoldingInputSchema,
  UpdateSavingsGoalInputSchema,
  UpdateCheckInInputSchema,
  UpdateRoutineOverrideInputSchema,
  EventBatchInputSchema,
  RoutineBlockBatchInputSchema,
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
  UpdateRoutineBlockInputSchema,
  UpdateWeekTemplateInputSchema,
  UpdateSemesterInputSchema,
  UpdateTemplateInputSchema,
  UpdateTimeBlockInputSchema,
  UpdateWeeklyReviewInputSchema,
} from '@todo/shared';
import { errorHandler, notFound } from './middleware/errorHandler';
import type { SendPopup } from './popups';
import type { Repositories } from './repositories';
import { attachmentsRouter } from './routes/attachments';
import { backupRouter } from './routes/backup';
import { crudRouter } from './routes/crudRouter';
import { batchRouter } from './routes/batch';
import { settingsRouter } from './routes/settings';
import { soundtracksRouter } from './routes/soundtracks';
import { tasksRouter } from './routes/tasks';

/** Builds the Express app without starting it. `clientDir` serves the built app too; `sendPopup` makes "Send a test pop-up" work. */
export function createApp(repos: Repositories, options: { uploadsDir: string; clientDir?: string; sendPopup?: SendPopup }) {
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
  app.use('/api/events', batchRouter(repos.events, EventBatchInputSchema));
  app.use('/api/events', crudRouter(repos.events, { label: 'Event', create: CreateEventInputSchema, update: UpdateEventInputSchema }));
  app.use('/api/time-blocks', crudRouter(repos.timeBlocks, { label: 'Time block', create: CreateTimeBlockInputSchema, update: UpdateTimeBlockInputSchema }));
  app.use('/api/semesters', crudRouter(repos.semesters, { label: 'Semester', create: CreateSemesterInputSchema, update: UpdateSemesterInputSchema }));
  app.use('/api/courses', crudRouter(repos.courses, { label: 'Course', create: CreateCourseInputSchema, update: UpdateCourseInputSchema }));
  app.use('/api/applications', crudRouter(repos.applications, { label: 'Application', create: CreateApplicationInputSchema, update: UpdateApplicationInputSchema }));
  app.use('/api/templates', crudRouter(repos.templates, { label: 'Template', create: CreateTemplateInputSchema, update: UpdateTemplateInputSchema }));
  app.use('/api/focus-sessions', crudRouter(repos.focusSessions, { label: 'Focus session', create: CreateFocusSessionInputSchema, update: null }));
  app.use('/api/weekly-reviews', crudRouter(repos.weeklyReviews, { label: 'Weekly review', create: CreateWeeklyReviewInputSchema, update: UpdateWeeklyReviewInputSchema }));
  app.use('/api/week-templates', crudRouter(repos.weekTemplates, { label: 'Week template', create: CreateWeekTemplateInputSchema, update: UpdateWeekTemplateInputSchema }));
  app.use('/api/routine-blocks', batchRouter(repos.routineBlocks, RoutineBlockBatchInputSchema));
  app.use('/api/routine-blocks', crudRouter(repos.routineBlocks, { label: 'Routine block', create: CreateRoutineBlockInputSchema, update: UpdateRoutineBlockInputSchema }));
  app.use('/api/routine-overrides', crudRouter(repos.routineOverrides, { label: 'Routine change', create: CreateRoutineOverrideInputSchema, update: UpdateRoutineOverrideInputSchema }));
  app.use('/api/check-ins', crudRouter(repos.checkIns, { label: 'Check-in', create: CreateCheckInInputSchema, update: UpdateCheckInInputSchema }));
  app.use('/api/expense-categories', crudRouter(repos.expenseCategories, { label: 'Expense category', create: CreateExpenseCategoryInputSchema, update: UpdateExpenseCategoryInputSchema }));
  app.use('/api/expenses', crudRouter(repos.expenses, { label: 'Expense', create: CreateExpenseInputSchema, update: UpdateExpenseInputSchema }));
  app.use('/api/savings-goals', crudRouter(repos.savingsGoals, { label: 'Savings goal', create: CreateSavingsGoalInputSchema, update: UpdateSavingsGoalInputSchema }));
  app.use('/api/holdings', crudRouter(repos.holdings, { label: 'Holding', create: CreateHoldingInputSchema, update: UpdateHoldingInputSchema }));
  app.use('/api/money-moves', batchRouter(repos.moneyMoves, MoneyMoveBatchInputSchema));
  app.use('/api/money-moves', crudRouter(repos.moneyMoves, { label: 'Money move', create: CreateMoneyMoveInputSchema, update: null }));
  app.use('/api/soundtracks', soundtracksRouter(repos.settings));
  app.use('/api/attachments', attachmentsRouter(repos.attachments, options.uploadsDir));
  app.use('/api/settings', settingsRouter(repos.settings));
  app.use('/api/backup', backupRouter(repos.backup));

  app.post('/api/popups/test', (_req, res) => {
    if (!options.sendPopup) {
      res.status(409).json({ error: 'PopupsOff', message: 'Pop-ups are off in this server (start it with POPUPS=on).' });
      return;
    }
    options.sendPopup({ at: '', title: 'Planner pop-ups are working', body: 'This is what a start or stop pop-up looks like.', url: '/', keys: [] });
    res.status(204).end();
  });

  app.use('/api', notFound);
  if (options.clientDir) {
    const dir = options.clientDir;
    app.use(express.static(dir));
    // Any other page (no file extension) is the single-page app: it reads the address itself.
    app.use((req, res, next) => (req.method === 'GET' && !path.extname(req.path) ? res.sendFile('index.html', { root: dir }) : next()));
  }
  app.use(errorHandler);

  return app;
}
