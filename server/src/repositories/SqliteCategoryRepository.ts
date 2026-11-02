import { randomUUID } from 'node:crypto';
import {
  CATEGORY_COLORS,
  type Category,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '@todo/shared';
import type { Db } from '../db/connection';
import type { CategoryRepository } from './TaskRepository';
import { SORT_GAP } from './SqliteTaskRepository';

interface CategoryRow {
  id: string;
  name: string;
  color: Category['color'];
  sort_order: number;
  created_at: string;
}

const rowToCategory = (r: CategoryRow): Category => ({
  id: r.id,
  name: r.name,
  color: r.color,
  sortOrder: r.sort_order,
  createdAt: r.created_at,
});

export class SqliteCategoryRepository implements CategoryRepository {
  private readonly stmts;

  constructor(db: Db) {
    this.stmts = {
      list: db.prepare<[], CategoryRow>('SELECT * FROM categories ORDER BY sort_order'),
      get: db.prepare<[string], CategoryRow>('SELECT * FROM categories WHERE id = ?'),
      stats: db.prepare<[], { count: number; max: number | null }>(
        'SELECT COUNT(*) AS count, MAX(sort_order) AS max FROM categories',
      ),
      insert: db.prepare<CategoryRow>(
        'INSERT INTO categories (id, name, color, sort_order, created_at) VALUES (@id, @name, @color, @sort_order, @created_at)',
      ),
      update: db.prepare<CategoryRow>(
        'UPDATE categories SET name = @name, color = @color, sort_order = @sort_order WHERE id = @id',
      ),
      // ON DELETE SET NULL on tasks.category_id un-categorizes its tasks.
      delete: db.prepare<[string]>('DELETE FROM categories WHERE id = ?'),
    };
  }

  async list(): Promise<Category[]> {
    return this.stmts.list.all().map(rowToCategory);
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    const { count, max } = this.stmts.stats.get() ?? { count: 0, max: 0 };
    const category: Category = {
      id: randomUUID(),
      name: input.name,
      // No color given? Cycle through the palette so new lists look distinct.
      color: input.color ?? CATEGORY_COLORS[count % CATEGORY_COLORS.length]!,
      sortOrder: (max ?? 0) + SORT_GAP,
      createdAt: new Date().toISOString(),
    };
    this.stmts.insert.run({
      id: category.id,
      name: category.name,
      color: category.color,
      sort_order: category.sortOrder,
      created_at: category.createdAt,
    });
    return category;
  }

  async update(id: string, changes: UpdateCategoryInput): Promise<Category | null> {
    const row = this.stmts.get.get(id);
    if (!row) return null;
    const next = { ...rowToCategory(row), ...Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)) };
    this.stmts.update.run({
      id,
      name: next.name,
      color: next.color,
      sort_order: next.sortOrder,
      created_at: next.createdAt,
    });
    return next;
  }

  async delete(id: string): Promise<boolean> {
    return this.stmts.delete.run(id).changes > 0;
  }
}
