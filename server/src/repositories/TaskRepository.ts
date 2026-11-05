import type { CreateTaskInput, Task, UpdateTaskInput } from '@todo/shared';

/*
 * The data-access contract. Routes depend only on these interfaces, never on
 * SQLite directly, so swapping storage (Postgres, an in-memory fake for tests)
 * means writing a new class and changing nothing else.
 *
 * The methods return Promises even though better-sqlite3 is synchronous: most
 * other databases are async, and an async interface now means callers won't
 * need rewriting if the storage engine changes.
 */

/** Per-request facts the repository can't know on its own. */
export interface RequestContext {
  /** The user's local calendar date ("YYYY-MM-DD"), used to schedule recurrences. */
  today: string;
}

export interface TaskRepository {
  /** All tasks that haven't been deleted. */
  list(): Promise<Task[]>;
  get(id: string): Promise<Task | null>;
  create(input: CreateTaskInput): Promise<Task>;
  /**
   * Returns null if no (non-deleted) task has this id. Completing a recurring
   * task also creates its next occurrence, and reopening it removes that
   * occurrence again, all in one transaction.
   */
  update(id: string, changes: UpdateTaskInput, ctx: RequestContext): Promise<Task | null>;
  /** Soft delete. Returns false if no task has this id. */
  delete(id: string): Promise<boolean>;
  /** Undo a soft delete. Returns null if there's no deleted task with this id. */
  restore(id: string): Promise<Task | null>;
  /** Rewrites sortOrder so the given ids are evenly spaced in this order. */
  reorder(ids: string[]): Promise<void>;
  /** Permanently removes tasks soft-deleted before the given ISO timestamp. */
  purgeDeleted(before: string): Promise<number>;
}
