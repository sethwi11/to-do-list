import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app';
import { openDatabase, type Db } from '../src/db/connection';
import { createRepositories } from '../src/repositories';

/** A fully wired app on a fresh in-memory database, with the seeded defaults. */
export function makeTestApp() {
  return makeTestAppWithDb().app;
}

export function makeTestAppWithDb(): { app: ReturnType<typeof createApp>; db: Db; uploadsDir: string } {
  const db = openDatabase(':memory:');
  // Each test app gets its own temporary uploads folder, so tests never touch real files.
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-uploads-'));
  return { app: createApp(createRepositories(db), { uploadsDir }), db, uploadsDir };
}
