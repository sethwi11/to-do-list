import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { Popup } from '@todo/shared';
import { createApp } from '../src/app';
import { openDatabase } from '../src/db/connection';
import { createPopupScheduler } from '../src/popups';
import { createRepositories } from '../src/repositories';

const setup = () => {
  const repos = createRepositories(openDatabase(':memory:'));
  const sent: Popup[] = [];
  return { repos, sent, app: createApp(repos, { uploadsDir: '/tmp', sendPopup: (p) => sent.push(p) }) };
};

describe('pop-ups from the server', () => {
  it('sends what is due this minute once, from the planned day', async () => {
    const { repos, sent, app } = setup();
    const { body: t } = await request(app).post('/api/week-templates').send({ name: 'Made-up week', effectiveFrom: '2026-09-01', days: [{ weekday: 3, wake: '07:00', bed: '22:00' }] }).expect(201);
    await request(app).post('/api/routine-blocks').send({ templateId: t.id, weekday: 3, start: '09:00', end: '10:00', title: 'Study' }).expect(201);
    let minute = '2026-11-11T08:59';
    const tick = createPopupScheduler(repos, (p) => sent.push(p), () => minute);
    expect(await tick()).toEqual([]);
    minute = '2026-11-11T09:00';
    await tick();
    await tick(); // the next check in the same minute sends nothing new
    expect(sent.map((p) => p.title)).toEqual(['Now: Study until 10:00 AM']);
  });

  it('stays quiet when pop-ups are turned off in settings', async () => {
    const { repos, sent, app } = setup();
    await request(app).patch('/api/settings').send({ popups: { enabled: false } }).expect(200);
    await request(app).post('/api/tasks').send({ title: 'Call', dueDate: '2026-11-11', dueTime: '12:00' }).expect(201);
    await createPopupScheduler(repos, (p) => sent.push(p), () => '2026-11-11T12:00')();
    expect(sent).toEqual([]);
  });

  it('sends bedtime at 2:00 AM after a late night, once', async () => {
    const { repos, sent, app } = setup();
    await request(app).post('/api/week-templates').send({ name: 'Made-up week', effectiveFrom: '2026-09-01', days: [{ weekday: 5, wake: '06:00', bed: '02:00' }] }).expect(201);
    let minute = '2026-11-14T01:59';
    const tick = createPopupScheduler(repos, (p) => sent.push(p), () => minute);
    await tick();
    expect(sent).toEqual([]);
    minute = '2026-11-14T02:00'; // Saturday, 2:00 AM: Friday's bedtime
    await tick();
    await tick();
    minute = '2026-11-14T02:01';
    await tick();
    expect(sent.map((p) => p.title)).toEqual(['Bedtime. Tomorrow starts at 6:00 AM']);
  });

  it('sends the Sunday review reminder at 8:30 PM only when that setting is on', async () => {
    const { repos, sent, app } = setup();
    const tick = createPopupScheduler(repos, (p) => sent.push(p), () => '2026-11-08T20:30');
    await tick();
    expect(sent).toEqual([]);
    await request(app).patch('/api/settings').send({ sundayReviewReminder: true }).expect(200);
    await tick();
    await tick();
    expect(sent.map((p) => [p.title, p.url])).toEqual([['Sunday review: look back on the week and set three priorities', '/review']]);
  });

  it('sends a test pop-up on request, and says so when pop-ups are off in this server', async () => {
    const { sent, app } = setup();
    await request(app).post('/api/popups/test').expect(204);
    expect(sent).toHaveLength(1);
    const quiet = createApp(createRepositories(openDatabase(':memory:')), { uploadsDir: '/tmp' });
    await request(quiet).post('/api/popups/test').expect(409);
  });
});
