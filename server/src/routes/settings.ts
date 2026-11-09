import { Router } from 'express';
import { isStageUnlocked, localDateOf, stageTwoDate, UpdateSettingsInputSchema } from '@todo/shared';
import { HttpError } from '../errors';
import { validateBody } from '../middleware/validate';
import type { SettingsRepository } from '../repositories/SqliteSettingsRepository';

/** One settings document: GET it, PATCH the parts you want to change. */
export function settingsRouter(settings: SettingsRepository): Router {
  const router = Router();
  router.get('/', async (_req, res) => {
    res.json(await settings.get());
  });
  router.patch('/', validateBody(UpdateSettingsInputSchema), async (req, res) => {
    const notes = req.body.path?.stage2Notes;
    if (notes !== undefined) {
      // Judged by the birthday already saved, so the same request can't unlock it.
      const { path } = await settings.get();
      if (notes !== path.stage2Notes && !isStageUnlocked(path.birthday, localDateOf(new Date().toISOString()))) {
        const opens = stageTwoDate(path.birthday);
        throw new HttpError(400, opens ? `Stage 2 stays locked until ${opens}` : 'Stage 2 stays locked until you set your birthday');
      }
    }
    res.json(await settings.update(req.body));
  });
  return router;
}
