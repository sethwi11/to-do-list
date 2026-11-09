import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeTestApp } from './helpers';

const NEW_ID = '9b3e4f0a-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

/** An app with at least one row in every table. */
async function populatedApp() {
  const app = makeTestApp();
  const school = (await request(app).get('/api/calendars')).body.find((c: { name: string }) => c.name === 'School');
  const { body: gym } = await request(app).post('/api/calendars').send({ name: 'Gym', color: 'teal' });
  const { body: task } = await request(app).post('/api/tasks').send({ title: 'Finish lab', calendarId: school.id, reminders: [1440] });
  await request(app).post('/api/tasks').send({ title: 'Run', calendarId: gym.id });
  const { body: sem } = await request(app).post('/api/semesters').send({ name: 'Fall', startDate: '2026-08-24', endDate: '2026-12-11' });
  const { body: course } = await request(app).post('/api/courses').send({ semesterId: sem.id, name: 'COMP 365', meetingDays: [2, 4], startTime: '10:00', endTime: '11:15', calendarId: school.id });
  const { body: application } = await request(app).post('/api/applications').send({ company: 'Acme', role: 'SWE' });
  await request(app).patch(`/api/applications/${application.id}`).send({ status: 'Applied' });
  const { body: series } = await request(app).post('/api/events').send({
    title: 'COMP 365', start: '2026-11-03T10:00', end: '2026-11-03T11:15', calendarId: school.id, courseId: course.id,
    recurrence: { freq: 'weekly', byWeekday: [2, 4], until: '2026-12-10', exdates: ['2026-11-26'] },
  });
  await request(app).post('/api/events').send({ title: 'Moved class', start: '2026-11-05T13:00', end: '2026-11-05T14:15', recurringEventId: series.id, originalStart: '2026-11-05T10:00', calendarId: school.id });
  await request(app).post('/api/events').send({ title: 'Acme interview', start: '2026-11-12T10:00', end: '2026-11-12T11:00', applicationId: application.id });
  await request(app).post('/api/time-blocks').send({ taskId: task.id, start: '2026-11-04T09:00', end: '2026-11-04T10:00' });
  await request(app).post('/api/templates').send({ name: 'Trip', items: [{ id: 'a', title: 'Pack', offsetDays: -1 }] });
  await request(app).post('/api/focus-sessions').send({ taskId: task.id, startedAt: '2026-11-04T15:00:00.000Z', durationSeconds: 1500 });
  await request(app).post('/api/weekly-reviews').send({ weekStart: '2026-11-02', notes: 'Solid week' });
  await request(app).patch('/api/settings').send({ offerGoal: 12, focus: { focusMinutes: 50 } });
  return app;
}

