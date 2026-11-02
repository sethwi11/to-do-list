import { z } from 'zod';
import { CategorySchema } from './category';
import { TaskSchema } from './task';

export const BACKUP_VERSION = 1;

/** The JSON file format for export/import. Versioned so a future format can still read old files. */
export const BackupSchema = z.object({
  app: z.literal('voice-todo'),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.iso.datetime(),
  categories: z.array(CategorySchema),
  tasks: z.array(TaskSchema),
});

export type Backup = z.infer<typeof BackupSchema>;
