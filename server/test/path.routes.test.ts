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
const ID = '9b3e4f0a-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

describe('milestones', () => {
  it('start empty-handed, validate, and can be marked reached', async () => {
    const { body } = await api().post('/api/milestones').send({ title: 'Finish the book' }).expect(201);
    expect(body).toMatchObject({ title: 'Finish the book', targetDate: null, reachedOn: null, calendarIds: [], savingsGoalId: null, trackOffers: false });
    await api().post('/api/milestones').send({ title: '  ' }).expect(400);
    await api().post('/api/milestones').send({ title: 'x', targetDate: '2027-02-30' }).expect(400);
    await api().post('/api/milestones').send({ title: 'x', calendarIds: ['nope'] }).expect(400);
    const done = await api().patch(`/api/milestones/${body.id}`).send({ reachedOn: '2026-11-10', trackOffers: true }).expect(200);
    expect(done.body).toMatchObject({ reachedOn: '2026-11-10', trackOffers: true });
    await api().patch(`/api/milestones/${body.id}`).send({}).expect(400);
  });

  it('keeps the inputs they are linked to, and can be deleted and restored (Undo)', async () => {
    const cal = (await api().get('/api/calendars')).body[0].id;
    const goal = (await api().post('/api/savings-goals').send({ name: 'A house', targetCents: 5_000_000 })).body;
    const { body } = await api().post('/api/milestones').send({ title: 'A house', calendarIds: [cal], savingsGoalId: goal.id, targetDate: '2029-04-22' }).expect(201);
    expect(body).toMatchObject({ calendarIds: [cal], savingsGoalId: goal.id });
    await api().delete(`/api/milestones/${body.id}`).expect(204);
    expect((await api().get('/api/milestones')).body).toHaveLength(0);
    await api().post(`/api/milestones/${body.id}/restore`).expect(200);
    expect((await api().get('/api/milestones')).body).toHaveLength(1);
  });
});

describe('badges', () => {
  it('are kept once earned, never twice for the same key, and never edited', async () => {
    const { body } = await api().post('/api/badges').send({ key: 'streak:gym:7', title: 'Gym streak: 7 days', earnedOn: '2026-11-09' }).expect(201);
    expect(body).toMatchObject({ key: 'streak:gym:7', earnedOn: '2026-11-09' });
    await api().post('/api/badges').send({ key: 'streak:gym:7', title: 'Again', earnedOn: '2026-11-10' }).expect(409);
    await api().post('/api/badges').send({ key: 'x', title: 'No date' }).expect(400);
    await api().patch(`/api/badges/${body.id}`).send({ title: 'Changed' }).expect(404);
    expect((await api().get('/api/badges')).body).toHaveLength(1);
  });
});

describe('weekly reviews with priorities', () => {
  it('start with no notes or priorities, and hold up to three', async () => {
    const { body } = await api().post('/api/weekly-reviews').send({ weekStart: '2026-11-02' }).expect(201);
    expect(body).toMatchObject({ notes: '', priorities: [] });
    const saved = await api().patch(`/api/weekly-reviews/${body.id}`).send({ priorities: ['  Send 5 applications ', 'Gym daily', 'Read'] }).expect(200);
    expect(saved.body.priorities).toEqual(['Send 5 applications', 'Gym daily', 'Read']);
    await api().patch(`/api/weekly-reviews/${body.id}`).send({ notes: 'Tired' }).expect(200);
    expect((await api().get(`/api/weekly-reviews/${body.id}`)).body).toMatchObject({ notes: 'Tired', priorities: ['Send 5 applications', 'Gym daily', 'Read'] });
  });
  it('refuses a fourth priority, a blank one, or an empty change', async () => {
    const { body } = await api().post('/api/weekly-reviews').send({ weekStart: '2026-11-02' });
    await api().patch(`/api/weekly-reviews/${body.id}`).send({ priorities: ['a', 'b', 'c', 'd'] }).expect(400);
    await api().patch(`/api/weekly-reviews/${body.id}`).send({ priorities: ['  '] }).expect(400);
    await api().patch(`/api/weekly-reviews/${body.id}`).send({}).expect(400);
    await api().post('/api/weekly-reviews').send({ weekStart: '2026-11-02' }).expect(409); // one review per week
  });
});

