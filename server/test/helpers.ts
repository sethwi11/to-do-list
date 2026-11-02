import type { AiService } from '../src/ai/AiService';
import { createApp } from '../src/app';
import { openDatabase } from '../src/db/connection';
import { BackupRepository } from '../src/repositories/BackupRepository';
import { SqliteCategoryRepository } from '../src/repositories/SqliteCategoryRepository';
import { SqliteTaskRepository } from '../src/repositories/SqliteTaskRepository';

/** A fully wired app on a fresh in-memory database. */
export function makeTestApp(ai: AiService | null = null) {
  const db = openDatabase(':memory:');
  const tasks = new SqliteTaskRepository(db);
  const categories = new SqliteCategoryRepository(db);
  return createApp({ tasks, categories, backup: new BackupRepository(db, tasks, categories), ai });
}
