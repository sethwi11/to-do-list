import express from 'express';
import type { AiService } from './ai/AiService';
import type { BackupRepository } from './repositories/BackupRepository';
import { aiRouter } from './routes/ai';
import { backupRouter } from './routes/backup';
import { errorHandler, notFound } from './middleware/errorHandler';
import type { CategoryRepository, TaskRepository } from './repositories/TaskRepository';
import { categoriesRouter } from './routes/categories';
import { tasksRouter } from './routes/tasks';

export interface AppDeps {
  tasks: TaskRepository;
  categories: CategoryRepository;
  backup: BackupRepository;
  /** null when no API key is configured; AI routes then answer 503 with setup instructions. */
  ai: AiService | null;
}

/**
 * Builds the Express app without starting it. Keeping "build" separate from
 * "listen" lets tests drive the app in-process with supertest (no real port,
 * no real database file).
 */
export function createApp(deps: AppDeps) {
  const app = express();

  // 5 MB, so a JSON backup import fits; normal requests are tiny.
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/api/tasks', tasksRouter(deps.tasks));
  app.use('/api/categories', categoriesRouter(deps.categories));
  app.use('/api/ai', aiRouter(deps.ai));
  app.use('/api/backup', backupRouter(deps.backup));

  app.use('/api', notFound);
  app.use(errorHandler);

  return app;
}
