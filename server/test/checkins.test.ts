import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeTestApp } from './helpers';

describe('check-ins', () => {
  it('keeps a snapshot of the item, so later template edits never change history', async () => {
    const app = makeTestApp();
    const { body: t } = await request(app).post('/api/week-templates').send({ name: 'W', effectiveFrom: '2026-09-01' }).expect(201);
    const { body: b } = await request(app).post('/api/routine-blocks').send({ templateId: t.id, weekday: 3, start: '06:20', end: '07:50', title: 'Gym' }).expect(201);
    const { body: c } = await request(app).post('/api/check-ins').send({ date: '2026-11-11', itemKey: `routine:${b.id}@2026-11-11`, title: 'Gym', calendarId: null, minutes: 90, status: 'done' }).expect(201);
    expect(c).toMatchObject({ usedAlt: false, learned: null });
    await request(app).patch(`/api/routine-blocks/${b.id}`).send({ title: 'Morning run', end: '07:00' }).expect(200);
    expect((await request(app).get(`/api/check-ins/${c.id}`)).body).toMatchObject({ title: 'Gym', minutes: 90 });
  });

  it('allows one per item per day, and changing or clearing it', async () => {
    const app = makeTestApp();
    const item = { date: '2026-11-11', itemKey: 'event:x', title: 'Study', calendarId: null, minutes: 60, status: 'part' };
    const { body: c } = await request(app).post('/api/check-ins').send(item).expect(201);
    await request(app).post('/api/check-ins').send(item).expect(409);
    await request(app).patch(`/api/check-ins/${c.id}`).send({ status: 'done', learned: 'How attention heads work' }).expect(200);
    await request(app).post('/api/check-ins').send({ ...item, status: 'maybe' }).expect(400);
    await request(app).delete(`/api/check-ins/${c.id}`).expect(204);
  });
});

describe('soundtracks from a folder', () => {
  it('lists only audio files and plays only those, never anything outside the folder', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-tracks-'));
    fs.writeFileSync(path.join(dir, 'b-side.mp3'), 'x');
    fs.writeFileSync(path.join(dir, 'a-side.m4a'), 'x');
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'x');
    const app = makeTestApp();
    await request(app).get('/api/soundtracks/lofi/tracks').expect(404); // no folder yet
    await request(app).patch('/api/settings').send({ soundtracks: [{ name: 'lofi', link: null, folder: dir }] }).expect(200);
    expect((await request(app).get('/api/soundtracks/lofi/tracks')).body).toEqual(['a-side.m4a', 'b-side.mp3']);
    await request(app).get('/api/soundtracks/lofi/tracks/b-side.mp3').expect(200);
    await request(app).get('/api/soundtracks/lofi/tracks/notes.txt').expect(404);
    await request(app).get('/api/soundtracks/lofi/tracks/..%2F..%2Fetc%2Fpasswd').expect(404);
  });

  it('accepts only web links for a soundtrack', async () => {
    const app = makeTestApp();
    await request(app).patch('/api/settings').send({ soundtracks: [{ name: 'lofi', link: 'javascript:alert(1)', folder: null }] }).expect(400);
    await request(app).patch('/api/settings').send({ soundtracks: [{ name: 'lofi', link: 'https://example.com/lofi', folder: null }] }).expect(200);
  });
});
