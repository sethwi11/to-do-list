import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { runMigrations } from './migrations';

export type Db = Database.Database;

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

  runMigrations(db);
  return db;
}
