import { createApp } from '../src/app';
import { openDatabase, type Db } from '../src/db/connection';
import { createRepositories } from '../src/repositories';

/** A fully wired app on a fresh in-memory database, with the seeded defaults. */
export function makeTestApp() {
  return makeTestAppWithDb().app;
}

export function makeTestAppWithDb(): { app: ReturnType<typeof createApp>; db: Db } {
  const db = openDatabase(':memory:');
  return { app: createApp(createRepositories(db)), db };
}
