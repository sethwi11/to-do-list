import { createApp } from './app';
import { openDatabase } from './db/connection';
import { env } from './env';
import { SqliteCategoryRepository, SqliteTaskRepository } from './repositories/SqliteTaskRepository';

const db = openDatabase(env.DB_PATH);

const app = createApp({
  tasks: new SqliteTaskRepository(db),
  categories: new SqliteCategoryRepository(db),
});

// Bind to localhost only: there's no auth, so nothing else on the network should reach this.
app.listen(env.API_PORT, '127.0.0.1', () => {
  console.log(`API listening on http://127.0.0.1:${env.API_PORT}  (db: ${env.DB_PATH})`);
});

// No custom SIGINT/SIGTERM handler: SQLite in WAL mode is crash-safe (an
// interrupted write is rolled back on next open), so letting the process die
// immediately is fine, and it lets `tsx watch` restart instantly.
