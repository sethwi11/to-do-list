import { AppSettingsSchema, DEFAULT_SETTINGS, mergeSettings, type AppSettings, type UpdateSettingsInput } from '@todo/shared';
import type { Db } from '../db/connection';

export interface SettingsRepository {
  get(): Promise<AppSettings>;
  update(changes: UpdateSettingsInput): Promise<AppSettings>;
}

const KEY = 'app';

/** Settings are stored as one JSON document under one key. */
export class SqliteSettingsRepository implements SettingsRepository {
  constructor(private readonly db: Db) {}

  getSync(): AppSettings {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(KEY) as { value: string } | undefined;
    if (!row) return DEFAULT_SETTINGS;
    const stored = AppSettingsSchema.partial().safeParse(JSON.parse(row.value));
    return stored.success ? mergeSettings(DEFAULT_SETTINGS, stored.data) : DEFAULT_SETTINGS;
  }

  setSync(settings: AppSettings): void {
    this.db
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(KEY, JSON.stringify(settings));
  }

  async get(): Promise<AppSettings> {
    return this.getSync();
  }

  async update(changes: UpdateSettingsInput): Promise<AppSettings> {
    const next = mergeSettings(this.getSync(), changes);
    this.setSync(next);
    return next;
  }
}
