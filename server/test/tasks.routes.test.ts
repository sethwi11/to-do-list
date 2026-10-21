import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase } from '../src/db/connection';
import { SqliteCategoryRepository, SqliteTaskRepository } from '../src/repositories/SqliteTaskRepository';

// A fresh in-memory database for every test, so tests can't affect each other.
let app: ReturnType<typeof createApp>;
beforeEach(() => {
  const db = openDatabase(':memory:');
  app = createApp({
    tasks: new SqliteTaskRepository(db),
    categories: new SqliteCategoryRepository(db),
  });
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
