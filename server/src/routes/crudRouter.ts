import { Router } from 'express';
import type { z } from 'zod';
import { validateBody } from '../middleware/validate';
import type { CrudRepository, RestorableRepository } from '../repositories/types';

interface CrudRouterOptions {
  /** Used in "X not found" messages. */
  label: string;
  create: z.ZodType;
  /** null = rows can't be edited (e.g. finished focus sessions). */
  update: z.ZodType | null;
}

/**
 * The same five endpoints for every table, from one function:
 *
 *   GET    /        list           POST   /          create (201)
 *   GET    /:id     one            PATCH  /:id       change some fields
 *   DELETE /:id     delete (204)   POST   /:id/restore   undo a delete (only if the repository supports it)
 *
 * Every body is validated by zod before it reaches the repository, which then
 * only ever sees clean, known fields.
 */
export function crudRouter<T, C, U>(
  repo: CrudRepository<T, C, U> & Partial<Pick<RestorableRepository<T, C, U>, 'restore'>>,
  { label, create, update }: CrudRouterOptions,
): Router {
  const router = Router();
  const notFound = { error: 'NotFound', message: `${label} not found` };

  router.get('/', async (_req, res) => {
    res.json(await repo.list());
  });

  router.get('/:id', async (req, res) => {
    const row = await repo.get(req.params.id);
    if (!row) {
      res.status(404).json(notFound);
      return;
    }
    res.json(row);
  });

  router.post('/', validateBody(create), async (req, res) => {
    res.status(201).json(await repo.create(req.body));
  });

  if (update) {
    router.patch<{ id: string }>('/:id', validateBody(update), async (req, res) => {
      const row = await repo.update(req.params.id, req.body);
      if (!row) {
        res.status(404).json(notFound);
        return;
      }
      res.json(row);
    });
  }

  router.delete('/:id', async (req, res) => {
    if (!(await repo.delete(req.params.id))) {
      res.status(404).json(notFound);
      return;
    }
    res.status(204).end();
  });

  const restore = repo.restore?.bind(repo);
  if (restore) {
    router.post('/:id/restore', async (req, res) => {
      const row = await restore(req.params.id);
      if (!row) {
        res.status(404).json({ error: 'NotFound', message: `No deleted ${label.toLowerCase()} with that id` });
        return;
      }
      res.json(row);
    });
  }

  return router;
}
