import { randomUUID } from 'node:crypto';
import type {
  Application,
  ApplicationStatus,
  CreateApplicationInput,
  StatusChange,
  UpdateApplicationInput,
} from '@todo/shared';
import type { Db } from '../db/connection';
import { SqliteCrud } from '../db/SqliteCrud';
import type { CrudRepository } from './types';

/** An application as stored in its own table: everything except the timeline, which lives in a second table. */
type ApplicationCore = Omit<Application, 'statusHistory'>;

/**
 * A status change that is reversed within this long is treated as fixing a slip (a card dropped in the wrong column),
 * not as something that happened: the slip is erased from the timeline instead of the correction being added after it.
 */
export const CORRECTION_WINDOW_MS = 2 * 60 * 1000;

/**
 * Applications are the one entity with a second table: every status change is
 * appended to application_status_history *by the server*, in the same
 * transaction as the change itself. A client can't skip or fake a timeline
 * entry, and dragging a card between kanban columns needs nothing but a PATCH.
 */
export class SqliteApplicationRepository
  extends SqliteCrud<ApplicationCore>
  implements CrudRepository<Application, CreateApplicationInput, UpdateApplicationInput>
{
  constructor(db: Db) {
    super(db, { table: 'applications', orderBy: 'sort_order, created_at' });
  }

  private historyOf(ids: string[]): Map<string, StatusChange[]> {
    const byApp = new Map<string, StatusChange[]>(ids.map((id) => [id, []]));
    const rows = this.db
      .prepare('SELECT application_id, status, changed_at FROM application_status_history ORDER BY rowid')
      .all() as { application_id: string; status: ApplicationStatus; changed_at: string }[];
    for (const r of rows) byApp.get(r.application_id)?.push({ status: r.status, date: r.changed_at });
    return byApp;
  }

  private addHistory(applicationId: string, status: ApplicationStatus, at: string) {
    this.db
      .prepare('INSERT INTO application_status_history (application_id, status, changed_at) VALUES (?, ?, ?)')
      .run(applicationId, status, at);
  }

  /** Log a change of status, unless it just undoes the previous change moments ago (then the previous one is erased). */
  private recordStatusChange(applicationId: string, from: ApplicationStatus, to: ApplicationStatus, at: string) {
    const [last, before] = this.db
      .prepare('SELECT rowid AS id, status, changed_at FROM application_status_history WHERE application_id = ? ORDER BY rowid DESC LIMIT 2')
      .all(applicationId) as { id: number; status: ApplicationStatus; changed_at: string }[];
    const isCorrection = last && before && last.status === from && before.status === to && Date.parse(at) - Date.parse(last.changed_at) < CORRECTION_WINDOW_MS;
    if (isCorrection) this.db.prepare('DELETE FROM application_status_history WHERE rowid = ?').run(last.id);
    else this.addHistory(applicationId, to, at);
  }

  async list(): Promise<Application[]> {
    const cores = this.listSync();
    const history = this.historyOf(cores.map((c) => c.id));
    return cores.map((c) => ({ ...c, statusHistory: history.get(c.id) ?? [] }));
  }

  async get(id: string): Promise<Application | null> {
    const core = this.getSync(id);
    return core ? { ...core, statusHistory: this.historyOf([id]).get(id) ?? [] } : null;
  }

  async create(input: CreateApplicationInput): Promise<Application> {
    if (input.id) {
      const existing = await this.get(input.id);
      if (existing) return existing; // an offline create being replayed
    }
    const now = new Date().toISOString();
    const status = input.status ?? 'Wishlist';
    const core: ApplicationCore = {
      id: input.id ?? randomUUID(),
      company: input.company,
      role: input.role,
      location: input.location ?? null,
      jobLink: input.jobLink ?? null,
      status,
      dateApplied: input.dateApplied ?? null,
      deadline: input.deadline ?? null,
      contactName: input.contactName ?? null,
      contactEmail: input.contactEmail ?? null,
      notes: input.notes ?? null,
      followUpHandledAt: input.followUpHandledAt ?? null,
      sortOrder: input.sortOrder ?? this.nextSortOrder(),
      createdAt: now,
      updatedAt: now,
    };
    this.db.transaction(() => {
      this.insertSync(core);
      this.addHistory(core.id, status, now);
    })();
    return { ...core, statusHistory: [{ status, date: now }] };
  }

  async update(id: string, changes: UpdateApplicationInput): Promise<Application | null> {
    const found = this.db.transaction((): boolean => {
      const existing = this.getSync(id);
      if (!existing) return false;
      const now = new Date().toISOString();
      this.patchSync(id, { ...changes, updatedAt: now });
      if (changes.status !== undefined && changes.status !== existing.status) this.recordStatusChange(id, existing.status, changes.status, now);
      return true;
    })();
    return found ? this.get(id) : null;
  }

  async delete(id: string): Promise<boolean> {
    return this.removeSync(id); // the history rows go with it (ON DELETE CASCADE)
  }

  /** Import: insert or overwrite an application along with its whole timeline. */
  upsertApplicationSync(app: Application): boolean {
    const { statusHistory, ...core } = app;
    const existed = this.upsertSync(core);
    this.db.prepare('DELETE FROM application_status_history WHERE application_id = ?').run(app.id);
    for (const h of statusHistory) this.addHistory(app.id, h.status, h.date);
    return existed;
  }
}
