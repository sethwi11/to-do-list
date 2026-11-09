import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { changesSince } from '../scripts/carryOver';
import { makeTestApp } from './helpers';

const exportOf = async (app: ReturnType<typeof makeTestApp>) => (await request(app).get('/api/backup/export')).body;

describe('carrying a review copy\'s changes into the real app', () => {
  it('brings over what was added or checked off in the copy, and nothing the real app changed more recently', async () => {
    const real = makeTestApp();
    const checked = (await request(real).post('/api/tasks').send({ title: 'Checked off in the copy' })).body;
    const edited = (await request(real).post('/api/tasks').send({ title: 'Untouched in the copy' })).body;
    const clash = (await request(real).post('/api/tasks').send({ title: 'Changed in both places' })).body;
    // The copy starts as a copy of the real data.
    const copy = makeTestApp();
    await request(copy).post('/api/backup/import').send(await exportOf(real)).expect(200);
    await new Promise((r) => setTimeout(r, 20));
    const since = new Date().toISOString();
    await new Promise((r) => setTimeout(r, 20));

    // In the copy: a new task, a check-off, and an edit to the clash. In the real app afterwards: a newer edit to the clash.
    const added = (await request(copy).post('/api/tasks').send({ title: 'Added in the copy' })).body;
    await request(copy).patch(`/api/tasks/${checked.id}`).send({ status: 'done' }).expect(200);
    await request(copy).patch(`/api/tasks/${clash.id}`).send({ title: 'Copy version' }).expect(200);
    await new Promise((r) => setTimeout(r, 20));
    await request(real).patch(`/api/tasks/${clash.id}`).send({ title: 'Real version, newer' }).expect(200);
    await request(copy).post('/api/journal').send({ date: '2026-11-09', text: 'Written in the copy', rating: 7 }).expect(201);

    const changes = changesSince(await exportOf(copy), await exportOf(real), since);
    expect(changes.tasks.map((t) => t.title).sort()).toEqual(['Added in the copy', 'Checked off in the copy']);
    expect(changes.journalEntries).toHaveLength(1);
    expect(changes.calendars).toEqual([]); // nothing changed there
    expect(changes.settings).toBeUndefined();

    await request(real).post('/api/backup/import').send(changes).expect(200);
    const tasks = (await request(real).get('/api/tasks')).body as { id: string; title: string; status: string }[];
    expect(tasks.find((t) => t.id === added.id)).toBeTruthy();
    expect(tasks.find((t) => t.id === checked.id)?.status).toBe('done');
    expect(tasks.find((t) => t.id === edited.id)?.status).toBe('todo');
    expect(tasks.find((t) => t.id === clash.id)?.title).toBe('Real version, newer');
    expect((await request(real).get('/api/journal')).body[0]).toMatchObject({ text: 'Written in the copy', rating: 7 });
  });

  it('carries nothing when nothing changed, and running it twice changes nothing more', async () => {
    const real = makeTestApp();
    await request(real).post('/api/tasks').send({ title: 'Existing' });
    const copy = makeTestApp();
    await request(copy).post('/api/backup/import').send(await exportOf(real)).expect(200);
    const since = new Date(Date.now() + 1000).toISOString();
    const none = changesSince(await exportOf(copy), await exportOf(real), since);
    expect(none.tasks).toEqual([]);
    expect(none.journalEntries).toEqual([]);
  });
});
