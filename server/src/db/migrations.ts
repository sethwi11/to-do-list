import { randomUUID } from 'node:crypto';
import type { Db } from './connection';

/*
 * Versioned schema migrations.
 *
 * SQLite stores a free integer in its header (`PRAGMA user_version`); we use
 * it to record how many migrations have run. On startup we run only the ones
 * after that number, each in a transaction. To change the schema later you
 * APPEND a new migration and never edit an old one, so an existing database
 * upgrades in place instead of being wiped.
 */
type Migration = (db: Db) => void;

const migrations: Migration[] = [
  // v1: categories + tasks
  (db) => {
    db.exec(`
      CREATE TABLE categories (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
        color       TEXT NOT NULL,
        sort_order  REAL NOT NULL,
        created_at  TEXT NOT NULL
      );

      CREATE TABLE tasks (
        id                 TEXT PRIMARY KEY,
        title              TEXT NOT NULL,
        notes              TEXT,
        due_date           TEXT,             -- 'YYYY-MM-DD' (local calendar date)
        due_time           TEXT,             -- 'HH:mm' (local wall-clock time)
        priority           TEXT NOT NULL CHECK (priority IN ('low','medium','high')),
        category_id        TEXT REFERENCES categories(id) ON DELETE SET NULL,
        status             TEXT NOT NULL CHECK (status IN ('todo','done')),
        subtasks           TEXT NOT NULL DEFAULT '[]',   -- JSON array
        recurrence         TEXT NOT NULL DEFAULT 'none',
        estimated_minutes  INTEGER,
        source             TEXT NOT NULL DEFAULT 'manual',
        source_snippet     TEXT,
        sort_order         REAL NOT NULL,
        created_at         TEXT NOT NULL,
        updated_at         TEXT NOT NULL,
        completed_at       TEXT,
        deleted_at         TEXT              -- soft delete, which makes undo possible
      );

      CREATE INDEX idx_tasks_due_date ON tasks(due_date) WHERE deleted_at IS NULL;
      CREATE INDEX idx_tasks_category ON tasks(category_id);
    `);

    const insert = db.prepare(
      'INSERT INTO categories (id, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?)',
    );
    const now = new Date().toISOString();
    const defaults = [
      ['School', 'blue'],
      ['Work', 'amber'],
      ['Personal', 'green'],
      ['Fraternity', 'purple'],
      ['ACM', 'teal'],
    ] as const;
    defaults.forEach(([name, color], i) => insert.run(randomUUID(), name, color, (i + 1) * 1024, now));
  },
];

export function runMigrations(db: Db): void {
  const current = db.pragma('user_version', { simple: true }) as number;

  for (let version = current; version < migrations.length; version++) {
    const migrate = migrations[version]!;
    db.transaction(() => {
      migrate(db);
      db.pragma(`user_version = ${version + 1}`);
    })();
  }
}
