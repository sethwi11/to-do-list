import { randomUUID } from 'node:crypto';
import type { Db } from '../db/connection';
import { SqliteCrud, type CrudOptions } from '../db/SqliteCrud';
import { HttpError } from '../errors';
import type { RestorableRepository } from './types';

/** Facts about "now" handed to an entity's build() function. */
export interface BuildContext {
  id: string;
  now: string;
  /** Where a new row goes at the end of a sortable list (0 for tables with no sort_order). */
  sortOrder: number;
  /** How many live rows the table has (used e.g. to cycle default colors). */
  count: number;
}

export interface EntityRepoConfig<T extends { id: string }, C extends { id?: string | undefined }> extends CrudOptions {
  /** Turns a create request into a full row, filling in defaults and server-owned fields. */
  build(input: C, ctx: BuildContext): T;
  /** Cross-field rule checked after an update is applied (e.g. "end after start"). Return an error message, or null if fine. */
  check?(next: T): string | null;
}

/** A complete repository for any table, driven by configuration: this is what most of the app's tables use. */
export class SqliteEntityRepository<T extends { id: string }, C extends { id?: string | undefined }, U extends object>
  extends SqliteCrud<T>
  implements RestorableRepository<T, C, U>
{
  constructor(
    db: Db,
    protected readonly config: EntityRepoConfig<T, C>,
  ) {
    super(db, config);
  }

  async list(): Promise<T[]> {
    return this.listSync();
  }

  async get(id: string): Promise<T | null> {
    return this.getSync(id);
  }

  async create(input: C): Promise<T> {
    // A client may choose the id (so a create made offline can be replayed safely).
    if (input.id) {
      const existing = this.getSync(input.id);
      if (existing) return existing;
    }
    const ctx: BuildContext = {
      id: input.id ?? randomUUID(),
      now: new Date().toISOString(),
      sortOrder: this.hasColumn('sortOrder') ? this.nextSortOrder() : 0,
      count: this.countSync(),
    };
    return this.insertSync(this.config.build(input, ctx));
  }

  async update(id: string, changes: U): Promise<T | null> {
    return this.db.transaction((): T | null => {
      const existing = this.getSync(id);
      if (!existing) return null;

      const defined = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)) as Partial<T>;
      const problem = this.config.check?.({ ...existing, ...defined });
      if (problem) throw new HttpError(400, problem);

      const patch = this.hasColumn('updatedAt') ? { ...defined, updatedAt: new Date().toISOString() } : defined;
      this.patchSync(id, patch as Partial<T>);
      return this.getSync(id);
    })();
  }

  async delete(id: string): Promise<boolean> {
    return this.removeSync(id);
  }

  async restore(id: string): Promise<T | null> {
    return this.restoreSync(id) ? this.getSync(id) : null;
  }

  /** Write several rows and delete others as one unit: if any row is rejected, nothing changes. */
  async applyBatch({ put, remove }: { put: T[]; remove: string[] }): Promise<{ put: T[]; removed: string[] }> {
    return this.db.transaction(() => {
      for (const row of put) {
        const problem = this.config.check?.(row);
        if (problem) throw new HttpError(400, problem);
        this.upsertSync(row);
      }
      return { put, removed: remove.filter((id) => this.removeSync(id)) };
    })();
  }
}
