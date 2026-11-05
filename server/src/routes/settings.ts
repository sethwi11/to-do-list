import { Router } from 'express';
import { UpdateSettingsInputSchema } from '@todo/shared';
import { validateBody } from '../middleware/validate';
import type { SettingsRepository } from '../repositories/SqliteSettingsRepository';

/** One settings document: GET it, PATCH the parts you want to change. */
export function settingsRouter(settings: SettingsRepository): Router {
  const router = Router();
  router.get('/', async (_req, res) => {
    res.json(await settings.get());
  });
  router.patch('/', validateBody(UpdateSettingsInputSchema), async (req, res) => {
    res.json(await settings.update(req.body));
  });
  return router;
}
