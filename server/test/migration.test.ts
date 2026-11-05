import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../src/db/connection';
import { LATEST_VERSION, runMigrations } from '../src/db/migrations';

/*
 * The most important tests in the project: they prove that upgrading an
 * existing database keeps every task. They build a database exactly as the
 * to-do app (schema version 2) left it, fill it with realistic data, upgrade it,
 * and compare.
 */

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
const tempDir = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-migration-'));
  dirs.push(d);
  return d;
};

/** A version-2 database with real-looking data, including a custom list, a recurring task, and a soft-deleted task. */
function makeOldDatabase(file: string) {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db, 2);

  const cats = db.prepare('SELECT id, name FROM categories').all() as { id: string; name: string }[];
  const cat = (name: string) => cats.find((c) => c.name === name)!.id;
  db.prepare("INSERT INTO categories (id, name, color, sort_order, created_at) VALUES ('custom-1', 'Gym', 'pink', 6144, '2026-11-03T00:00:00.000Z')").run();

  const insert = db.prepare(`INSERT INTO tasks (id, title, notes, due_date, due_time, priority, category_id, status, subtasks,
    recurrence, estimated_minutes, source, source_snippet, sort_order, created_at, updated_at, completed_at, next_occurrence_id, deleted_at)
    VALUES (@id, @title, @notes, @due_date, @due_time, @priority, @category_id, @status, @subtasks, @recurrence, @estimated_minutes,
    'manual', NULL, @sort_order, '2026-11-02T10:00:00.000Z', '2026-11-02T10:00:00.000Z', @completed_at, @next, @deleted_at)`);
  const base = { notes: null, due_date: null, due_time: null, priority: 'medium', category_id: null, status: 'todo', subtasks: '[]', recurrence: 'none', estimated_minutes: null, completed_at: null, next: null, deleted_at: null };
  insert.run({ ...base, id: 't1', title: 'Finish COMP 365 lab', due_date: '2026-11-06', priority: 'high', category_id: cat('School'), subtasks: JSON.stringify([{ id: 'a', title: 'Part 1', done: true }]), estimated_minutes: 90, sort_order: 1024 });
  insert.run({ ...base, id: 't2', title: 'ACM meeting', due_date: '2026-11-05', due_time: '18:00', category_id: cat('ACM'), sort_order: 2048 });
  insert.run({ ...base, id: 't3', title: 'Chapter dues', category_id: cat('Fraternity'), sort_order: 3072 });
  insert.run({ ...base, id: 't4', title: 'Gym', recurrence: 'weekdays', category_id: 'custom-1', sort_order: 4096, next: 't5' });
  insert.run({ ...base, id: 't5', title: 'Gym', recurrence: 'weekdays', due_date: '2026-11-05', category_id: 'custom-1', sort_order: 5120 });
  insert.run({ ...base, id: 't6', title: 'Read chapter 4', status: 'done', completed_at: '2026-11-03T12:00:00.000Z', sort_order: 6144 });
  insert.run({ ...base, id: 't7', title: 'Deleted but undoable', deleted_at: '2026-11-03T13:00:00.000Z', sort_order: 7168 });
  return db;
}

const taskSnapshot = (db: Database.Database, calendarColumn: string) =>
  db
    .prepare(`SELECT id, title, notes, due_date, due_time, priority, ${calendarColumn} AS calendar, status, subtasks, recurrence,
      estimated_minutes, sort_order, completed_at, next_occurrence_id, deleted_at FROM tasks ORDER BY id`)
    .all();

