import { randomUUID } from 'node:crypto';
import { nextOccurrence, type CreateTaskInput, type Task, type UpdateTaskInput } from '@todo/shared';
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
  category_id: string | null;
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
}

// Gap between sortOrder values. Leaving room means a drag-and-drop move can
// land *between* two tasks (at the midpoint) by updating only the moved row.
export const SORT_GAP = 1024;

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    dueDate: row.due_date,
    dueTime: row.due_time,
    priority: row.priority,
    categoryId: row.category_id,
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
    category_id: task.categoryId,
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
      softDelete: db.prepare<[string, string]>('UPDATE tasks SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL'),
      restore: db.prepare<[string]>('UPDATE tasks SET deleted_at = NULL WHERE id = ?'),
      setSort: db.prepare<[number, string]>('UPDATE tasks SET sort_order = ? WHERE id = ?'),
      purge: db.prepare<[string]>('DELETE FROM tasks WHERE deleted_at IS NOT NULL AND deleted_at < ?'),
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
    return this.insert(input);
  }

  async update(id: string, changes: UpdateTaskInput, ctx: RequestContext): Promise<Task | null> {
    // Read-modify-write inside a transaction, so two concurrent PATCHes can't
    // interleave, and creating/removing a recurrence is all-or-nothing.
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
        const spawned = this.insert({
          title: next.title,
          notes: next.notes,
          dueDate: nextOccurrence(next.dueDate, next.recurrence, ctx.today),
          dueTime: next.dueTime,
          priority: next.priority,
          categoryId: next.categoryId,
          subtasks: next.subtasks.map((s) => ({ ...s, done: false })),
          recurrence: next.recurrence,
          estimatedMinutes: next.estimatedMinutes,
          source: next.source,
          sourceSnippet: next.sourceSnippet,
        });
        next.nextOccurrenceId = spawned.id;
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
      id: randomUUID(),
      title: input.title,
      notes: input.notes ?? null,
      dueDate: input.dueDate ?? null,
      dueTime: input.dueTime ?? null,
      priority: input.priority ?? 'medium',
      categoryId: input.categoryId ?? null,
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
    };

    this.stmts.insert.run(taskToRow(task));
    return task;
  }
}
