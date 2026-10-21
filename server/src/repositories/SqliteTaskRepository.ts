import { randomUUID } from 'node:crypto';
import type { Category, CreateTaskInput, Task, UpdateTaskInput } from '@todo/shared';
import type { Db } from '../db/connection';
import type { CategoryRepository, TaskRepository } from './TaskRepository';

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
}

interface CategoryRow {
  id: string;
  name: string;
  color: Category['color'];
  sort_order: number;
  created_at: string;
}

// Gap between sortOrder values. Leaving room means a drag-and-drop move
// (Phase 2) can land *between* two tasks by updating only the moved row.
const SORT_GAP = 1024;

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
  };
}

export class SqliteTaskRepository implements TaskRepository {
  // Prepared once, reused on every call: SQLite parses and plans each query only once.
  private readonly stmts;

  constructor(private readonly db: Db) {
    this.stmts = {
      list: db.prepare<[], TaskRow>(
        'SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY sort_order',
      ),
      get: db.prepare<[string], TaskRow>('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL'),
      maxSort: db.prepare<[], { max: number | null }>('SELECT MAX(sort_order) AS max FROM tasks'),
      insert: db.prepare<TaskRow>(`
        INSERT INTO tasks (id, title, notes, due_date, due_time, priority, category_id, status,
          subtasks, recurrence, estimated_minutes, source, source_snippet, sort_order,
          created_at, updated_at, completed_at)
        VALUES (@id, @title, @notes, @due_date, @due_time, @priority, @category_id, @status,
          @subtasks, @recurrence, @estimated_minutes, @source, @source_snippet, @sort_order,
          @created_at, @updated_at, @completed_at)
      `),
      update: db.prepare<TaskRow>(`
        UPDATE tasks SET title = @title, notes = @notes, due_date = @due_date, due_time = @due_time,
          priority = @priority, category_id = @category_id, status = @status, subtasks = @subtasks,
          recurrence = @recurrence, estimated_minutes = @estimated_minutes, source = @source,
          source_snippet = @source_snippet, sort_order = @sort_order, updated_at = @updated_at,
          completed_at = @completed_at
        WHERE id = @id
      `),
      softDelete: db.prepare<[string, string]>(
        'UPDATE tasks SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL',
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
    };

    this.stmts.insert.run(taskToRow(task));
    return task;
  }

  async update(id: string, changes: UpdateTaskInput): Promise<Task | null> {
    // Read-modify-write inside a transaction so two concurrent PATCHes
    // can't interleave and lose one another's changes.
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

      // completedAt is derived from status transitions, never set directly.
      if (existing.status !== 'done' && next.status === 'done') next.completedAt = now;
      if (next.status === 'todo') next.completedAt = null;

      this.stmts.update.run(taskToRow(next));
      return next;
    })();
  }

  async delete(id: string): Promise<boolean> {
    return this.stmts.softDelete.run(new Date().toISOString(), id).changes > 0;
  }
}

export class SqliteCategoryRepository implements CategoryRepository {
  constructor(private readonly db: Db) {}

  async list(): Promise<Category[]> {
    const rows = this.db
      .prepare<[], CategoryRow>('SELECT * FROM categories ORDER BY sort_order')
      .all();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      sortOrder: r.sort_order,
      createdAt: r.created_at,
    }));
  }
}