describe('upgrading an existing to-do database', () => {
  it('keeps every task exactly as it was, including the deleted one and the recurrence link', () => {
    const db = makeOldDatabase(path.join(tempDir(), 'todo.db'));
    const before = taskSnapshot(db, 'category_id');
    runMigrations(db);
    expect(db.pragma('user_version', { simple: true })).toBe(LATEST_VERSION);
    expect(taskSnapshot(db, 'calendar_id')).toEqual(before);
    expect(before).toHaveLength(7);
  });

  it('turns lists into calendars: Fraternity becomes Kappa Alpha Psi, Applications is added, colors move to the palette', () => {
    const db = makeOldDatabase(path.join(tempDir(), 'todo.db'));
    runMigrations(db);
    const rows = db.prepare('SELECT name, color FROM calendars ORDER BY sort_order').all();
    expect(rows).toEqual([
      { name: 'School', color: 'dusty-blue' },
      { name: 'Work', color: 'slate' },
      { name: 'Applications', color: 'tomato' },
      { name: 'ACM', color: 'sage' },
      { name: 'Kappa Alpha Psi', color: 'crimson' },
      { name: 'Personal', color: 'plum' },
      { name: 'Gym', color: 'crimson' }, // your own calendar: kept, after the defaults, 'pink' translated
    ]);
    // Tasks that were in "Fraternity" are now in "Kappa Alpha Psi", with the same calendar id.
    const t3 = db.prepare('SELECT c.name FROM tasks t JOIN calendars c ON c.id = t.calendar_id WHERE t.id = ?').get('t3') as { name: string };
    expect(t3.name).toBe('Kappa Alpha Psi');
  });

  it('leaves the database consistent: foreign keys rewritten, nothing dangling, new tables seeded', () => {
    const db = makeOldDatabase(path.join(tempDir(), 'todo.db'));
    runMigrations(db);
    expect(db.pragma('foreign_key_check')).toEqual([]);
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
    const fks = db.prepare("SELECT \"table\" AS t FROM pragma_foreign_key_list('tasks')").all() as { t: string }[];
    expect(fks.map((f) => f.t)).toContain('calendars'); // the old "categories" reference was rewritten
    expect(fks.map((f) => f.t)).not.toContain('categories');
    expect((db.prepare('SELECT COUNT(*) n FROM event_types').get() as { n: number }).n).toBe(9);
    expect((db.prepare('SELECT COUNT(*) n FROM templates WHERE built_in = 1').get() as { n: number }).n).toBe(3);
    expect(db.prepare('SELECT reminders, course_id, application_id FROM tasks WHERE id = ?').get('t1')).toEqual({ reminders: '[]', course_id: null, application_id: null });
  });

  it('does not create a second "Kappa Alpha Psi" if the user already made one, and does not touch other names', () => {
    const db = makeOldDatabase(path.join(tempDir(), 'todo.db'));
    db.prepare("INSERT INTO categories (id, name, color, sort_order, created_at) VALUES ('kap', 'Kappa Alpha Psi', 'red', 9000, '2026-11-03T00:00:00.000Z')").run();
    runMigrations(db);
    const names = (db.prepare('SELECT name FROM calendars').all() as { name: string }[]).map((r) => r.name.toLowerCase());
    expect(names.filter((n) => n === 'kappa alpha psi')).toHaveLength(1);
    expect(names).toContain('fraternity'); // couldn't be renamed (the name was taken), so it is left alone
  });

  it('a brand new database runs the same migrations and ends with the same defaults', () => {
    const db = openDatabase(':memory:');
    expect(db.pragma('user_version', { simple: true })).toBe(LATEST_VERSION);
    expect((db.prepare('SELECT COUNT(*) n FROM calendars').get() as { n: number }).n).toBe(6);
  });
});

describe('automatic backup before upgrading', () => {
  it('saves a readable copy of the old database before touching it', () => {
    const dir = tempDir();
    const file = path.join(dir, 'todo.db');
    const old = makeOldDatabase(file);
    old.close();

    const db = openDatabase(file); // upgrades v2 -> latest
    db.close();

    const backups = fs.readdirSync(path.join(dir, 'backups'));
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(/^todo-v2-.*\.db$/);

    // The backup is the *old* schema with all the old data.
    const backup = new Database(path.join(dir, 'backups', backups[0]!), { readonly: true });
    expect(backup.pragma('user_version', { simple: true })).toBe(2);
    expect((backup.prepare('SELECT COUNT(*) n FROM tasks').get() as { n: number }).n).toBe(7);
    expect(backup.prepare("SELECT name FROM categories WHERE name = 'Fraternity'").get()).toBeDefined();
    backup.close();
  });

  it('makes no backup for a new database or one that is already up to date', () => {
    const dir = tempDir();
    const file = path.join(dir, 'todo.db');
    openDatabase(file).close(); // brand new
    openDatabase(file).close(); // already current
    expect(fs.existsSync(path.join(dir, 'backups'))).toBe(false);
  });
});
