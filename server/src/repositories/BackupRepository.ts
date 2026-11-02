import { BACKUP_VERSION, type Backup, type Category, type Task } from '@todo/shared';
import type { Db } from '../db/connection';
import type { CategoryRepository, TaskRepository } from './TaskRepository';

export interface ImportSummary {
  categoriesAdded: number;
  tasksAdded: number;
  tasksUpdated: number;
}

/**
 * Export/import of everything as one JSON document.
 *
 * Import MERGES rather than replacing: tasks are upserted by id (so
 * re-importing the same file is harmless), and lists are matched by id or,
 * failing that, by name. Nothing you have now is deleted. That makes
 * import safe to experiment with.
 */
export class BackupRepository {
  constructor(
    private readonly db: Db,
    private readonly tasks: TaskRepository,
    private readonly categories: CategoryRepository,
  ) {}

  async export(): Promise<Backup> {
    return {
      app: 'voice-todo',
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      categories: await this.categories.list(),
      tasks: await this.tasks.list(),
    };
  }

  async import(backup: Backup): Promise<ImportSummary> {
    const existingCats = await this.categories.list();
    const summary: ImportSummary = { categoriesAdded: 0, tasksAdded: 0, tasksUpdated: 0 };

    const insertCat = this.db.prepare(
      'INSERT INTO categories (id, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?)',
    );
    const taskExists = this.db.prepare<[string], { n: number }>('SELECT COUNT(*) AS n FROM tasks WHERE id = ?');
    const upsertTask = this.db.prepare(`
      INSERT INTO tasks (id, title, notes, due_date, due_time, priority, category_id, status, subtasks,
        recurrence, estimated_minutes, source, source_snippet, sort_order, created_at, updated_at,
        completed_at, next_occurrence_id, deleted_at)
      VALUES (@id, @title, @notes, @dueDate, @dueTime, @priority, @categoryId, @status, @subtasks,
        @recurrence, @estimatedMinutes, @source, @sourceSnippet, @sortOrder, @createdAt, @updatedAt,
        @completedAt, @nextOccurrenceId, NULL)
      ON CONFLICT(id) DO UPDATE SET title = excluded.title, notes = excluded.notes,
        due_date = excluded.due_date, due_time = excluded.due_time, priority = excluded.priority,
        category_id = excluded.category_id, status = excluded.status, subtasks = excluded.subtasks,
        recurrence = excluded.recurrence, estimated_minutes = excluded.estimated_minutes,
        source = excluded.source, source_snippet = excluded.source_snippet, sort_order = excluded.sort_order,
        updated_at = excluded.updated_at, completed_at = excluded.completed_at,
        next_occurrence_id = excluded.next_occurrence_id, deleted_at = NULL
    `);

    this.db.transaction(() => {
      // Map each imported list id to a list id that exists here.
      const idMap = new Map<string, string>();
      for (const c of backup.categories) {
        const match =
          existingCats.find((e) => e.id === c.id) ??
          existingCats.find((e) => e.name.toLowerCase() === c.name.toLowerCase());
        if (match) {
          idMap.set(c.id, match.id);
        } else {
          insertCat.run(c.id, c.name, c.color, c.sortOrder, c.createdAt);
          existingCats.push(c as Category);
          idMap.set(c.id, c.id);
          summary.categoriesAdded++;
        }
      }

      for (const t of backup.tasks as Task[]) {
        const exists = (taskExists.get(t.id)?.n ?? 0) > 0;
        upsertTask.run({
          ...t,
          categoryId: t.categoryId ? (idMap.get(t.categoryId) ?? null) : null,
          subtasks: JSON.stringify(t.subtasks),
        });
        if (exists) summary.tasksUpdated++;
        else summary.tasksAdded++;
      }
    })();

    return summary;
  }
}
