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
  // v1: categories + tasks (the to-do app's original tables; renamed by v3)
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

  // v2: link a completed recurring task to the occurrence its completion created
  (db) => {
    db.exec(`
      ALTER TABLE tasks ADD COLUMN next_occurrence_id TEXT;
      CREATE INDEX idx_tasks_deleted_at ON tasks(deleted_at) WHERE deleted_at IS NOT NULL;
    `);
  },

  // v3: the planner. Lists become calendars; new tables for events, courses,
  // applications, templates, focus sessions, reviews, settings, attachments.
  //
  // Your existing rows are renamed and extended in place, never copied or
  // recreated, so every task keeps its id, subtasks, and recurrence links.
  (db) => {
    // Everything this migration needs is written out here on purpose: a
    // migration is a snapshot in time, so it must not depend on code that may
    // change later (like the shared color palette).
    db.exec(`
      CREATE TABLE event_types (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
        sort_order  REAL NOT NULL
      );

      CREATE TABLE semesters (
        id               TEXT PRIMARY KEY,
        name             TEXT NOT NULL,
        start_date       TEXT NOT NULL,
        end_date         TEXT NOT NULL,
        excluded_ranges  TEXT NOT NULL DEFAULT '[]',   -- JSON: [{start, end, label}]
        archived         INTEGER NOT NULL DEFAULT 0,
        created_at       TEXT NOT NULL
      );

      CREATE TABLE courses (
        id           TEXT PRIMARY KEY,
        semester_id  TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        code         TEXT,
        color        TEXT NOT NULL,
        calendar_id  TEXT REFERENCES categories(id) ON DELETE SET NULL,
        meeting_days TEXT NOT NULL,                    -- JSON: [2, 4] (0 = Sunday)
        start_time   TEXT NOT NULL,
        end_time     TEXT NOT NULL,
        location     TEXT,
        instructor   TEXT,
        notes        TEXT,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL
      );
      CREATE INDEX idx_courses_semester ON courses(semester_id);

      CREATE TABLE applications (
        id             TEXT PRIMARY KEY,
        company        TEXT NOT NULL,
        role           TEXT NOT NULL,
        location       TEXT,
        job_link       TEXT,
        status         TEXT NOT NULL DEFAULT 'Wishlist' CHECK (status IN
                         ('Wishlist','Applied','Online Assessment','Interviewing','Offer','Rejected','Withdrawn')),
        date_applied   TEXT,
        deadline       TEXT,
        contact_name   TEXT,
        contact_email  TEXT,
        notes          TEXT,
        sort_order     REAL NOT NULL,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL
      );
      CREATE INDEX idx_applications_status ON applications(status);

      CREATE TABLE application_status_history (
        application_id  TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        status          TEXT NOT NULL,
        changed_at      TEXT NOT NULL
      );
      CREATE INDEX idx_status_history_app ON application_status_history(application_id);

      CREATE TABLE events (
        id                  TEXT PRIMARY KEY,
        title               TEXT NOT NULL,
        start_at            TEXT NOT NULL,            -- 'YYYY-MM-DDTHH:mm', local time, no timezone
        end_at              TEXT NOT NULL,            -- exclusive for all-day events
        all_day             INTEGER NOT NULL DEFAULT 0,
        calendar_id         TEXT REFERENCES categories(id) ON DELETE SET NULL,
        type_id             TEXT REFERENCES event_types(id) ON DELETE SET NULL,
        location            TEXT,
        link                TEXT,
        notes               TEXT,
        color               TEXT,
        reminder_minutes    INTEGER,
        recurrence          TEXT,                     -- JSON rule; set on a series row
        recurring_event_id  TEXT REFERENCES events(id) ON DELETE CASCADE,  -- set on a one-off override
        original_start      TEXT,
        course_id           TEXT REFERENCES courses(id) ON DELETE SET NULL,
        application_id      TEXT REFERENCES applications(id) ON DELETE SET NULL,
        source              TEXT NOT NULL DEFAULT 'manual',
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL,
        deleted_at          TEXT                      -- soft delete, so undo works
      );
      CREATE INDEX idx_events_start ON events(start_at) WHERE deleted_at IS NULL;
      CREATE INDEX idx_events_calendar ON events(calendar_id);
      CREATE INDEX idx_events_series ON events(recurring_event_id);

      CREATE TABLE time_blocks (
        id          TEXT PRIMARY KEY,
        task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        start_at    TEXT NOT NULL,
        end_at      TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        deleted_at  TEXT
      );
      CREATE INDEX idx_time_blocks_start ON time_blocks(start_at) WHERE deleted_at IS NULL;
      CREATE INDEX idx_time_blocks_task ON time_blocks(task_id);

      CREATE TABLE templates (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        items       TEXT NOT NULL DEFAULT '[]',       -- JSON: [{id, title, offsetDays}]
        built_in    INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE focus_sessions (
        id                TEXT PRIMARY KEY,
        task_id           TEXT REFERENCES tasks(id) ON DELETE SET NULL,
        started_at        TEXT NOT NULL,
        duration_seconds  INTEGER NOT NULL,
        created_at        TEXT NOT NULL
      );
      CREATE INDEX idx_focus_started ON focus_sessions(started_at);

      CREATE TABLE weekly_reviews (
        id          TEXT PRIMARY KEY,
        week_start  TEXT NOT NULL UNIQUE,
        notes       TEXT NOT NULL DEFAULT '',
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE settings (
        key    TEXT PRIMARY KEY,
        value  TEXT NOT NULL                          -- JSON
      );

      CREATE TABLE attachments (
        id          TEXT PRIMARY KEY,
        filename    TEXT NOT NULL,
        mime_type   TEXT NOT NULL,
        size        INTEGER NOT NULL,
        path        TEXT NOT NULL,
        created_at  TEXT NOT NULL
      );
      CREATE TABLE attachment_links (
        attachment_id  TEXT NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
        owner_type     TEXT NOT NULL,
        owner_id       TEXT NOT NULL,
        PRIMARY KEY (attachment_id, owner_type, owner_id)
      );
      CREATE INDEX idx_attachment_links_owner ON attachment_links(owner_type, owner_id);
    `);

    // The lists you already have become calendars. (The tables above still say
    // REFERENCES categories(id): SQLite rewrites those to "calendars" by itself
    // during the rename below, which is why nothing breaks.)
    db.exec(`
      ALTER TABLE categories RENAME TO calendars;
      ALTER TABLE tasks RENAME COLUMN category_id TO calendar_id;
      DROP INDEX idx_tasks_category;
      CREATE INDEX idx_tasks_calendar ON tasks(calendar_id);

      ALTER TABLE tasks ADD COLUMN course_id TEXT REFERENCES courses(id) ON DELETE SET NULL;
      ALTER TABLE tasks ADD COLUMN application_id TEXT REFERENCES applications(id) ON DELETE SET NULL;
      ALTER TABLE tasks ADD COLUMN reminders TEXT NOT NULL DEFAULT '[]';
    `);

    // Old Tailwind color names -> the new highlighter palette.
    const legacy: Record<string, string> = {
      slate: 'slate', red: 'tomato', orange: 'terracotta', amber: 'ochre', green: 'sage',
      teal: 'teal', blue: 'dusty-blue', indigo: 'dusty-blue', purple: 'plum', pink: 'crimson',
    };
    const palette = new Set(['dusty-blue', 'slate', 'tomato', 'sage', 'crimson', 'plum', 'ochre', 'teal', 'terracotta']);
    const rows = db.prepare('SELECT id, name, color FROM calendars ORDER BY sort_order').all() as {
      id: string; name: string; color: string;
    }[];

    // "Fraternity" is now "Kappa Alpha Psi" (unless a calendar by that name already exists).
    const hasKap = rows.some((r) => r.name.toLowerCase() === 'kappa alpha psi');
    if (!hasKap) db.prepare("UPDATE calendars SET name = 'Kappa Alpha Psi' WHERE name = 'Fraternity' COLLATE NOCASE").run();

    const defaults = [
      ['School', 'dusty-blue'], ['Work', 'slate'], ['Applications', 'tomato'],
      ['ACM', 'sage'], ['Kappa Alpha Psi', 'crimson'], ['Personal', 'plum'],
    ] as const;
    const now = new Date().toISOString();
    const find = db.prepare('SELECT id FROM calendars WHERE name = ? COLLATE NOCASE');
    const setDefault = db.prepare('UPDATE calendars SET color = ?, sort_order = ? WHERE id = ?');
    const insert = db.prepare('INSERT INTO calendars (id, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?)');
    const defaultIds = new Set<string>();
    defaults.forEach(([name, color], i) => {
      const existing = find.get(name) as { id: string } | undefined;
      const id = existing?.id ?? randomUUID();
      if (existing) setDefault.run(color, (i + 1) * 1024, id);
      else insert.run(id, name, color, (i + 1) * 1024, now);
      defaultIds.add(id);
    });

    // Calendars you made yourself keep their order, after the defaults, with palette colors.
    const setCustom = db.prepare('UPDATE calendars SET color = ?, sort_order = ? WHERE id = ?');
    rows
      .filter((r) => !defaultIds.has(r.id) && r.name.toLowerCase() !== 'fraternity')
      .forEach((r, i) => setCustom.run(palette.has(r.color) ? r.color : (legacy[r.color] ?? 'slate'), (defaults.length + i + 1) * 1024, r.id));

    // Starting data for the new editable lists.
    const insertType = db.prepare('INSERT INTO event_types (id, name, sort_order) VALUES (?, ?, ?)');
    ['Interview', 'Class', 'Exam', 'Assignment Deadline', 'School Event', 'Meeting', 'Org Event', 'Personal', 'Other']
      .forEach((name, i) => insertType.run(randomUUID(), name, (i + 1) * 1024));

    const insertTemplate = db.prepare(
      'INSERT INTO templates (id, name, items, built_in, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)',
    );
    const template = (name: string, items: [string, number][]) =>
      insertTemplate.run(
        randomUUID(), name,
        JSON.stringify(items.map(([title, offsetDays]) => ({ id: randomUUID(), title, offsetDays }))),
        now, now,
      );
    template('Interview prep', [
      ['Research the company', -3], ['Review the job description', -3], ['Update resume', -3],
      ['Prep 3 STAR stories', -2], ['Prep questions to ask', -2], ['Test camera and mic', -1], ['Send thank-you note', 1],
    ]);
    template('Exam prep', [
      ['Gather notes', -7], ['Make study guide', -5], ['Practice problems', -3], ['Review session', -2], ['Final review', -1],
    ]);
    template('Org event planning', [
      ['Book room', -14], ['Make flyer', -10], ['Post on socials', -7], ['Order food', -3], ['Set up', 0], ['Send recap', 1],
    ]);
  },

  // v4: the application tracker remembers when you answered its "time to follow up?" suggestion,
  // so a dismissed suggestion doesn't come back on the next visit. One nullable column; nothing existing changes.
  (db) => {
    db.exec(`ALTER TABLE applications ADD COLUMN follow_up_handled_at TEXT;`);
  },
];

/** How many migrations exist: the schema version a fully up-to-date database has. */
export const LATEST_VERSION = migrations.length;

export function currentVersion(db: Db): number {
  return db.pragma('user_version', { simple: true }) as number;
}

/** Runs every migration the database hasn't seen yet (`upTo` is only for tests that need an older schema). */
export function runMigrations(db: Db, upTo: number = migrations.length): void {
  for (let version = currentVersion(db); version < upTo; version++) {
    const migrate = migrations[version]!;
    db.transaction(() => {
      migrate(db);
      db.pragma(`user_version = ${version + 1}`);
    })();
  }
}
