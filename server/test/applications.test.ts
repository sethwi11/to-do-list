import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeTestApp, makeTestAppWithDb } from './helpers';

const statuses = (body: { statusHistory: { status: string }[] }) => body.statusHistory.map((h) => h.status);

describe('the follow-up memory (followUpHandledAt)', () => {
  it('starts empty, is set by a PATCH, survives unrelated edits, and can be cleared', async () => {
    const app = makeTestApp();
    const { body } = await request(app).post('/api/applications').send({ company: 'Acme', role: 'SWE' }).expect(201);
    expect(body.followUpHandledAt).toBeNull();

    const stamp = '2026-11-20T15:00:00.000Z';
    const set = await request(app).patch(`/api/applications/${body.id}`).send({ followUpHandledAt: stamp }).expect(200);
    expect(set.body.followUpHandledAt).toBe(stamp);

    // an edit that doesn't mention it must leave it alone (including a status change)
    await request(app).patch(`/api/applications/${body.id}`).send({ notes: 'Referred by Sam' }).expect(200);
    const moved = await request(app).patch(`/api/applications/${body.id}`).send({ status: 'Applied' }).expect(200);
    expect(moved.body.followUpHandledAt).toBe(stamp);

    const cleared = await request(app).patch(`/api/applications/${body.id}`).send({ followUpHandledAt: null }).expect(200);
    expect(cleared.body.followUpHandledAt).toBeNull();
  });

  it('refuses something that is not a timestamp', async () => {
    const app = makeTestApp();
    const { body } = await request(app).post('/api/applications').send({ company: 'Acme', role: 'SWE' });
    await request(app).patch(`/api/applications/${body.id}`).send({ followUpHandledAt: 'yesterday' }).expect(400);
  });

  it('travels through export and import, and an old export without it still imports', async () => {
    const source = makeTestApp();
    const stamp = '2026-11-20T15:00:00.000Z';
    const { body } = await request(source).post('/api/applications').send({ company: 'Acme', role: 'SWE', status: 'Applied', followUpHandledAt: stamp });
    const { body: backup } = await request(source).get('/api/backup/export').expect(200);

    const target = makeTestApp();
    await request(target).post('/api/backup/import').send(backup).expect(200);
    expect((await request(target).get(`/api/applications/${body.id}`)).body.followUpHandledAt).toBe(stamp);

    // a file written before the field existed
    const old = structuredClone(backup);
    for (const a of old.applications) delete a.followUpHandledAt;
    const fresh = makeTestApp();
    await request(fresh).post('/api/backup/import').send(old).expect(200);
    expect((await request(fresh).get(`/api/applications/${body.id}`)).body.followUpHandledAt).toBeNull();
  });
});

describe('correcting a slip in the timeline', () => {
  /** Pretend the latest timeline entry was made `minutes` ago. */
  const ageLastEntry = (db: ReturnType<typeof makeTestAppWithDb>['db'], id: string, minutes: number) =>
    db
      .prepare('UPDATE application_status_history SET changed_at = ? WHERE rowid = (SELECT MAX(rowid) FROM application_status_history WHERE application_id = ?)')
      .run(new Date(Date.now() - minutes * 60_000).toISOString(), id);

  it('erases a change that is reversed right away, instead of logging the slip and the fix', async () => {
    const app = makeTestApp();
    const { body } = await request(app).post('/api/applications').send({ company: 'Acme', role: 'SWE', status: 'Applied' });
    await request(app).patch(`/api/applications/${body.id}`).send({ status: 'Interviewing' }).expect(200); // dropped in the wrong column
    const fixed = await request(app).patch(`/api/applications/${body.id}`).send({ status: 'Applied' }).expect(200);
    expect(fixed.body.status).toBe('Applied');
    expect(statuses(fixed.body)).toEqual(['Applied']);
  });

  it('keeps both entries when the reversal comes later, because by then the first change really happened', async () => {
    const { app, db } = makeTestAppWithDb();
    const { body } = await request(app).post('/api/applications').send({ company: 'Acme', role: 'SWE', status: 'Applied' });
    await request(app).patch(`/api/applications/${body.id}`).send({ status: 'Interviewing' }).expect(200);
    ageLastEntry(db, body.id, 10);
    const later = await request(app).patch(`/api/applications/${body.id}`).send({ status: 'Applied' }).expect(200);
    expect(statuses(later.body)).toEqual(['Applied', 'Interviewing', 'Applied']);
  });

  it('does not mistake a quick run of real progress for corrections', async () => {
    const app = makeTestApp();
    const { body } = await request(app).post('/api/applications').send({ company: 'Acme', role: 'SWE' });
    let last = body;
    for (const status of ['Applied', 'Online Assessment', 'Interviewing', 'Offer']) {
      last = (await request(app).patch(`/api/applications/${body.id}`).send({ status }).expect(200)).body;
    }
    expect(statuses(last)).toEqual(['Wishlist', 'Applied', 'Online Assessment', 'Interviewing', 'Offer']);
  });

  it('never erases the first entry', async () => {
    const app = makeTestApp();
    const { body } = await request(app).post('/api/applications').send({ company: 'Acme', role: 'SWE' });
    const moved = await request(app).patch(`/api/applications/${body.id}`).send({ status: 'Applied' }).expect(200);
    expect(statuses(moved.body)).toEqual(['Wishlist', 'Applied']);
    // Applied -> Wishlist right away looks like a correction of the second entry: the timeline is back to one entry
    const back = await request(app).patch(`/api/applications/${body.id}`).send({ status: 'Wishlist' }).expect(200);
    expect(statuses(back.body)).toEqual(['Wishlist']);
  });
});
