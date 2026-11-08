// The data-access contracts.
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
