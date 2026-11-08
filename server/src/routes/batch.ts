import { Router } from 'express';
import type { z } from 'zod';
import { validateBody } from '../middleware/validate';

/** POST /batch: write several rows and delete others in one transaction (events, routine blocks). */
export function batchRouter<T>(repo: { applyBatch(batch: { put: T[]; remove: string[] }): Promise<unknown> }, schema: z.ZodType): Router {
  const router = Router();
  router.post('/batch', validateBody(schema), async (req, res) => {
    res.json(await repo.applyBatch(req.body));
  });
  return router;
}
