import { applyPlan, buildEvent, expandOccurrences, invertPlan, planEventEdit, type Event } from '@todo/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp } from './helpers';

let app: ReturnType<typeof makeTestApp>;
beforeEach(() => {
  app = makeTestApp();
});
const api = () => request(app);

const NOW = '2026-11-04T12:00:00.000Z';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n: number, extra: Partial<Event> = {}): Event =>
  buildEvent({ title: `Event ${n}`, start: '2026-11-10T10:00', end: '2026-11-10T11:00', ...extra }, uuid(n), NOW);
const batch = (put: Event[], remove: string[] = []) => api().post('/api/events/batch').send({ put, remove });
const list = async (): Promise<Event[]> => (await api().get('/api/events')).body;

describe('POST /api/events/batch', () => {
  it('inserts new rows, replaces existing ones, and deletes others, in one request', async () => {
    await batch([row(1), row(2)]).expect(200);
    const res = await batch([{ ...row(1), title: 'Renamed' }, row(3)], [uuid(2)]).expect(200);
    expect(res.body.removed).toEqual([uuid(2)]);
    expect((await list()).map((e) => e.title).sort()).toEqual(['Event 3', 'Renamed']);
  });

  it('writing a deleted row again brings it back (this is how undo works)', async () => {
    await batch([row(1)]);
    await batch([], [uuid(1)]);
    expect(await list()).toHaveLength(0);
    await batch([row(1)]).expect(200);
    expect((await list()).map((e) => e.id)).toEqual([uuid(1)]);
  });

  it('changes nothing if any row is refused', async () => {
    await batch([row(1)]);
    // The second row names a calendar that does not exist, which the database refuses.
    const res = await batch([{ ...row(1), title: 'Changed' }, row(2, { calendarId: uuid(999) })], [uuid(1)]);
    expect(res.status).toBeGreaterThanOrEqual(400);
    const after = await list();
    expect(after.map((e) => e.title)).toEqual(['Event 1']); // not changed, not deleted, row 2 not added
  });

  it('rejects an invalid row (end before start) before touching anything', async () => {
    const res = await batch([row(1), row(2, { end: '2026-11-10T09:00' })]).expect(400);
    expect(res.body.issues[0].path).toBe('put.1.end');
    expect(await list()).toHaveLength(0);
  });

  it('rejects ids that are not UUIDs and bodies of the wrong shape', async () => {
    await api().post('/api/events/batch').send({ put: [], remove: ['nope'] }).expect(400);
    await api().post('/api/events/batch').send({ put: 'x' }).expect(400);
  });

  it('does not shadow the ordinary event routes', async () => {
    await api().post('/api/events').send({ title: 'Plain', start: '2026-11-10T10:00', end: '2026-11-10T11:00' }).expect(201);
    expect(await list()).toHaveLength(1);
  });
});

describe('a "this and following" edit through the API, then undo', () => {
  it('applies atomically and undoes cleanly', async () => {
    const series = row(1, { title: 'Class', recurrence: { freq: 'weekly', byWeekday: null, until: null, exdates: [] }, start: '2026-11-02T10:00', end: '2026-11-02T11:15' });
    await batch([series]).expect(200);

    const before = await list();
    const occurrence = expandOccurrences(before, '2026-11-16', '2026-11-17')[0]!;
    let n = 100;
    const plan = planEventEdit({ events: before, occurrence, scope: 'following', changes: { title: 'Class (new room)', location: 'Room 4' }, now: NOW, newId: () => uuid(++n) });
    await batch(plan.put, plan.remove).expect(200);

    const after = await list();
    expect(after).toHaveLength(2);
    expect(after).toEqual(expect.arrayContaining(applyPlan(before, plan)));
    expect(expandOccurrences(after, '2026-11-09', '2026-11-24').map((o) => `${o.start.slice(5, 10)} ${o.event.title}`)).toEqual(['11-09 Class', '11-16 Class (new room)', '11-23 Class (new room)']);

    const undo = invertPlan(plan, before);
    await batch(undo.put, undo.remove).expect(200);
    expect(await list()).toEqual(before);
  });
});
