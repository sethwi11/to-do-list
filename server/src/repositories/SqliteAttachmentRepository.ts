import type { Attachment, AttachmentOwnerType } from '@todo/shared';
import type { Db } from '../db/connection';
import { HttpError } from '../errors';

/** An attachment plus how many items it is attached to. */
export interface AttachmentWithUse extends Attachment {
  linkCount: number;
}

interface Row {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  path: string;
  created_at: string;
  link_count?: number;
}

const toAttachment = (r: Row): Attachment => ({ id: r.id, filename: r.filename, mimeType: r.mime_type, size: r.size, path: r.path, createdAt: r.created_at });

/** Which table holds each kind of owner, so a link can't point at something that doesn't exist. */
const OWNER_TABLE: Record<AttachmentOwnerType, string> = { task: 'tasks', event: 'events', application: 'applications', course: 'courses' };

/**
 * File metadata and the links between files and the things they are attached to. (The bytes
 * themselves are on disk; the routes look after those.) One file can be linked to many items, so
 * "delete the file too?" is only asked when this was the last link.
 */
export class SqliteAttachmentRepository {
  constructor(private readonly db: Db) {}

  create(a: Attachment): Attachment {
    this.db.prepare('INSERT INTO attachments (id, filename, mime_type, size, path, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(a.id, a.filename, a.mimeType, a.size, a.path, a.createdAt);
    return a;
  }

  get(id: string): Attachment | null {
    const row = this.db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as Row | undefined;
    return row ? toAttachment(row) : null;
  }

  /** The files attached to one item, each with the number of items it's attached to in total. */
  listForOwner(ownerType: AttachmentOwnerType, ownerId: string): AttachmentWithUse[] {
    const rows = this.db
      .prepare(
        `SELECT a.*, (SELECT COUNT(*) FROM attachment_links x WHERE x.attachment_id = a.id) AS link_count
         FROM attachments a JOIN attachment_links l ON l.attachment_id = a.id
         WHERE l.owner_type = ? AND l.owner_id = ? ORDER BY a.created_at`,
      )
      .all(ownerType, ownerId) as Row[];
    return rows.map((r) => ({ ...toAttachment(r), linkCount: r.link_count ?? 1 }));
  }

  /** Attach a file to an item. Doing it twice is harmless. */
  link(attachmentId: string, ownerType: AttachmentOwnerType, ownerId: string): void {
    if (!this.get(attachmentId)) throw new HttpError(404, 'That file does not exist');
    const table = OWNER_TABLE[ownerType];
    const softDeletes = ownerType === 'task' || ownerType === 'event';
    const exists = this.db.prepare(`SELECT 1 FROM ${table} WHERE id = ?${softDeletes ? ' AND deleted_at IS NULL' : ''}`).get(ownerId);
    if (!exists) throw new HttpError(404, `That ${ownerType} does not exist`);
    this.db.prepare('INSERT OR IGNORE INTO attachment_links (attachment_id, owner_type, owner_id) VALUES (?, ?, ?)').run(attachmentId, ownerType, ownerId);
  }

  unlink(attachmentId: string, ownerType: AttachmentOwnerType, ownerId: string): boolean {
    return this.db.prepare('DELETE FROM attachment_links WHERE attachment_id = ? AND owner_type = ? AND owner_id = ?').run(attachmentId, ownerType, ownerId).changes > 0;
  }

  /** Remove the file's record (its links go with it). Returns what was removed, so the caller can delete the bytes. */
  delete(id: string): Attachment | null {
    const existing = this.get(id);
    if (!existing) return null;
    this.db.prepare('DELETE FROM attachments WHERE id = ?').run(id);
    return existing;
  }
}
