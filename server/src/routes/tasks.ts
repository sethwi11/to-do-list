import { Router } from 'express';
import { CreateTaskInputSchema, UpdateTaskInputSchema } from '@todo/shared';
import { validateBody } from '../middleware/validate';
import type { CategoryRepository, TaskRepository } from '../repositories/TaskRepository';

/*
 * Routes are created by functions that take their repository as an argument
 * (dependency injection). Production passes the SQLite repo, and tests can
 * pass one backed by an in-memory database.
 */
export function tasksRouter(tasks: TaskRepository): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await tasks.list());
  });

  router.get('/:id', async (req, res) => {
    const task = await tasks.get(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'NotFound', message: 'Task not found' });
      return;
    }
    res.json(task);
  });

  router.post('/', validateBody(CreateTaskInputSchema), async (req, res) => {
    res.status(201).json(await tasks.create(req.body));
  });

  router.patch<{ id: string }>('/:id', validateBody(UpdateTaskInputSchema), async (req, res) => {
    const task = await tasks.update(req.params.id, req.body);
    if (!task) {
      res.status(404).json({ error: 'NotFound', message: 'Task not found' });
      return;
    }
    res.json(task);
  });

  router.delete('/:id', async (req, res) => {
    const deleted = await tasks.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'NotFound', message: 'Task not found' });
      return;
    }
    res.status(204).end();
  });

  return router;
}

export function categoriesRouter(categories: CategoryRepository): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await categories.list());
  });

  return router;
}
