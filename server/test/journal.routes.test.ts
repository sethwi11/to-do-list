import Database from 'better-sqlite3';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { LATEST_VERSION, runMigrations } from '../src/db/migrations';
import { makeTestApp } from './helpers';

let app: ReturnType<typeof makeTestApp>;
beforeEach(() => {
  app = makeTestApp();
});
const api = () => request(app);

describe('the daily journal', () => {
  it('keeps what you wrote for a day, with the score optional', async () => {
    const { body } = await api().post('/api/journal').send({ date: '2026-11-09' }).expect(201);
    expect(body).toMatchObject({ date: '2026-11-09', text: '', rating: null });
    const saved = await api().patch(`/api/journal/${body.id}`).send({ text: 'Long day.\n\nGood gym session.', rating: 7 }).expect(200);
    expect(saved.body).toMatchObject({ text: 'Long day.\n\nGood gym session.', rating: 7 });
    const cleared = await api().patch(`/api/journal/${body.id}`).send({ rating: null }).expect(200);
    expect(cleared.body).toMatchObject({ text: 'Long day.\n\nGood gym session.', rating: null });
  });

  it('takes a score of 1 to 10 only, a real date, and a sensible amount of text', async () => {
    for (const rating of [0, 11, 5.5, '7']) await api().post('/api/journal').send({ date: '2026-11-09', rating }).expect(400);
    await api().post('/api/journal').send({ date: '2026-02-30' }).expect(400);
    await api().post('/api/journal').send({ date: '2026-11-09', text: 'x'.repeat(20_001) }).expect(400);
    await api().post('/api/journal').send({ date: '2026-11-09', text: 'x'.repeat(20_000), rating: 10 }).expect(201);
  });

  it('has one entry a day, listed newest first', async () => {
    await api().post('/api/journal').send({ date: '2026-11-08', text: 'a' }).expect(201);
    await api().post('/api/journal').send({ date: '2026-11-10', text: 'c' }).expect(201);
    await api().post('/api/journal').send({ date: '2026-11-08', text: 'again' }).expect(409);
    expect((await api().get('/api/journal')).body.map((e: { date: string }) => e.date)).toEqual(['2026-11-10', '2026-11-08']);
    const { body } = await api().post('/api/journal').send({ date: '2026-11-09' });
    await api().patch(`/api/journal/${body.id}`).send({}).expect(400);
    await api().patch(`/api/journal/${body.id}`).send({ rating: 11 }).expect(400);
  });
});

describe('upgrading a database from schema 11', () => {
  it('adds the journal table and leaves the Path data as it was', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(db, 11);
    const now = '2026-11-09T12:00:00.000Z';
    db.prepare("INSERT INTO milestones (id, title, sort_order, created_at, updated_at) VALUES ('m1', 'Finish the book', 1024, ?, ?)").run(now, now);

    runMigrations(db);

    expect(db.pragma('user_version', { simple: true })).toBe(LATEST_VERSION);
    expect(db.prepare('SELECT title FROM milestones').get()).toEqual({ title: 'Finish the book' });
    db.prepare("INSERT INTO journal_entries (id, date, text, rating, created_at, updated_at) VALUES ('j1', '2026-11-09', 'ok', 6, ?, ?)").run(now, now);
    expect(() => db.prepare("INSERT INTO journal_entries (id, date, text, rating, created_at, updated_at) VALUES ('j2', '2026-11-09', '', 11, ?, ?)").run(now, now)).toThrow();
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
  });
});

describe('backing up the journal', () => {
  it('carries entries to a fresh install, and an import never overwrites newer writing', async () => {
    const { body: mine } = await api().post('/api/journal').send({ date: '2026-11-09', text: 'Mine, written later', rating: 8 });
    await api().post('/api/journal').send({ date: '2026-11-08', text: 'Saturday', rating: 5 });
    const { body: backup } = await api().get('/api/backup/export').expect(200);
    expect(backup.journalEntries).toHaveLength(2);

    const target = makeTestApp();
    await request(target).post('/api/backup/import').send(backup).expect(200);
    const copy = (await request(target).get('/api/journal')).body;
    expect(copy.map((e: { text: string; rating: number }) => [e.text, e.rating])).toEqual([['Mine, written later', 8], ['Saturday', 5]]);

    // The target's own entry for Nov 9 was edited after the file was made: the file must not replace it.
    const own = copy.find((e: { date: string }) => e.date === '2026-11-09');
    await request(target).patch(`/api/journal/${own.id}`).send({ text: 'Edited here afterwards' }).expect(200);
    await request(target).post('/api/backup/import').send(backup).expect(200);
    expect((await request(target).get(`/api/journal/${own.id}`)).body.text).toBe('Edited here afterwards');

    // But a file with a newer version of the day replaces an older one, keeping the same id.
    const newer = { ...backup, journalEntries: [{ ...mine, id: crypto.randomUUID(), text: 'Rewritten elsewhere', updatedAt: '2999-01-01T00:00:00.000Z' }] };
    await request(target).post('/api/backup/import').send(newer).expect(200);
    expect((await request(target).get(`/api/journal/${own.id}`)).body.text).toBe('Rewritten elsewhere');
    expect((await request(target).get('/api/journal')).body).toHaveLength(2);
  });
});
