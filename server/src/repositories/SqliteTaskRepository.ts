import { randomUUID } from 'node:crypto';
import { nextOccurrence, rollTarget, type CreateTaskInput, type Task, type UpdateTaskInput } from '@todo/shared';
import type { Db } from '../db/connection';
import type { RequestContext, TaskRepository } from './TaskRepository';

/** Shape of a row in the `tasks` table (snake_case, JSON stored as text). */
interface TaskRow {
  id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: Task['priority'];
  calendar_id: string | null;
  course_id: string | null;
  application_id: string | null;
  reminders: string;
  status: Task['status'];
  subtasks: string;
  recurrence: Task['recurrence'];
  estimated_minutes: number | null;
  source: Task['source'];
  source_snippet: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  next_occurrence_id: string | null;
  rolls_over: number;
  repeat_days: string;
  missed_at: string | null;
}

// Gap between sortOrder values.
export const SORT_GAP = 1024;

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    dueDate: row.due_date,
    dueTime: row.due_time,
    priority: row.priority,
    calendarId: row.calendar_id,
    courseId: row.course_id,
    applicationId: row.application_id,
    reminders: JSON.parse(row.reminders),
    status: row.status,
    subtasks: JSON.parse(row.subtasks),
    recurrence: row.recurrence,
    estimatedMinutes: row.estimated_minutes,
    source: row.source,
    sourceSnippet: row.source_snippet,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    nextOccurrenceId: row.next_occurrence_id,
    rollsOver: row.rolls_over === 1,
    repeatDays: JSON.parse(row.repeat_days),
    missedAt: row.missed_at,
  };
}

function taskToRow(task: Task): TaskRow {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    due_date: task.dueDate,
    due_time: task.dueTime,
    priority: task.priority,
    calendar_id: task.calendarId,
    course_id: task.courseId,
    application_id: task.applicationId,
    reminders: JSON.stringify(task.reminders),
    status: task.status,
    subtasks: JSON.stringify(task.subtasks),
    recurrence: task.recurrence,
    estimated_minutes: task.estimatedMinutes,
    source: task.source,
    source_snippet: task.sourceSnippet,
    sort_order: task.sortOrder,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    completed_at: task.completedAt,
    next_occurrence_id: task.nextOccurrenceId,
    rolls_over: task.rollsOver ? 1 : 0,
    repeat_days: JSON.stringify(task.repeatDays),
    missed_at: task.missedAt,
  };
}

// Column list derived from the mapper, so INSERT/UPDATE can't fall out of sync with it.
const COLUMNS = Object.keys(taskToRow({} as Task));

export class SqliteTaskRepository implements TaskRepository {
  // Prepared once, reused on every call: SQLite parses and plans each query only once.
  private readonly stmts;

  constructor(private readonly db: Db) {
    this.stmts = {
      list: db.prepare<[], TaskRow>('SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY sort_order'),
      get: db.prepare<[string], TaskRow>('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL'),
      getDeleted: db.prepare<[string], TaskRow>('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NOT NULL'),
      maxSort: db.prepare<[], { max: number | null }>('SELECT MAX(sort_order) AS max FROM tasks'),
      insert: db.prepare<TaskRow>(
        `INSERT INTO tasks (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map((c) => '@' + c).join(', ')})`,
      ),
      update: db.prepare<TaskRow>(
        `UPDATE tasks SET ${COLUMNS.filter((c) => c !== 'id' && c !== 'created_at')
          .map((c) => `${c} = @${c}`)
          .join(', ')} WHERE id = @id`,
      ),
      // Import: insert, or overwrite the task with the same id (and un-delete it).
      upsert: db.prepare<TaskRow>(
        `INSERT INTO tasks (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map((c) => '@' + c).join(', ')}) ` +
          `ON CONFLICT(id) DO UPDATE SET ${COLUMNS.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ')}, deleted_at = NULL`,
      ),
      exists: db.prepare<[string], { n: number }>('SELECT COUNT(*) AS n FROM tasks WHERE id = ?'),
      softDelete: db.prepare<[string, string]>('UPDATE tasks SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL'),
      restore: db.prepare<[string]>('UPDATE tasks SET deleted_at = NULL WHERE id = ?'),
      setSort: db.prepare<[number, string]>('UPDATE tasks SET sort_order = ? WHERE id = ?'),
      purge: db.prepare<[string]>('DELETE FROM tasks WHERE deleted_at IS NOT NULL AND deleted_at < ?'),
      rollCandidates: db.prepare<[string], TaskRow>(
        "SELECT * FROM tasks WHERE deleted_at IS NULL AND status = 'todo' AND missed_at IS NULL AND rolls_over = 1 AND recurrence != 'none' AND due_date < ?",
      ),
    };
  }

  async list(): Promise<Task[]> {
    return this.stmts.list.all().map(rowToTask);
  }

  async get(id: string): Promise<Task | null> {
    const row = this.stmts.get.get(id);
    return row ? rowToTask(row) : null;
  }

  async create(input: CreateTaskInput): Promise<Task> {
    // A client may choose the id (so a create made offline can be replayed safely).
    if (input.id) {
      const existing = this.stmts.get.get(input.id);
      if (existing) return rowToTask(existing);
    }
    return this.insert(input);
  }

