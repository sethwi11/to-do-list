import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp } from './helpers';

let app: ReturnType<typeof makeTestApp>;
beforeEach(() => {
  app = makeTestApp();
});

const api = () => request(app);
const idOf = async (path: string, name: string): Promise<string> =>
  (await api().get(path)).body.find((x: { name: string }) => x.name === name).id;

const NEW_ID = '9b3e4f0a-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

describe('events', () => {
  const base = { title: 'Interview with Acme', start: '2026-11-10T14:00', end: '2026-11-10T15:00' };

  it('creates an event with defaults and stores times exactly as sent (no timezone shifting)', async () => {
    const res = await api().post('/api/events').send(base).expect(201);
    expect(res.body).toMatchObject({
      ...base,
      allDay: false,
      calendarId: null,
      recurrence: null,
      recurringEventId: null,
      source: 'manual',
    });
    const list = await api().get('/api/events').expect(200);
    expect(list.body[0]).toMatchObject(base);
  });

  it('round-trips a recurrence rule and an all-day flag', async () => {
    const recurrence = { freq: 'weekly', byWeekday: [2, 4], until: '2026-12-10', exdates: ['2026-11-26'] };
    const { body } = await api()
      .post('/api/events')
      .send({ ...base, allDay: true, start: '2026-11-10T00:00', end: '2026-11-11T00:00', recurrence })
      .expect(201);
    const fetched = (await api().get(`/api/events/${body.id}`)).body;
    expect(fetched.recurrence).toEqual(recurrence);
    expect(fetched.allDay).toBe(true);
  });

  it('validates input: end after start, real dates, safe links, known calendar', async () => {
    await api().post('/api/events').send({ ...base, end: '2026-11-10T14:00' }).expect(400);
    await api().post('/api/events').send({ ...base, start: '2026-02-30T10:00' }).expect(400);
    await api().post('/api/events').send({ ...base, link: 'javascript:alert(1)' }).expect(400);
    await api().post('/api/events').send({ ...base, calendarId: NEW_ID }).expect(400); // no such calendar
    await api().post('/api/events').send({ ...base, link: 'https://zoom.us/j/1' }).expect(201);
  });

  it('re-checks start/end together when only one of them is patched', async () => {
    const { body } = await api().post('/api/events').send(base).expect(201);
    const res = await api().patch(`/api/events/${body.id}`).send({ end: '2026-11-10T13:00' }).expect(400);
    expect(res.body.message).toMatch(/end must be after the start/);
    await api().patch(`/api/events/${body.id}`).send({ end: '2026-11-10T16:00' }).expect(200);
  });

  it('assigns a calendar and type, and leaves them unassigned when those are deleted', async () => {
    const calendarId = await idOf('/api/calendars', 'ACM');
    const typeId = await idOf('/api/event-types', 'Interview');
    const { body } = await api().post('/api/events').send({ ...base, calendarId, typeId }).expect(201);
    await api().delete(`/api/calendars/${calendarId}`).expect(204);
    await api().delete(`/api/event-types/${typeId}`).expect(204);
    const after = (await api().get(`/api/events/${body.id}`)).body;
    expect(after.calendarId).toBeNull();
    expect(after.typeId).toBeNull();
  });

  it('soft-deletes and restores (for the Undo toast)', async () => {
    const { body } = await api().post('/api/events').send(base).expect(201);
    await api().delete(`/api/events/${body.id}`).expect(204);
    await api().get(`/api/events/${body.id}`).expect(404);
    expect((await api().get('/api/events')).body).toHaveLength(0);
    await api().post(`/api/events/${body.id}/restore`).expect(200);
    await api().get(`/api/events/${body.id}`).expect(200);
  });

  it('accepts a client-chosen id, and replaying the same create does not duplicate', async () => {
    await api().post('/api/events').send({ ...base, id: NEW_ID }).expect(201);
    const again = await api().post('/api/events').send({ ...base, id: NEW_ID, title: 'Different' }).expect(201);
    expect(again.body.title).toBe('Interview with Acme'); // the original, untouched
    expect((await api().get('/api/events')).body).toHaveLength(1);
  });

  it('links a one-off override to its series', async () => {
    const { body: series } = await api()
      .post('/api/events')
      .send({ ...base, recurrence: { freq: 'daily', byWeekday: null, until: null, exdates: [] } })
      .expect(201);
    const { body: override } = await api()
      .post('/api/events')
      .send({ ...base, title: 'Moved', recurringEventId: series.id, originalStart: base.start })
      .expect(201);
    expect(override.recurringEventId).toBe(series.id);
  });
});