describe('export / import', () => {
  it('exports every kind of data in one document', async () => {
    const app = await populatedApp();
    const { body } = await request(app).get('/api/backup/export').expect(200);
    expect(body).toMatchObject({ app: 'voice-todo', version: 8 });
    expect(body.calendars).toHaveLength(7);
    expect(body.tasks).toHaveLength(2);
    expect(body.events).toHaveLength(3);
    expect(body.applications[0].statusHistory.map((h: { status: string }) => h.status)).toEqual(['Wishlist', 'Applied']);
    for (const key of ['eventTypes', 'timeBlocks', 'semesters', 'courses', 'templates', 'focusSessions', 'weeklyReviews']) {
      expect(body[key].length, key).toBeGreaterThan(0);
    }
    expect(body.settings.offerGoal).toBe(12);
  });

  it('moves everything to a fresh install without duplicating the calendars, event types, or built-in templates every install has', async () => {
    const source = await populatedApp();
    const { body: backup } = await request(source).get('/api/backup/export');

    const target = makeTestApp();
    const res = await request(target).post('/api/backup/import').send(backup).expect(200);
    expect(res.body.tasks).toEqual({ added: 2, updated: 0 });
    expect(res.body.events).toEqual({ added: 3, updated: 0 });

    const get = async (path: string) => (await request(target).get(path)).body;
    expect((await get('/api/calendars')).map((c: { name: string }) => c.name)).toEqual([
      'School', 'Work', 'Applications', 'ACM', 'Kappa Alpha Psi', 'Personal', 'Gym',
    ]);
    expect(await get('/api/event-types')).toHaveLength(9);
    expect((await get('/api/templates')).map((t: { name: string }) => t.name).sort()).toEqual(['Exam prep', 'Interview prep', 'Org event planning', 'Trip']);

    // Things that pointed at a matched calendar now point at *this* install's calendar.
    const school = (await get('/api/calendars')).find((c: { name: string }) => c.name === 'School');
    const tasks = await get('/api/tasks');
    expect(tasks.find((t: { title: string }) => t.title === 'Finish lab')).toMatchObject({ calendarId: school.id, reminders: [1440] });
    const events = await get('/api/events');
    expect(events.find((e: { title: string }) => e.title === 'COMP 365').recurrence).toEqual({ freq: 'weekly', byWeekday: [2, 4], until: '2026-12-10', exdates: ['2026-11-26'] });
    expect(events.find((e: { title: string }) => e.title === 'Moved class').recurringEventId).toBeTruthy();
    expect((await get('/api/applications'))[0].statusHistory).toHaveLength(2);
    expect((await get('/api/settings')).offerGoal).toBe(12);
    expect(await get('/api/weekly-reviews')).toHaveLength(1);
  });

  it('importing the same file twice changes nothing the second time', async () => {
    const source = await populatedApp();
    const { body: backup } = await request(source).get('/api/backup/export');
    const target = makeTestApp();
    await request(target).post('/api/backup/import').send(backup).expect(200);
    const second = await request(target).post('/api/backup/import').send(backup).expect(200);
    for (const [table, counts] of Object.entries(second.body as Record<string, { added: number }>)) {
      expect(counts.added, table).toBe(0);
    }
    expect((await request(target).get('/api/tasks')).body).toHaveLength(2);
    expect((await request(target).get('/api/events')).body).toHaveLength(3);
    expect((await request(target).get('/api/templates')).body).toHaveLength(4);
  });

  it('merges into existing data instead of replacing it', async () => {
    const target = makeTestApp();
    await request(target).post('/api/tasks').send({ title: 'Already here' });
    const source = await populatedApp();
    const { body: backup } = await request(source).get('/api/backup/export');
    await request(target).post('/api/backup/import').send(backup).expect(200);
    const titles = (await request(target).get('/api/tasks')).body.map((t: { title: string }) => t.title);
    expect(titles).toEqual(expect.arrayContaining(['Already here', 'Finish lab', 'Run']));
  });

  it('reads a file exported by the original to-do app (version 1)', async () => {
    const target = makeTestApp();
    const calendars = (await request(target).get('/api/calendars')).body;
    const school = calendars.find((c: { name: string }) => c.name === 'School');
    const v1 = {
      app: 'voice-todo', version: 1, exportedAt: '2026-11-03T12:00:00.000Z',
      categories: [
        { id: school.id, name: 'School', color: 'blue', sortOrder: 1024, createdAt: '2026-11-02T00:00:00.000Z' },
        { id: NEW_ID, name: 'Fraternity', color: 'purple', sortOrder: 4096, createdAt: '2026-11-02T00:00:00.000Z' },
      ],
      tasks: [{
        id: '33333333-3333-4333-8333-333333333333', title: 'Old task', notes: null, dueDate: '2026-11-06', dueTime: null, priority: 'high',
        categoryId: NEW_ID, status: 'todo', subtasks: [], recurrence: 'none', estimatedMinutes: null, source: 'brain-dump',
        sourceSnippet: null, sortOrder: 1024, createdAt: '2026-11-02T00:00:00.000Z', updatedAt: '2026-11-02T00:00:00.000Z',
        completedAt: null, nextOccurrenceId: null,
      }],
    };
    await request(target).post('/api/backup/import').send(v1).expect(200);
    const kap = (await request(target).get('/api/calendars')).body.find((c: { name: string }) => c.name === 'Kappa Alpha Psi');
    const task = (await request(target).get('/api/tasks')).body.find((t: { title: string }) => t.title === 'Old task');
    expect(task).toMatchObject({ calendarId: kap.id, source: 'manual', priority: 'high' }); // "Fraternity" -> Kappa Alpha Psi
    expect((await request(target).get('/api/calendars')).body).toHaveLength(6); // no stray extra calendar
  });

  it('rejects a file that is not a backup, without changing anything', async () => {
    const app = makeTestApp();
    await request(app).post('/api/backup/import').send({ hello: 'world' }).expect(400);
    await request(app).post('/api/backup/import').send({ app: 'voice-todo', version: 2, exportedAt: 'x', calendars: [], tasks: [] }).expect(400);
    expect((await request(app).get('/api/tasks')).body).toHaveLength(0);
  });

  it('an import that fails halfway changes nothing (all or nothing)', async () => {
    const app = makeTestApp();
    const { body: backup } = await request(await populatedApp()).get('/api/backup/export');
    // Corrupt one reference so the database refuses it after earlier rows were already written.
    backup.timeBlocks[0].taskId = NEW_ID;
    await request(app).post('/api/backup/import').send(backup).expect(400);
    expect((await request(app).get('/api/tasks')).body).toHaveLength(0);
    expect((await request(app).get('/api/calendars')).body).toHaveLength(6); // still just the defaults, no Gym
  });
});
