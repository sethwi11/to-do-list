import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp } from './helpers';

// A fresh in-memory database for every test, so tests can't affect each other.
let app: ReturnType<typeof makeTestApp>;
beforeEach(() => {
  app = makeTestApp();
});

describe('tasks API', () => {
  it('creates a task with defaults and lists it', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .send({ title: 'Finish COMP 365 lab', dueDate: '2026-10-23', priority: 'high' })
      .expect(201);

    expect(created.body).toMatchObject({
      title: 'Finish COMP 365 lab',
      dueDate: '2026-10-23',
      priority: 'high',
      status: 'todo',
      subtasks: [],
      recurrence: 'none',
      source: 'manual',
      completedAt: null,
    });

    const list = await request(app).get('/api/tasks').expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('rejects invalid input with 400 and field-level issues', async () => {
    const res = await request(app).post('/api/tasks').send({ title: '', priority: 'urgent' }).expect(400);
    expect(res.body.error).toBe('ValidationError');
    expect(res.body.issues.map((i: { path: string }) => i.path)).toEqual(
      expect.arrayContaining(['title', 'priority']),
    );
  });

  it('sets completedAt when completed and clears it when reopened', async () => {
    const { body: task } = await request(app).post('/api/tasks').send({ title: 'Groceries' });

    const done = await request(app).patch(`/api/tasks/${task.id}`).send({ status: 'done' }).expect(200);
    expect(done.body.completedAt).toEqual(expect.any(String));

    const reopened = await request(app).patch(`/api/tasks/${task.id}`).send({ status: 'todo' }).expect(200);
    expect(reopened.body.completedAt).toBeNull();
  });

  it('clears a field when PATCHed with null', async () => {
    const { body: task } = await request(app).post('/api/tasks').send({ title: 'x', dueDate: '2026-10-21' });
    const res = await request(app).patch(`/api/tasks/${task.id}`).send({ dueDate: null }).expect(200);
    expect(res.body.dueDate).toBeNull();
  });

  it('soft-deletes: the task disappears from the list and returns 404 afterwards', async () => {
    const { body: task } = await request(app).post('/api/tasks').send({ title: 'Email Valencia' });

    await request(app).delete(`/api/tasks/${task.id}`).expect(204);
    await request(app).get(`/api/tasks/${task.id}`).expect(404);
    await request(app).delete(`/api/tasks/${task.id}`).expect(404);
    expect((await request(app).get('/api/tasks')).body).toHaveLength(0);
  });

  it('rejects an unknown calendarId', async () => {
    await request(app)
      .post('/api/tasks')
      .send({ title: 'x', calendarId: '00000000-0000-4000-8000-000000000000' })
      .expect(400);
  });

  it('returns the seeded calendars', async () => {
    const res = await request(app).get('/api/calendars').expect(200);
    expect(res.body.map((c: { name: string }) => c.name)).toEqual([
      'School',
      'Work',
      'Applications',
      'ACM',
      'Kappa Alpha Psi',
      'Personal',
    ]);
  });
});

describe('recurring tasks', () => {
  it('completing creates the next occurrence; reopening removes it again', async () => {
    const { body: task } = await request(app)
      .post('/api/tasks')
      .send({ title: 'Gym', dueDate: '2026-11-02', recurrence: 'daily', subtasks: [{ id: 's1', title: 'Stretch', done: true }] });

    const done = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set('X-Client-Date', '2026-11-02')
      .send({ status: 'done' })
      .expect(200);
    expect(done.body.nextOccurrenceId).toEqual(expect.any(String));

    const { body: next } = await request(app).get(`/api/tasks/${done.body.nextOccurrenceId}`).expect(200);
    expect(next).toMatchObject({ title: 'Gym', dueDate: '2026-11-03', status: 'todo', recurrence: 'daily' });
    expect(next.subtasks[0].done).toBe(false); // subtasks reset on the new occurrence

    // Un-checking (or Undo) removes the spawned occurrence, so toggling can't create duplicates.
    const reopened = await request(app).patch(`/api/tasks/${task.id}`).send({ status: 'todo' }).expect(200);
    expect(reopened.body.nextOccurrenceId).toBeNull();
    await request(app).get(`/api/tasks/${next.id}`).expect(404);
  });

  it('uses the client date to skip occurrences already in the past', async () => {
    const { body: task } = await request(app)
      .post('/api/tasks')
      .send({ title: 'Journal', dueDate: '2026-10-20', recurrence: 'daily' });
    const done = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set('X-Client-Date', '2026-11-02')
      .send({ status: 'done' });
    const { body: next } = await request(app).get(`/api/tasks/${done.body.nextOccurrenceId}`);
    expect(next.dueDate).toBe('2026-11-02');
  });
});

describe('undo + ordering', () => {
  it('restores a soft-deleted task', async () => {
    const { body: task } = await request(app).post('/api/tasks').send({ title: 'Oops' });
    await request(app).delete(`/api/tasks/${task.id}`).expect(204);
    const restored = await request(app).post(`/api/tasks/${task.id}/restore`).expect(200);
    expect(restored.body.title).toBe('Oops');
    await request(app).get(`/api/tasks/${task.id}`).expect(200);
    await request(app).post(`/api/tasks/${task.id}/restore`).expect(404); // not deleted anymore
  });

  it('reorders tasks by id list', async () => {
    const a = (await request(app).post('/api/tasks').send({ title: 'A' })).body;
    const b = (await request(app).post('/api/tasks').send({ title: 'B' })).body;
    await request(app).post('/api/tasks/reorder').send({ ids: [b.id, a.id] }).expect(204);
    const list = (await request(app).get('/api/tasks')).body;
    expect(list.map((t: { title: string }) => t.title)).toEqual(['B', 'A']);
  });
});

describe('calendars API', () => {
  it('creates, renames, recolors, and deletes a calendar', async () => {
    const created = await request(app).post('/api/calendars').send({ name: 'Gym' }).expect(201);
    expect(created.body.color).toEqual(expect.any(String));

    const renamed = await request(app)
      .patch(`/api/calendars/${created.body.id}`)
      .send({ name: 'Fitness', color: 'tomato' })
      .expect(200);
    expect(renamed.body).toMatchObject({ name: 'Fitness', color: 'tomato' });

    await request(app).delete(`/api/calendars/${created.body.id}`).expect(204);
    await request(app).delete(`/api/calendars/${created.body.id}`).expect(404);
  });

  it('rejects duplicate names (case-insensitive) with 409', async () => {
    await request(app).post('/api/calendars').send({ name: 'school' }).expect(409);
  });

  it('deleting a list keeps its tasks but unassigns them', async () => {
    const { body: list } = await request(app).post('/api/calendars').send({ name: 'Temp' });
    const { body: task } = await request(app).post('/api/tasks').send({ title: 'x', calendarId: list.id });
    await request(app).delete(`/api/calendars/${list.id}`).expect(204);
    const { body: after } = await request(app).get(`/api/tasks/${task.id}`).expect(200);
    expect(after.calendarId).toBeNull();
  });
});

describe('rolling repeating tasks', () => {
  const day = (date: string) => ({ 'X-Client-Date': date });

  it('replaces an unfinished weekly task with this week’s occurrence and marks the old one missed', async () => {
    const app = makeTestApp();
    const { body: old } = await request(app).post('/api/tasks').send({ title: 'Check in with a friend', dueDate: '2026-11-04', recurrence: 'weekly' }).expect(201);
    expect(old.rollsOver).toBe(true);
    let list = (await request(app).get('/api/tasks').set(day('2026-11-10'))).body;
    expect(list).toHaveLength(1); // still its week
    list = (await request(app).get('/api/tasks').set(day('2026-11-19'))).body;
    const missed = list.filter((t: { missedAt: string | null }) => t.missedAt !== null);
    const current = list.filter((t: { missedAt: string | null }) => t.missedAt === null);
    expect(missed).toHaveLength(1);
    expect(current).toEqual([expect.objectContaining({ title: 'Check in with a friend', dueDate: '2026-11-18', status: 'todo' })]);
    // Running again changes nothing.
    expect((await request(app).get('/api/tasks').set(day('2026-11-19'))).body).toHaveLength(2);
  });

  it('finishing one early still creates the next one, and nothing is missed', async () => {
    const app = makeTestApp();
    const { body: t } = await request(app).post('/api/tasks').send({ title: 'Water plants', dueDate: '2026-11-11', recurrence: 'weekly', repeatDays: [3] }).expect(201);
    await request(app).patch(`/api/tasks/${t.id}`).set(day('2026-11-09')).send({ status: 'done' }).expect(200);
    const list = (await request(app).get('/api/tasks').set(day('2026-11-09'))).body;
    expect(list.find((x: { status: string }) => x.status === 'todo')).toMatchObject({ dueDate: '2026-11-18', repeatDays: [3] });
    expect(list.some((x: { missedAt: string | null }) => x.missedAt)).toBe(false);
  });

  it('leaves a repeating task with rolling turned off to go overdue as before', async () => {
    const app = makeTestApp();
    await request(app).post('/api/tasks').send({ title: 'Pay rent', dueDate: '2026-11-01', recurrence: 'monthly', rollsOver: false }).expect(201);
    const list = (await request(app).get('/api/tasks').set(day('2026-12-15'))).body;
    expect(list).toEqual([expect.objectContaining({ title: 'Pay rent', dueDate: '2026-11-01', missedAt: null })]);
  });
});
