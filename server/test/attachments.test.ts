import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestAppWithDb } from './helpers';

let app: ReturnType<typeof makeTestAppWithDb>['app'];
let uploadsDir: string;
beforeEach(() => {
  ({ app, uploadsDir } = makeTestAppWithDb());
});
const api = () => request(app);

// The smallest real PNG (1x1), a PDF header, a ZIP header (which is what a .docx is).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(40)]);

const upload = (data: Buffer, filename: string) => api().post('/api/attachments').attach('file', data, { filename });
const filesOnDisk = () => fs.readdirSync(uploadsDir);

async function makeTask(title = 'A task') {
  return (await api().post('/api/tasks').send({ title }).expect(201)).body as { id: string };
}
async function makeEvent(title = 'An event') {
  return (await api().post('/api/events').send({ title, start: '2026-11-10T10:00', end: '2026-11-10T11:00' }).expect(201)).body as { id: string };
}

describe('uploading', () => {
  it('stores a file under a generated name and records what it is', async () => {
    const res = await upload(PNG, 'My Screenshot.PNG').expect(201);
    expect(res.body).toMatchObject({ filename: 'My Screenshot.PNG', mimeType: 'image/png', size: PNG.length });
    expect(res.body.path).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(filesOnDisk()).toEqual([res.body.path]);
  });

  it('decides the type itself, whatever the browser claims', async () => {
    const res = await api().post('/api/attachments').attach('file', PDF, { filename: 'notes.pdf', contentType: 'text/html' }).expect(201);
    expect(res.body.mimeType).toBe('application/pdf');
  });

  it('refuses a file whose contents are not what its name says, and leaves nothing behind', async () => {
    const res = await upload(Buffer.from('<script>alert(1)</script>'), 'cute-cat.png').expect(415);
    expect(res.body.message).toMatch(/real \.png/);
    expect(filesOnDisk()).toEqual([]);
  });

  it('refuses types that can run code, and types we cannot read, with a hint', async () => {
    const svg = await upload(Buffer.from('<svg/>'), 'x.svg').expect(415);
    expect(svg.body.error).toBe('UnsupportedType');
    const doc = await upload(Buffer.from('x'), 'old.doc').expect(415);
    expect(doc.body.message).toMatch(/\.docx or PDF/);
    expect(filesOnDisk()).toEqual([]);
  });

  it('refuses a file over 15 MB with a clear message', async () => {
    const big = Buffer.concat([PDF, Buffer.alloc(15 * 1024 * 1024)]);
    const res = await upload(big, 'huge.pdf').expect(413);
    expect(res.body.message).toMatch(/15 MB/);
    expect(filesOnDisk()).toEqual([]);
  });

  it('accepts a .docx and a .txt, and never uses the sent name as a path', async () => {
    await upload(ZIP, 'syllabus.docx').expect(201);
    const sneaky = await upload(Buffer.from('hello'), '../../etc/evil.txt').expect(201);
    expect(sneaky.body.filename).toBe('evil.txt');
    expect(filesOnDisk().every((f) => /^[0-9a-f-]{36}\.(docx|txt)$/.test(f))).toBe(true);
  });

  it('needs a file', async () => {
    await api().post('/api/attachments').expect(400);
  });
});

describe('serving', () => {
  it('serves images inline with safe headers, and anything else as a download', async () => {
    const png = (await upload(PNG, 'a.png')).body;
    const res = await api().get(`/api/attachments/${png.id}/file`).expect(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['content-disposition']).toMatch(/^inline;/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain('sandbox');
    expect(res.body).toEqual(PNG);

    const docx = (await upload(ZIP, 'notes.docx')).body;
    expect((await api().get(`/api/attachments/${docx.id}/file`)).headers['content-disposition']).toMatch(/^attachment;/);
    expect((await api().get(`/api/attachments/${png.id}/file?download=1`)).headers['content-disposition']).toMatch(/^attachment;/);
  });

  it('404s for an unknown file', async () => {
    await api().get('/api/attachments/9b3e4f0a-1c2d-4e5f-8a9b-0c1d2e3f4a5b/file').expect(404);
  });
});

describe('attaching files to items', () => {
  it('links a file to a task and an event, and lists them for each', async () => {
    const task = await makeTask();
    const event = await makeEvent();
    const file = (await upload(PDF, 'syllabus.pdf')).body;

    await api().post(`/api/attachments/${file.id}/links`).send({ ownerType: 'task', ownerId: task.id }).expect(204);
    await api().post(`/api/attachments/${file.id}/links`).send({ ownerType: 'event', ownerId: event.id }).expect(204);
    await api().post(`/api/attachments/${file.id}/links`).send({ ownerType: 'event', ownerId: event.id }).expect(204); // again: harmless

    const forTask = (await api().get(`/api/attachments?ownerType=task&ownerId=${task.id}`).expect(200)).body;
    expect(forTask).toHaveLength(1);
    expect(forTask[0]).toMatchObject({ id: file.id, filename: 'syllabus.pdf', linkCount: 2 });
  });

  it('reports a file used by one item as used once, so "delete the file too?" can be asked', async () => {
    const task = await makeTask();
    const file = (await upload(PDF, 'a.pdf')).body;
    await api().post(`/api/attachments/${file.id}/links`).send({ ownerType: 'task', ownerId: task.id });
    expect((await api().get(`/api/attachments?ownerType=task&ownerId=${task.id}`)).body[0].linkCount).toBe(1);
  });

  it('will not attach to an item that does not exist, or with a bad owner', async () => {
    const file = (await upload(PDF, 'a.pdf')).body;
    await api().post(`/api/attachments/${file.id}/links`).send({ ownerType: 'task', ownerId: '9b3e4f0a-1c2d-4e5f-8a9b-0c1d2e3f4a5b' }).expect(404);
    await api().post(`/api/attachments/${file.id}/links`).send({ ownerType: 'planet', ownerId: 'x' }).expect(400);
    await api().get('/api/attachments').expect(400);
  });

  it('detaches a file from one item without touching the others', async () => {
    const a = await makeTask('a');
    const b = await makeTask('b');
    const file = (await upload(PDF, 'a.pdf')).body;
    for (const t of [a, b]) await api().post(`/api/attachments/${file.id}/links`).send({ ownerType: 'task', ownerId: t.id });
    await api().delete(`/api/attachments/${file.id}/links/task/${a.id}`).expect(204);
    expect((await api().get(`/api/attachments?ownerType=task&ownerId=${a.id}`)).body).toEqual([]);
    expect((await api().get(`/api/attachments?ownerType=task&ownerId=${b.id}`)).body[0].linkCount).toBe(1);
    await api().delete(`/api/attachments/${file.id}/links/task/${a.id}`).expect(404);
  });
});

describe('deleting a file', () => {
  it('removes the record, the links, and the bytes', async () => {
    const task = await makeTask();
    const file = (await upload(PDF, 'a.pdf')).body;
    await api().post(`/api/attachments/${file.id}/links`).send({ ownerType: 'task', ownerId: task.id });
    await api().delete(`/api/attachments/${file.id}`).expect(204);
    expect(filesOnDisk()).toEqual([]);
    expect((await api().get(`/api/attachments?ownerType=task&ownerId=${task.id}`)).body).toEqual([]);
    await api().get(`/api/attachments/${file.id}/file`).expect(404);
    await api().delete(`/api/attachments/${file.id}`).expect(404);
  });

  it('keeps the uploads folder inside its own directory', () => {
    expect(path.isAbsolute(uploadsDir)).toBe(true);
  });
});
