import type { Category, CreateTaskInput, Task, UpdateTaskInput } from '@todo/shared';

/*
 * The data-access contract. Routes depend only on these interfaces, never on
 * SQLite directly, so swapping storage (Postgres, an in-memory fake for tests)
 * means writing a new class and changing nothing else.
 *
 * The methods return Promises even though better-sqlite3 is synchronous: most
 * other databases are async, and an async interface now means callers won't
 * need rewriting if the storage engine changes.
 */
export interface TaskRepository {
  /** All tasks that haven't been deleted. */
  list(): Promise<Task[]>;
  get(id: string): Promise<Task | null>;
  create(input: CreateTaskInput): Promise<Task>;
  /** Returns null if no (non-deleted) task has this id. */
  update(id: string, changes: UpdateTaskInput): Promise<Task | null>;
  /** Soft delete. Returns false if no task has this id. */
  delete(id: string): Promise<boolean>;
}

export interface CategoryRepository {
  list(): Promise<Category[]>;
}
