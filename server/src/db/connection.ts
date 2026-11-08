import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { currentVersion, LATEST_VERSION, runMigrations } from './migrations';

export type Db = Database.Database;

const KEEP_BACKUPS = 10;

/** Before the schema changes, save a full copy of the database next to it. */
export function backupBeforeMigrating(db: Db, filename: string): string | null {
  const version = currentVersion(db);
  if (filename === ':memory:' || version === 0 || version >= LATEST_VERSION) return null; // new, or already current

  const dir = path.join(path.dirname(filename), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(dir, `todo-v${version}-${stamp}.db`);
  db.prepare('VACUUM INTO ?').run(target);

  // Keep the newest few automatic backups so the folder doesn't grow forever.
  const old = fs.readdirSync(dir).filter((f) => /^todo-v\d+-.*\.db$/.test(f)).sort().slice(0, -KEEP_BACKUPS);
  for (const f of old) fs.rmSync(path.join(dir, f), { force: true });

  return target;
}

/** Open (or create) the SQLite database and bring its schema up to date. */
export function openDatabase(filename: string): Db {
  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }

  const db = new Database(filename);
  // WAL (write-ahead logging): readers don't block the writer, and a crash mid-write can't corrupt the database file.
  db.pragma('journal_mode = WAL');
  // SQLite ships with foreign-key enforcement OFF for backwards compatibility.
  db.pragma('foreign_keys = ON');

  const backup = backupBeforeMigrating(db, filename);
  if (backup) console.log(`Database upgrade needed. Backed up your data to ${backup}`);

  runMigrations(db);
  return db;
}
