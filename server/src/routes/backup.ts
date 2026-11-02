import { Router } from 'express';
import { BackupSchema } from '@todo/shared';
import { validateBody } from '../middleware/validate';
import type { BackupRepository } from '../repositories/BackupRepository';

export function backupRouter(backup: BackupRepository): Router {
  const router = Router();

  router.get('/export', async (_req, res) => {
    const data = await backup.export();
    const stamp = data.exportedAt.slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="voice-todo-${stamp}.json"`);
    res.json(data);
  });

  router.post('/import', validateBody(BackupSchema), async (req, res) => {
    res.json(await backup.import(req.body));
  });

  return router;
}
