import type Database from 'better-sqlite3';
import type { Db } from './connection';

// Cached statements are shared by queries with different parameter shapes, so their types stay loose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyStatement = Database.Statement<any[], any>;

/*
 * A small, generic data-access class: the shared plumbing for every table.
 *
 * Without it, each of the ~12 tables would need its own copy of the same four
 * queries plus the same row <-> object translation. Instead each table gets
 * a few lines of configuration, and the translation rules live here once:
 *
 *   - camelCase object keys <-> snake_case columns (dueDate <-> due_date),
 *     with an override map for columns named differently (start <-> start_at,
 *     because `end` is a reserved word in SQL);
 *   - JSON columns (lists and objects stored as text) are parsed/stringified;
 *   - boolean columns are stored as 0/1.
 *
 * Column names are read from the table itself (PRAGMA table_info), and any key
 * that isn't one of them throws. Values are always passed as bound
 * parameters, never pasted into the SQL, so request data can't change a query.
 */

export interface CrudOptions {
  table: string;
  /** ORDER BY clause for list(), e.g. "sort_order, created_at". */
  orderBy: string;
  /** Keys stored as JSON text. */
  json?: readonly string[];
  /** Keys stored as 0/1. */
  bool?: readonly string[];
  /** Keys whose column isn't simply the snake_case name. */
  columns?: Readonly<Record<string, string>>;
  /** Mark rows deleted instead of removing them, so a delete can be undone. */
  softDelete?: boolean;
}

type Row = Record<string, unknown>;

const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export class SqliteCrud<T extends { id: string }> {
  /** entity key -> column name */
  protected readonly keyToColumn = new Map<string, string>();
  /** column name -> entity key */
  protected readonly columnToKey = new Map<string, string>();
  private readonly statements = new Map<string, AnyStatement>();

  constructor(
    protected readonly db: Db,
    protected readonly opts: CrudOptions,
  ) {
    const overrides = new Map(Object.entries(opts.columns ?? {}).map(([key, col]) => [col, key]));
    const info = db.prepare(`PRAGMA table_info(${opts.table})`).all() as { name: string }[];
    for (const { name } of info) {
      if (name === 'deleted_at') continue; // bookkeeping, not part of the entity
      const key = overrides.get(name) ?? toCamel(name);
      this.keyToColumn.set(key, name);
      this.columnToKey.set(name, key);
    }
  }

  get hasColumn() {
    return (key: string) => this.keyToColumn.has(key);
  }

  /** Statements are parsed once and reused. */
  private stmt(sql: string): AnyStatement {
    let s = this.statements.get(sql);
    if (!s) {
      s = this.db.prepare(sql) as AnyStatement;
      this.statements.set(sql, s);
    }
    return s;
  }

  protected fromRow(row: Row): T {
    const entity: Row = {};
    for (const [column, value] of Object.entries(row)) {
      const key = this.columnToKey.get(column);
      if (key === undefined) continue;
      if (value !== null && this.opts.json?.includes(key)) entity[key] = JSON.parse(value as string);
      else if (this.opts.bool?.includes(key)) entity[key] = value === 1;
      else entity[key] = value;
    }
    return entity as T;
  }

  /** Entity (or patch) -> { column: value }, skipping undefined. */
  protected toRow(entity: Partial<T>): Row {
    const row: Row = {};
    for (const [key, value] of Object.entries(entity)) {
      if (value === undefined) continue;
      const column = this.keyToColumn.get(key);
      if (!column) throw new Error(`"${key}" is not a column of ${this.opts.table}`);
      if (this.opts.json?.includes(key) && value !== null) row[column] = JSON.stringify(value);
      else if (this.opts.bool?.includes(key)) row[column] = value ? 1 : 0;
      else row[column] = value;
    }
    return row;
  }

  private get live() {
    return this.opts.softDelete ? 'deleted_at IS NULL' : '1';
  }

  listSync(): T[] {
    const rows = this.stmt(`SELECT * FROM ${this.opts.table} WHERE ${this.live} ORDER BY ${this.opts.orderBy}`).all();
    return (rows as Row[]).map((r) => this.fromRow(r));
  }

  getSync(id: string): T | null {
    const row = this.stmt(`SELECT * FROM ${this.opts.table} WHERE id = ? AND ${this.live}`).get(id);
    return row ? this.fromRow(row as Row) : null;
  }

  countSync(): number {
    return (this.stmt(`SELECT COUNT(*) AS n FROM ${this.opts.table} WHERE ${this.live}`).get() as { n: number }).n;
  }

  /** Next value for a sort_order column: the end of the list, with room to insert between items later. */
  nextSortOrder(): number {
    const max = (this.stmt(`SELECT MAX(sort_order) AS m FROM ${this.opts.table}`).get() as { m: number | null }).m;
    return (max ?? 0) + 1024;
  }

  insertSync(entity: T): T {
    const row = this.toRow(entity);
    const cols = Object.keys(row);
    this.stmt(
      `INSERT INTO ${this.opts.table} (${cols.join(', ')}) VALUES (${cols.map((c) => `@${c}`).join(', ')})`,
    ).run(row);
    return entity;
  }

  /** Update only the given fields. Returns false if the row doesn't exist. */
  patchSync(id: string, patch: Partial<T>): boolean {
    const row = this.toRow(patch);
    const cols = Object.keys(row);
    if (cols.length === 0) return this.getSync(id) !== null;
    const sql = `UPDATE ${this.opts.table} SET ${cols.map((c) => `${c} = @${c}`).join(', ')} WHERE id = @id AND ${this.live}`;
    return this.stmt(sql).run({ ...row, id }).changes > 0;
  }

  removeSync(id: string): boolean {
    if (this.opts.softDelete) {
      return this.stmt(`UPDATE ${this.opts.table} SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL`).run(new Date().toISOString(), id).changes > 0;
    }
    return this.stmt(`DELETE FROM ${this.opts.table} WHERE id = ?`).run(id).changes > 0;
  }

  /** Undo a soft delete. Returns false if there's no deleted row with this id. */
  restoreSync(id: string): boolean {
    return this.stmt(`UPDATE ${this.opts.table} SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL`).run(id).changes > 0;
  }

  /** Insert, or overwrite the row with the same id. Returns true if it already existed. Used by import. */
  upsertSync(entity: T): boolean {
    const existed = (this.stmt(`SELECT COUNT(*) AS n FROM ${this.opts.table} WHERE id = ?`).get(entity.id) as { n: number }).n > 0;
    const row = this.toRow(entity);
    const cols = Object.keys(row);
    const updates = cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`);
    if (this.opts.softDelete) updates.push('deleted_at = NULL');
    this.stmt(
      `INSERT INTO ${this.opts.table} (${cols.join(', ')}) VALUES (${cols.map((c) => `@${c}`).join(', ')}) ` +
        `ON CONFLICT(id) DO UPDATE SET ${updates.join(', ')}`,
    ).run(row);
    return existed;
  }
}
