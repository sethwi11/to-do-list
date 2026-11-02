import express from 'express';
import { errorHandler, notFound } from './middleware/errorHandler';
import type { CategoryRepository, TaskRepository } from './repositories/TaskRepository';
import { categoriesRouter } from './routes/categories';
import { tasksRouter } from './routes/tasks';

export interface AppDeps {
  tasks: TaskRepository;
  categories: CategoryRepository;
}

/**
 * Builds the Express app without starting it. Keeping "build" separate from
 * "listen" lets tests drive the app in-process with supertest (no real port,
 * no real database file).
 */
export function createApp(deps: AppDeps) {
  const app = express();

  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/api/tasks', tasksRouter(deps.tasks));
  app.use('/api/categories', categoriesRouter(deps.categories));

  app.use('/api', notFound);
  app.use(errorHandler);

  return app;
}
