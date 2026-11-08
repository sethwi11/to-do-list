import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp } from './helpers';

let app: ReturnType<typeof makeTestApp>;
beforeEach(() => {
  app = makeTestApp();
});
const api = () => request(app);

const template = { name: 'Made-up fall week', effectiveFrom: '2026-09-01', effectiveTo: '2026-12-15', days: [{ weekday: 3, wake: '06:00', bed: '02:00' }] };

async function makeTemplate() {
  return (await api().post('/api/week-templates').send(template).expect(201)).body;
}

describe('week templates and routine blocks', () => {
  it('stores a template with its days and checks its dates', async () => {
    const t = await makeTemplate();
    expect(t).toMatchObject({ ...template, meetingWindows: [] });
    await api().post('/api/week-templates').send({ ...template, effectiveTo: '2026-08-01' }).expect(400);
    await api().patch(`/api/week-templates/${t.id}`).send({ effectiveTo: '2026-08-01' }).expect(400);
  });

  it('creates a block with defaults, allows ending after midnight, and rejects a zero-length block', async () => {
    const t = await makeTemplate();
    const block = { templateId: t.id, weekday: 3, start: '22:00', end: '02:00', title: 'Free', priority: 'free' };
    const { body } = await api().post('/api/routine-blocks').send(block).expect(201);
    expect(body).toMatchObject({ ...block, calendarId: null, focus: false, notify: true, schoolDaysOnly: false, soundtrack: null });
    await api().post('/api/routine-blocks').send({ ...block, end: '22:00' }).expect(400);
    await api().patch(`/api/routine-blocks/${body.id}`).send({ start: '02:00' }).expect(400);
  });

  it('writes many blocks in one batch, and the batch removes them again (Undo)', async () => {
    const t = await makeTemplate();
    const now = new Date().toISOString();
    const row = (id: string, weekday: number) => ({
      id, templateId: t.id, weekday, start: '09:00', end: '10:00', title: 'Study', calendarId: null, altTitle: null, altCalendarId: null,
      priority: 'normal', focus: true, soundtrack: 'lofi', notify: true, schoolDaysOnly: false, notes: null, createdAt: now, updatedAt: now,
    });
    const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
    await api().post('/api/routine-blocks/batch').send({ put: ids.map((id, i) => row(id, i + 1)), remove: [] }).expect(200);
    expect((await api().get('/api/routine-blocks')).body).toHaveLength(2);
    await api().post('/api/routine-blocks/batch').send({ put: [], remove: ids }).expect(200);
    expect((await api().get('/api/routine-blocks')).body).toHaveLength(0);
  });

  it('soft-deletes and restores a template', async () => {
    const t = await makeTemplate();
    await api().delete(`/api/week-templates/${t.id}`).expect(204);
    expect((await api().get('/api/week-templates')).body).toHaveLength(0);
    await api().post(`/api/week-templates/${t.id}/restore`).expect(200);
    expect((await api().get('/api/week-templates')).body).toHaveLength(1);
  });

  it('round-trips the routine through export and import', async () => {
    const t = await makeTemplate();
    await api().post('/api/routine-blocks').send({ templateId: t.id, weekday: 1, start: '06:20', end: '07:50', title: 'Gym' }).expect(201);
    const backup = (await api().get('/api/backup/export')).body;
    const target = makeTestApp();
    await request(target).post('/api/backup/import').send(backup).expect(200);
    expect((await request(target).get('/api/week-templates')).body).toEqual([t]);
    expect((await request(target).get('/api/routine-blocks')).body[0]).toMatchObject({ title: 'Gym', templateId: t.id });
  });
});
