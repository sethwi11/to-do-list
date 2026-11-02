import { Router } from 'express';
import { CreateCategoryInputSchema, UpdateCategoryInputSchema } from '@todo/shared';
import { validateBody } from '../middleware/validate';
import type { CategoryRepository } from '../repositories/TaskRepository';

export function categoriesRouter(categories: CategoryRepository): Router {
  const router = Router();
  const notFound = { error: 'NotFound', message: 'List not found' };

  router.get('/', async (_req, res) => {
    res.json(await categories.list());
  });

  // Duplicate names hit the UNIQUE constraint; errorHandler turns that into a 409.
  router.post('/', validateBody(CreateCategoryInputSchema), async (req, res) => {
    res.status(201).json(await categories.create(req.body));
  });

  router.patch<{ id: string }>('/:id', validateBody(UpdateCategoryInputSchema), async (req, res) => {
    const category = await categories.update(req.params.id, req.body);
    if (!category) {
      res.status(404).json(notFound);
      return;
    }
    res.json(category);
  });

  router.delete('/:id', async (req, res) => {
    if (!(await categories.delete(req.params.id))) {
      res.status(404).json(notFound);
      return;
    }
    res.status(204).end();
  });

  return router;
}
