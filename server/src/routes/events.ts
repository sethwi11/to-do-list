import { Router } from 'express';
import { EventBatchInputSchema } from '@todo/shared';
import { validateBody } from '../middleware/validate';
import type { Repositories } from '../repositories';

/**
 * POST /api/events/batch: write several events and delete others in one transaction.
 * (The ordinary one-event endpoints are the generic CRUD router's.)
 */
export function eventsBatchRouter(events: Repositories['events']): Router {
  const router = Router();
  router.post('/batch', validateBody(EventBatchInputSchema), async (req, res) => {
    res.json(await events.applyBatch(req.body));
  });
  return router;
}
