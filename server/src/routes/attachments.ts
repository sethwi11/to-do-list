import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { AttachmentOwnerTypeSchema } from '@todo/shared';
import { z } from 'zod';
import { cleanFilename, extensionOf, FILE_KINDS, MAX_UPLOAD_BYTES } from '../files';
import { HttpError } from '../errors';
import type { SqliteAttachmentRepository } from '../repositories/SqliteAttachmentRepository';

const OwnerSchema = z.object({ ownerType: AttachmentOwnerTypeSchema, ownerId: z.uuid() });
const supportedList = Object.keys(FILE_KINDS).map((e) => `.${e}`).join(', ');

/** Files: upload (multipart field "file"), list an item's files, serve the bytes, link or unlink an item, delete. */
export function attachmentsRouter(repo: SqliteAttachmentRepository, uploadsDir: string): Router {
  const router = Router();
  fs.mkdirSync(uploadsDir, { recursive: true });
  const root = path.resolve(uploadsDir);

  const upload = multer({
    // Saved under a generated name: the person's filename is only ever data, never part of a path.
    storage: multer.diskStorage({
      destination: root,
      filename: (_req, file, cb) => cb(null, `${randomUUID()}.${extensionOf(file.originalname)}`),
    }),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (FILE_KINDS[extensionOf(file.originalname)]) return cb(null, true);
      cb(new HttpError(415, `Files of that type can't be attached. Supported: ${supportedList}. (For Word documents, save as .docx or PDF.)`));
    },
  });

  router.post('/', upload.single('file'), (req, res) => {
    const file = req.file;
    if (!file) throw new HttpError(400, 'Choose a file to upload');
    const ext = extensionOf(file.originalname);
    const kind = FILE_KINDS[ext]!;
    try {
      // The first bytes must look like the type the name claims, or it isn't kept.
      const head = Buffer.alloc(16);
      const fd = fs.openSync(file.path, 'r');
      fs.readSync(fd, head, 0, 16, 0);
      fs.closeSync(fd);
      if (kind.signature && !kind.signature(head)) throw new HttpError(415, `That file doesn't look like a real .${ext} file.`);
      const saved = repo.create({
        id: path.basename(file.filename, path.extname(file.filename)),
        filename: cleanFilename(file.originalname),
        mimeType: kind.mime,
        size: file.size,
        path: file.filename,
        createdAt: new Date().toISOString(),
      });
      res.status(201).json(saved);
    } catch (err) {
      fs.rmSync(file.path, { force: true }); // don't leave a file that has no record
      throw err;
    }
  });

  router.get('/', (req, res) => {
    const owner = OwnerSchema.safeParse(req.query);
    if (!owner.success) throw new HttpError(400, 'Say which item with ownerType and ownerId');
    res.json(repo.listForOwner(owner.data.ownerType, owner.data.ownerId));
  });

  router.get('/:id/file', (req, res) => {
    const attachment = repo.get(req.params.id);
    const abs = attachment && path.resolve(root, attachment.path);
    if (!attachment || !abs || !abs.startsWith(root + path.sep) || !fs.existsSync(abs)) {
      res.status(404).json({ error: 'NotFound', message: 'File not found' });
      return;
    }
    const kind = FILE_KINDS[extensionOf(attachment.path)]!;
    const asDownload = req.query.download === '1' || !kind.inline;
    res.set({
      // The type is the one we decided at upload. nosniff stops browsers second-guessing it, and the sandbox policy means that even a hostile file couldn't run anything from this address.
      'Content-Type': attachment.mimeType,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Content-Disposition': `${asDownload ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
      'Cache-Control': 'private, no-cache', // always re-check, so a deleted file isn't shown from the browser's memory
    });
    res.sendFile(abs);
  });

  router.post('/:id/links', (req, res) => {
    const owner = OwnerSchema.safeParse(req.body);
    if (!owner.success) throw new HttpError(400, 'Say which item with ownerType and ownerId');
    repo.link(req.params.id, owner.data.ownerType, owner.data.ownerId);
    res.status(204).end();
  });

  router.delete('/:id/links/:ownerType/:ownerId', (req, res) => {
    const owner = OwnerSchema.safeParse(req.params);
    if (!owner.success) throw new HttpError(400, 'Say which item with ownerType and ownerId');
    if (!repo.unlink(req.params.id, owner.data.ownerType, owner.data.ownerId)) {
      res.status(404).json({ error: 'NotFound', message: 'That file is not attached to that item' });
      return;
    }
    res.status(204).end();
  });

  router.delete('/:id', (req, res) => {
    const removed = repo.delete(req.params.id);
    if (!removed) {
      res.status(404).json({ error: 'NotFound', message: 'File not found' });
      return;
    }
    fs.rmSync(path.resolve(root, removed.path), { force: true });
    res.status(204).end();
  });

  return router;
}