describe('the Stage 2 lock', () => {
  const notes = (stage2Notes: string, extra = {}) => api().patch('/api/settings').send({ path: { stage2Notes, ...extra } });

  it('refuses to write Stage 2 until the 20th birthday has come', async () => {
    expect((await notes('Learn how AI works')).status).toBe(400);
    await api().patch('/api/settings').send({ path: { birthday: '2999-01-01' } }).expect(200);
    const locked = await notes('Learn how AI works');
    expect(locked.status).toBe(400);
    expect(locked.body.message).toContain('3019-01-01');
    expect((await api().get('/api/settings')).body.path.stage2Notes).toBe('');
  });
  it('is not unlocked by changing the birthday in the same request', async () => {
    expect((await notes('Sneaky', { birthday: '2000-01-01' })).status).toBe(400);
  });
  it('lets the rest of the path be edited meanwhile, and Stage 2 once the birthday has passed', async () => {
    await api().patch('/api/settings').send({ path: { northStar: [{ text: 'A goal', age: 22 }], stage2Notes: '' } }).expect(200);
    await api().patch('/api/settings').send({ path: { birthday: '2000-01-01' } }).expect(200);
    const open = await notes('Learn how AI works').expect(200);
    expect(open.body.path).toMatchObject({ birthday: '2000-01-01', stage2Notes: 'Learn how AI works', northStar: [{ text: 'A goal', age: 22 }] });
  });
  it('rejects a bad north star', async () => {
    await api().patch('/api/settings').send({ path: { northStar: [{ text: '', age: 22 }] } }).expect(400);
    await api().patch('/api/settings').send({ path: { northStar: [{ text: 'x', age: 0 }] } }).expect(400);
    await api().patch('/api/settings').send({ path: { birthday: '2001-13-01' } }).expect(400);
  });
});

describe('upgrading a database from schema 10', () => {
  it('adds the new tables and gives each existing review no priorities, leaving it as it was', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(db, 10);
    const now = '2026-11-08T12:00:00.000Z';
    db.prepare("INSERT INTO weekly_reviews (id, week_start, notes, created_at, updated_at) VALUES ('w1', '2026-11-02', 'Solid week', ?, ?)").run(now, now);

    runMigrations(db);

    expect(db.pragma('user_version', { simple: true })).toBe(LATEST_VERSION);
    expect(db.prepare('SELECT week_start, notes, priorities FROM weekly_reviews').get()).toEqual({ week_start: '2026-11-02', notes: 'Solid week', priorities: '[]' });
    expect(db.prepare('SELECT COUNT(*) n FROM milestones').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT COUNT(*) n FROM badges').get()).toEqual({ n: 0 });
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
    expect(db.pragma('foreign_key_check')).toEqual([]);
  });
});

describe('backing up the Path', () => {
  it('carries milestones, badges, priorities and path settings to a fresh install, once', async () => {
    const goal = (await api().post('/api/savings-goals').send({ name: 'A house', targetCents: 5_000_000 })).body;
    await api().post('/api/milestones').send({ title: 'A house', savingsGoalId: goal.id, reachedOn: '2026-11-10' });
    await api().post('/api/badges').send({ key: 'week:first', title: 'First fully checked-in week', earnedOn: '2026-11-08' });
    await api().post('/api/weekly-reviews').send({ weekStart: '2026-11-02', priorities: ['Send 5 applications'] });
    await api().patch('/api/settings').send({ path: { birthday: '2000-01-01', northStar: [{ text: 'A goal', age: 22 }] } });
    const { body: backup } = await api().get('/api/backup/export').expect(200);
    expect(backup.version).toBe(8);

    const target = makeTestApp();
    await request(target).post('/api/backup/import').send(backup).expect(200);
    await request(target).post('/api/backup/import').send(backup).expect(200);
    const get = async (p: string) => (await request(target).get(p)).body;
    expect(await get('/api/milestones')).toHaveLength(1);
    expect(await get('/api/badges')).toHaveLength(1);
    expect((await get('/api/weekly-reviews'))[0].priorities).toEqual(['Send 5 applications']);
    expect((await get('/api/settings')).path).toMatchObject({ birthday: '2000-01-01', northStar: [{ text: 'A goal', age: 22 }] });
  });
});
