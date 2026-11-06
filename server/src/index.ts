import { createApp } from './app';
import { openDatabase } from './db/connection';
import { env } from './env';
import { createRepositories } from './repositories';

// Opening the database also upgrades its schema (after backing it up first).
const db = openDatabase(env.DB_PATH);
const repos = createRepositories(db);
const app = createApp(repos, { uploadsDir: env.UPLOADS_DIR });

// Soft-deleted tasks only need to live long enough to be undone. Clear out
// anything deleted more than 30 days ago on each startup.
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const purged = await repos.tasks.purgeDeleted(new Date(Date.now() - THIRTY_DAYS_MS).toISOString());
if (purged > 0) console.log(`Purged ${purged} task(s) deleted more than 30 days ago`);

// Bind to localhost only: there's no auth, so nothing else on the network should reach this.
app.listen(env.API_PORT, '127.0.0.1', () => {
  console.log(`API listening on http://127.0.0.1:${env.API_PORT}  (db: ${env.DB_PATH})`);
});

// No custom SIGINT/SIGTERM handler: SQLite in WAL mode is crash-safe (an
// interrupted write is rolled back on next open), so letting the process die
// immediately is fine, and it lets `tsx watch` restart instantly.
