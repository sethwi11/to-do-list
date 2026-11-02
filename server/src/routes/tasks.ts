import { Router } from 'express';
import { z } from 'zod';
import { CreateTaskInputSchema, UpdateTaskInputSchema } from '@todo/shared';
import { requestContext } from '../middleware/clientContext';
import { validateBody } from '../middleware/validate';
import type { TaskRepository } from '../repositories/TaskRepository';

const ReorderSchema = z.object({ ids: z.array(z.uuid()).min(1).max(5000) });

/*
 * Routes are created by functions that take their repository as an argument
 * (dependency injection). Production passes the SQLite repo, and tests can
 * pass one backed by an in-memory database.
 */
export function tasksRouter(tasks: TaskRepository): Router {
  const router = Router();
  const notFound = { error: 'NotFound', message: 'Task not found' };

  router.get('/', async (_req, res) => {
    res.json(await tasks.list());
  });

  router.get('/:id', async (req, res) => {
    const task = await tasks.get(req.params.id);
    if (!task) {
      res.status(404).json(notFound);
      return;
    }
    res.json(task);
  });

  router.post('/', validateBody(CreateTaskInputSchema), async (req, res) => {
    res.status(201).json(await tasks.create(req.body));
  });

  // Registered before '/:id' routes that use POST, so "reorder" isn't read as an id.
  router.post('/reorder', validateBody(ReorderSchema), async (req, res) => {
    await tasks.reorder(req.body.ids);
    res.status(204).end();
  });

  router.patch<{ id: string }>('/:id', validateBody(UpdateTaskInputSchema), async (req, res) => {
    const task = await tasks.update(req.params.id, req.body, requestContext(req));
    if (!task) {
      res.status(404).json(notFound);
      return;
    }
    res.json(task);
  });

  router.delete('/:id', async (req, res) => {
    if (!(await tasks.delete(req.params.id))) {
      res.status(404).json(notFound);
      return;
    }
    res.status(204).end();
  });

  // Undo for delete. A separate action rather than a PATCH, because a deleted
  // task isn't visible to the normal endpoints.
  router.post('/:id/restore', async (req, res) => {
    const task = await tasks.restore(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'NotFound', message: 'No deleted task with that id' });
      return;
    }
    res.json(task);
  });

  return router;
}
