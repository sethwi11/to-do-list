import { Router } from 'express';
import { z } from 'zod';
import { BackupSchema, upgradeBackup } from '@todo/shared';
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

  // Files exported by the original to-do app (version 1) are upgraded to the current format first.
  router.post('/import', validateBody(z.preprocess(upgradeBackup, BackupSchema)), async (req, res) => {
    res.json(await backup.import(req.body));
  });

  return router;
}