describe('event types and time blocks', () => {
  it('seeds the nine default event types', async () => {
    const names = (await api().get('/api/event-types')).body.map((t: { name: string }) => t.name);
    expect(names).toEqual(['Interview', 'Class', 'Exam', 'Assignment Deadline', 'School Event', 'Meeting', 'Org Event', 'Personal', 'Other']);
  });

  it('lets you add and rename event types, and rejects duplicates', async () => {
    const { body } = await api().post('/api/event-types').send({ name: 'Office hours' }).expect(201);
    await api().patch(`/api/event-types/${body.id}`).send({ name: 'Office Hours' }).expect(200);
    await api().post('/api/event-types').send({ name: 'exam' }).expect(409);
  });

  it('time blocks link to a task and deleting a block never deletes the task', async () => {
    const { body: task } = await api().post('/api/tasks').send({ title: 'Study' }).expect(201);
    const { body: block } = await api()
      .post('/api/time-blocks')
      .send({ taskId: task.id, start: '2026-11-10T09:00', end: '2026-11-10T10:30' })
      .expect(201);
    await api().delete(`/api/time-blocks/${block.id}`).expect(204);
    await api().get(`/api/tasks/${task.id}`).expect(200);
    await api().post(`/api/time-blocks/${block.id}/restore`).expect(200);
  });

  it('rejects a time block for a task that does not exist', async () => {
    await api().post('/api/time-blocks').send({ taskId: NEW_ID, start: '2026-11-10T09:00', end: '2026-11-10T10:00' }).expect(400);
  });
});

describe('semesters and courses', () => {
  const semester = { name: 'Fall 2026', startDate: '2026-08-24', endDate: '2026-12-11', excludedRanges: [{ start: '2026-11-25', end: '2026-11-29', label: 'Thanksgiving' }] };

  it('stores a semester with excluded ranges and validates the range', async () => {
    const { body } = await api().post('/api/semesters').send(semester).expect(201);
    expect(body.excludedRanges[0].label).toBe('Thanksgiving');
    expect(body.archived).toBe(false);
    await api().post('/api/semesters').send({ ...semester, endDate: '2026-08-01' }).expect(400);
    await api().patch(`/api/semesters/${body.id}`).send({ archived: true }).expect(200);
  });

  it('a course belongs to a semester and goes away with it', async () => {
    const { body: sem } = await api().post('/api/semesters').send(semester).expect(201);
    const { body: course } = await api()
      .post('/api/courses')
      .send({ semesterId: sem.id, name: 'COMP 365', code: 'COMP 365', meetingDays: [2, 4], startTime: '10:00', endTime: '11:15', color: 'dusty-blue' })
      .expect(201);
    expect(course.meetingDays).toEqual([2, 4]);
    await api().post('/api/courses').send({ semesterId: NEW_ID, name: 'x', meetingDays: [1], startTime: '10:00', endTime: '11:00' }).expect(400);
    await api().patch(`/api/courses/${course.id}`).send({ endTime: '09:00' }).expect(400); // ends before it starts
    await api().delete(`/api/semesters/${sem.id}`).expect(204);
    await api().get(`/api/courses/${course.id}`).expect(404);
  });

  it('tasks can belong to a course and keep existing when it is deleted', async () => {
    const { body: sem } = await api().post('/api/semesters').send(semester).expect(201);
    const { body: course } = await api()
      .post('/api/courses')
      .send({ semesterId: sem.id, name: 'COMP 365', meetingDays: [2], startTime: '10:00', endTime: '11:00' })
      .expect(201);
    const { body: task } = await api().post('/api/tasks').send({ title: 'Lab 3', courseId: course.id, reminders: [4320, 1440] }).expect(201);
    expect(task).toMatchObject({ courseId: course.id, reminders: [4320, 1440] });
    await api().delete(`/api/courses/${course.id}`).expect(204);
    expect((await api().get(`/api/tasks/${task.id}`)).body.courseId).toBeNull();
  });
});