  /** Import: insert or overwrite the task with this id. Returns true if it already existed. */
  upsertSync(task: Task): boolean {
    const existed = (this.stmts.exists.get(task.id)?.n ?? 0) > 0;
    this.stmts.upsert.run(taskToRow(task));
    return existed;
  }

  async update(id: string, changes: UpdateTaskInput, ctx: RequestContext): Promise<Task | null> {
    // Read-modify-write inside a transaction, so two concurrent PATCHes can't interleave, and creating/removing a recurrence is all-or-nothing.
    return this.db.transaction((): Task | null => {
      const row = this.stmts.get.get(id);
      if (!row) return null;
      const existing = rowToTask(row);

      // Drop keys explicitly set to undefined so they don't overwrite real values.
      const defined = Object.fromEntries(
        Object.entries(changes).filter(([, v]) => v !== undefined),
      ) as Partial<Task>;

      const now = new Date().toISOString();
      const next: Task = { ...existing, ...defined, id: existing.id, updatedAt: now };

      const completing = existing.status !== 'done' && next.status === 'done';
      const reopening = existing.status === 'done' && next.status === 'todo';

      // completedAt is derived from status transitions, never set directly.
      if (completing) next.completedAt = now;
      if (reopening) next.completedAt = null;

      if (completing && next.recurrence !== 'none') {
        next.nextOccurrenceId = this.spawn(next, nextOccurrence(next.dueDate, next.recurrence, ctx.today, next.repeatDays)).id;
      }

      if (reopening && existing.nextOccurrenceId) {
        // Remove the occurrence we created, unless you've already finished it.
        const spawned = this.stmts.get.get(existing.nextOccurrenceId);
        if (spawned && spawned.status === 'todo') this.stmts.softDelete.run(now, spawned.id);
        next.nextOccurrenceId = null;
      }

      this.stmts.update.run(taskToRow(next));
      return next;
    })();
  }

  /** Rolling tasks whose next occurrence has arrived: each is marked missed and the current occurrence takes its place. Returns how many rolled. */
  async rollOver(today: string): Promise<number> {
    return this.db.transaction(() => {
      let rolled = 0;
      for (const row of this.stmts.rollCandidates.all(today)) {
        const task = rowToTask(row);
        const due = rollTarget(task, today);
        if (!due) continue;
        const now = new Date().toISOString();
        this.stmts.update.run(taskToRow({ ...task, missedAt: now, nextOccurrenceId: this.spawn(task, due).id, updatedAt: now }));
        rolled++;
      }
      return rolled;
    })();
  }

  /** The next occurrence of a repeating task: same details, subtasks unticked. */
  private spawn(t: Task, dueDate: string | null): Task {
    return this.insert({
      title: t.title,
      notes: t.notes,
      dueDate,
      dueTime: t.dueTime,
      priority: t.priority,
      calendarId: t.calendarId,
      courseId: t.courseId,
      applicationId: t.applicationId,
      reminders: t.reminders,
      subtasks: t.subtasks.map((s) => ({ ...s, done: false })),
      recurrence: t.recurrence,
      rollsOver: t.rollsOver,
      repeatDays: t.repeatDays,
      estimatedMinutes: t.estimatedMinutes,
      source: t.source,
      sourceSnippet: t.sourceSnippet,
    });
  }

  async delete(id: string): Promise<boolean> {
    return this.stmts.softDelete.run(new Date().toISOString(), id).changes > 0;
  }

  async restore(id: string): Promise<Task | null> {
    const row = this.stmts.getDeleted.get(id);
    if (!row) return null;
    this.stmts.restore.run(id);
    return rowToTask(row);
  }

  async reorder(ids: string[]): Promise<void> {
    this.db.transaction(() => {
      ids.forEach((id, i) => this.stmts.setSort.run((i + 1) * SORT_GAP, id));
    })();
  }

  async purgeDeleted(before: string): Promise<number> {
    return this.stmts.purge.run(before).changes;
  }

  /** Synchronous insert, so it can run inside a transaction. */
  private insert(input: CreateTaskInput): Task {
    const now = new Date().toISOString();
    const maxSort = this.stmts.maxSort.get()?.max ?? 0;

    const task: Task = {
      id: input.id ?? randomUUID(),
      title: input.title,
      notes: input.notes ?? null,
      dueDate: input.dueDate ?? null,
      dueTime: input.dueTime ?? null,
      priority: input.priority ?? 'medium',
      calendarId: input.calendarId ?? null,
      courseId: input.courseId ?? null,
      applicationId: input.applicationId ?? null,
      reminders: input.reminders ?? [],
      status: 'todo',
      subtasks: input.subtasks ?? [],
      recurrence: input.recurrence ?? 'none',
      estimatedMinutes: input.estimatedMinutes ?? null,
      source: input.source ?? 'manual',
      sourceSnippet: input.sourceSnippet ?? null,
      sortOrder: maxSort + SORT_GAP, // new tasks go to the bottom of manual order
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      nextOccurrenceId: null,
      rollsOver: input.rollsOver ?? true,
      repeatDays: input.repeatDays ?? [],
      missedAt: null,
    };

    this.stmts.insert.run(taskToRow(task));
    return task;
  }
}
