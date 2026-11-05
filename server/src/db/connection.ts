import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { currentVersion, LATEST_VERSION, runMigrations } from './migrations';

export type Db = Database.Database;

const KEEP_BACKUPS = 10;

/**
 * Before the schema changes, save a full copy of the database next to it.
 * A migration is the one moment code can damage existing data, so it gets a
 * safety net: if anything ever looks wrong afterwards, the copy in
 * data/backups/ is your data exactly as it was.
 *
 * VACUUM INTO writes a consistent snapshot even while the database is in use.
 * Returns the backup's path, or null when there was nothing to protect.
 */
export function backupBeforeMigrating(db: Db, filename: string): string | null {
  const version = currentVersion(db);
  if (filename === ':memory:' || version === 0 || version >= LATEST_VERSION) return null; // new, or already current

  const dir = path.join(path.dirname(filename), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(dir, `todo-v${version}-${stamp}.db`);
  db.prepare('VACUUM INTO ?').run(target);

  // Keep the newest few automatic backups so the folder doesn't grow forever.
  // (Only files this function made: anything you put there yourself is left alone.)
  const old = fs.readdirSync(dir).filter((f) => /^todo-v\d+-.*\.db$/.test(f)).sort().slice(0, -KEEP_BACKUPS);
  for (const f of old) fs.rmSync(path.join(dir, f), { force: true });

  return target;
}

/**
 * Open (or create) the SQLite database and bring its schema up to date.
 * Pass ':memory:' for a throwaway database, which is what the tests use.
 */
export function openDatabase(filename: string): Db {
  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }

  const db = new Database(filename);
  // WAL (write-ahead logging): readers don't block the writer, and a crash
  // mid-write can't corrupt the database file.
  db.pragma('journal_mode = WAL');
  // SQLite ships with foreign-key enforcement OFF for backwards compatibility.
  db.pragma('foreign_keys = ON');

  const backup = backupBeforeMigrating(db, filename);
  if (backup) console.log(`Database upgrade needed. Backed up your data to ${backup}`);

  runMigrations(db);
  return db;
}
