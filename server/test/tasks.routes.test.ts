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

  it('rejects an unknown categoryId', async () => {
    await request(app)
      .post('/api/tasks')
      .send({ title: 'x', categoryId: '00000000-0000-4000-8000-000000000000' })
      .expect(400);
  });

  it('returns the seeded categories', async () => {
    const res = await request(app).get('/api/categories').expect(200);
    expect(res.body.map((c: { name: string }) => c.name)).toEqual([
      'School',
      'Work',
      'Personal',
      'Fraternity',
      'ACM',
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

describe('categories API', () => {
  it('creates, renames, recolors, and deletes a list', async () => {
    const created = await request(app).post('/api/categories').send({ name: 'Gym' }).expect(201);
    expect(created.body.color).toEqual(expect.any(String));

    const renamed = await request(app)
      .patch(`/api/categories/${created.body.id}`)
      .send({ name: 'Fitness', color: 'red' })
      .expect(200);
    expect(renamed.body).toMatchObject({ name: 'Fitness', color: 'red' });

    await request(app).delete(`/api/categories/${created.body.id}`).expect(204);
    await request(app).delete(`/api/categories/${created.body.id}`).expect(404);
  });

  it('rejects duplicate names (case-insensitive) with 409', async () => {
    await request(app).post('/api/categories').send({ name: 'school' }).expect(409);
  });

  it('deleting a list keeps its tasks but uncategorizes them', async () => {
    const { body: list } = await request(app).post('/api/categories').send({ name: 'Temp' });
    const { body: task } = await request(app).post('/api/tasks').send({ title: 'x', categoryId: list.id });
    await request(app).delete(`/api/categories/${list.id}`).expect(204);
    const { body: after } = await request(app).get(`/api/tasks/${task.id}`).expect(200);
    expect(after.categoryId).toBeNull();
  });
});