describe('applications', () => {
  it('starts in Wishlist with a timeline, and logs every status change', async () => {
    const { body } = await api().post('/api/applications').send({ company: 'Acme', role: 'SWE Intern' }).expect(201);
    expect(body.status).toBe('Wishlist');
    expect(body.statusHistory.map((h: { status: string }) => h.status)).toEqual(['Wishlist']);

    await api().patch(`/api/applications/${body.id}`).send({ status: 'Applied', dateApplied: '2026-11-04' }).expect(200);
    await api().patch(`/api/applications/${body.id}`).send({ notes: 'Referred by Sam' }).expect(200); // not a status change
    const final = (await api().patch(`/api/applications/${body.id}`).send({ status: 'Interviewing' }).expect(200)).body;
    expect(final.statusHistory.map((h: { status: string }) => h.status)).toEqual(['Wishlist', 'Applied', 'Interviewing']);
    expect(final.dateApplied).toBe('2026-11-04');
  });

  it('does not log a change when the status is re-sent unchanged, and lists with history attached', async () => {
    const { body } = await api().post('/api/applications').send({ company: 'Globex', role: 'Data Intern', status: 'Applied' }).expect(201);
    await api().patch(`/api/applications/${body.id}`).send({ status: 'Applied' }).expect(200);
    const list = (await api().get('/api/applications')).body;
    expect(list[0].statusHistory).toHaveLength(1);
  });

  it('validates status, links, and emails, and deletes cleanly with its history', async () => {
    await api().post('/api/applications').send({ company: 'A', role: 'B', status: 'Ghosted' }).expect(400);
    await api().post('/api/applications').send({ company: 'A', role: 'B', jobLink: 'ftp://x' }).expect(400);
    await api().post('/api/applications').send({ company: 'A', role: 'B', contactEmail: 'nope' }).expect(400);
    const { body } = await api().post('/api/applications').send({ company: 'A', role: 'B' }).expect(201);
    await api().delete(`/api/applications/${body.id}`).expect(204);
    await api().get(`/api/applications/${body.id}`).expect(404);
  });

  it('links to events and tasks, which survive its deletion', async () => {
    const { body: app1 } = await api().post('/api/applications').send({ company: 'Acme', role: 'SWE' }).expect(201);
    const { body: ev } = await api()
      .post('/api/events')
      .send({ title: 'Acme interview', start: '2026-11-12T10:00', end: '2026-11-12T11:00', applicationId: app1.id })
      .expect(201);
    await api().delete(`/api/applications/${app1.id}`).expect(204);
    expect((await api().get(`/api/events/${ev.id}`)).body.applicationId).toBeNull();
  });
});

describe('templates', () => {
  it('seeds the three built-in templates', async () => {
    const list = (await api().get('/api/templates')).body;
    expect(list.map((t: { name: string }) => t.name).sort()).toEqual(['Exam prep', 'Interview prep', 'Org event planning']);
    expect(list.every((t: { builtIn: boolean }) => t.builtIn)).toBe(true);
    const interview = list.find((t: { name: string }) => t.name === 'Interview prep');
    expect(interview.items).toHaveLength(7);
  });

  it('built-ins can be edited but not deleted; your own templates can be both', async () => {
    const list = (await api().get('/api/templates')).body;
    const builtIn = list[0];
    await api().patch(`/api/templates/${builtIn.id}`).send({ name: 'Renamed' }).expect(200);
    const res = await api().delete(`/api/templates/${builtIn.id}`).expect(403);
    expect(res.body.message).toMatch(/can't be deleted/);

    const { body } = await api()
      .post('/api/templates')
      .send({ name: 'Trip', items: [{ id: 'a', title: 'Book flights', offsetDays: -30 }], builtIn: true }) // builtIn is ignored
      .expect(201);
    expect(body.builtIn).toBe(false);
    await api().delete(`/api/templates/${body.id}`).expect(204);
  });
});

describe('focus sessions, weekly reviews, settings', () => {
  it('logs focus sessions against a task, and they are not editable', async () => {
    const { body: task } = await api().post('/api/tasks').send({ title: 'Write essay' }).expect(201);
    const { body } = await api()
      .post('/api/focus-sessions')
      .send({ taskId: task.id, startedAt: '2026-11-04T15:00:00.000Z', durationSeconds: 1500 })
      .expect(201);
    expect((await api().get('/api/focus-sessions')).body).toHaveLength(1);
    await api().patch(`/api/focus-sessions/${body.id}`).send({ durationSeconds: 1 }).expect(404); // no PATCH route
    await api().post('/api/focus-sessions').send({ taskId: null, startedAt: 'nope', durationSeconds: 5 }).expect(400);
  });

  it('keeps one review per week', async () => {
    const { body } = await api().post('/api/weekly-reviews').send({ weekStart: '2026-11-02', notes: 'Good week' }).expect(201);
    await api().post('/api/weekly-reviews').send({ weekStart: '2026-11-02', notes: 'Again' }).expect(409);
    const updated = await api().patch(`/api/weekly-reviews/${body.id}`).send({ notes: 'Better than I thought' }).expect(200);
    expect(updated.body.notes).toBe('Better than I thought');
  });

  it('settings start at the defaults and merge partial updates', async () => {
    const initial = (await api().get('/api/settings').expect(200)).body;
    expect(initial).toMatchObject({ offerGoal: 10, offerTargetDate: '2027-05-01', focus: { focusMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 } });

    const patched = (await api().patch('/api/settings').send({ focus: { focusMinutes: 50 }, offerGoal: 12 }).expect(200)).body;
    expect(patched.focus).toMatchObject({ focusMinutes: 50, breakMinutes: 5 }); // the rest of focus is kept
    expect(patched.offerGoal).toBe(12);
    expect((await api().get('/api/settings')).body.offerGoal).toBe(12); // persisted
    await api().patch('/api/settings').send({ offerGoal: 0 }).expect(400);
    await api().patch('/api/settings').send({}).expect(400);
  });
});
