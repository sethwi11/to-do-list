/*
 * The data-access contracts. Routes depend only on these interfaces, never on
 * SQLite directly, so swapping storage (Postgres, an in-memory fake for tests)
 * means writing a new class and changing nothing else.
 *
 * The methods return Promises even though better-sqlite3 is synchronous: most
 * other databases are async, and an async interface now means callers won't
 * need rewriting if the storage engine changes.
 *
 * Type parameters: T = the stored thing, C = what a client sends to create it,
 * U = what a client sends to change it.
 */
export interface CrudRepository<T, C, U> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | null>;
  create(input: C): Promise<T>;
  /** Returns null if there is no such row. */
  update(id: string, changes: U): Promise<T | null>;
  /** Returns false if there is no such row. */
  delete(id: string): Promise<boolean>;
}

/** A repository whose deletes are soft, so they can be undone. */
export interface RestorableRepository<T, C, U> extends CrudRepository<T, C, U> {
  /** Undo a delete. Returns null if there's no deleted row with this id. */
  restore(id: string): Promise<T | null>;
}
