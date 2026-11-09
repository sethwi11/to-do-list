import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp } from './helpers';

let app: ReturnType<typeof makeTestApp>;
beforeEach(() => {
  app = makeTestApp();
});
const api = () => request(app);
const NOW = '2026-11-10T12:00:00.000Z';

describe('expenses', () => {
  it('starts with the nine categories, which you can add to and rename', async () => {
    const list = (await api().get('/api/expense-categories')).body;
    expect(list.map((c: { name: string }) => c.name)).toEqual(['Food', 'Eating out', 'Gas and transport', 'Shopping', 'Subscriptions', 'School', 'Going out', 'Business (real estate)', 'Other']);
    const { body: made } = await api().post('/api/expense-categories').send({ name: 'Books' }).expect(201);
    await api().patch(`/api/expense-categories/${made.id}`).send({ name: 'Course books' }).expect(200);
    await api().post('/api/expense-categories').send({ name: 'food' }).expect(409); // names are unique, ignoring case
  });

  it('stores whole cents with defaults, rejects anything that is not a positive whole number of cents, and checks the date and category', async () => {
    const food = (await api().get('/api/expense-categories')).body[0].id;
    const { body } = await api().post('/api/expenses').send({ amountCents: 1250, what: 'Lunch', date: '2026-11-10', categoryId: food }).expect(201);
    expect(body).toMatchObject({ amountCents: 1250, kind: 'need', recurring: false, categoryId: food });
    for (const amountCents of [0, -5, 12.5, 2_000_000_000]) await api().post('/api/expenses').send({ amountCents, what: 'x', date: '2026-11-10' }).expect(400);
    await api().post('/api/expenses').send({ amountCents: 100, what: 'x', date: '2026-02-30' }).expect(400);
    await api().post('/api/expenses').send({ amountCents: 100, what: '  ', date: '2026-11-10' }).expect(400);
    await api().post('/api/expenses').send({ amountCents: 100, what: 'x', date: '2026-11-10', kind: 'maybe' }).expect(400);
    await api().post('/api/expenses').send({ amountCents: 100, what: 'x', date: '2026-11-10', categoryId: '9b3e4f0a-1c2d-4e5f-8a9b-0c1d2e3f4a5b' }).expect(400); // no such category
  });

  it('can be edited, deleted and restored (Undo), and deleting a category keeps the expense', async () => {
    const cat = (await api().post('/api/expense-categories').send({ name: 'Books' })).body;
    const { body: e } = await api().post('/api/expenses').send({ amountCents: 4000, what: 'Textbook', date: '2026-11-10', categoryId: cat.id, kind: 'want' }).expect(201);
    await api().patch(`/api/expenses/${e.id}`).send({ amountCents: 4500 }).expect(200);
    await api().delete(`/api/expenses/${e.id}`).expect(204);
    expect((await api().get('/api/expenses')).body).toHaveLength(0);
    await api().post(`/api/expenses/${e.id}/restore`).expect(200);
    await api().delete(`/api/expense-categories/${cat.id}`).expect(204);
    expect((await api().get(`/api/expenses/${e.id}`)).body).toMatchObject({ amountCents: 4500, categoryId: null });
  });
});

describe('goals, holdings and moves', () => {
  it('validates goals and holdings', async () => {
    await api().post('/api/savings-goals').send({ name: 'A house', targetCents: 0 }).expect(400);
    await api().post('/api/savings-goals').send({ name: 'A house', targetCents: 1_000_000 }).expect(201);
    await api().post('/api/holdings').send({ name: 'Fund', type: 'bond', valueCents: 0, valueUpdatedOn: '2026-11-10' }).expect(400);
    const { body } = await api().post('/api/holdings').send({ name: 'Fund', type: 'etf', valueCents: 0, valueUpdatedOn: '2026-11-10' }).expect(201);
    expect(body).toMatchObject({ valueCents: 0, monthlyTargetCents: null });
    await api().patch(`/api/holdings/${body.id}`).send({ valueCents: 52_000, valueUpdatedOn: '2026-11-11' }).expect(200);
  });

  it('writes a move from a leftover in one batch, and the batch removes it again (Undo)', async () => {
    const goal = (await api().post('/api/savings-goals').send({ name: 'A house', targetCents: 1_000_000 })).body;
    const row = (id: string, toType: string, toId: string | null, amountCents: number) => ({ id, date: '2026-11-10', periodStart: '2026-10-01', toType, toId, amountCents, note: null, createdAt: NOW });
    const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
    const put = [row(ids[0]!, 'goal', goal.id, 20_000), row(ids[1]!, 'kept', null, 5_000)];
    await api().post('/api/money-moves/batch').send({ put, remove: [] }).expect(200);
    expect((await api().get('/api/money-moves')).body).toHaveLength(2);
    await api().post('/api/money-moves/batch').send({ put: [], remove: ids }).expect(200);
    expect((await api().get('/api/money-moves')).body).toHaveLength(0);
  });

  it('a goal or holding move needs its id, and "kept" has none', async () => {
    const base = { date: '2026-11-10', amountCents: 100 };
    await api().post('/api/money-moves').send({ ...base, toType: 'goal', toId: null }).expect(400);
    await api().post('/api/money-moves').send({ ...base, toType: 'kept', toId: '9b3e4f0a-1c2d-4e5f-8a9b-0c1d2e3f4a5b' }).expect(400);
    await api().post('/api/money-moves').send({ ...base, toType: 'kept', toId: null }).expect(201);
  });

  it('keeps the budget in the settings, with none set to begin with', async () => {
    expect((await api().get('/api/settings')).body.budget).toEqual({ amountCents: 0, period: 'month' });
    await api().patch('/api/settings').send({ budget: { amountCents: 50_000 } }).expect(200);
    expect((await api().get('/api/settings')).body.budget).toEqual({ amountCents: 50_000, period: 'month' });
    await api().patch('/api/settings').send({ budget: { period: 'year' } }).expect(400);
  });
});

describe('money in export and import', () => {
  it('round-trips every money table, and matches categories by name rather than duplicating the starting nine', async () => {
    const mine = (await api().post('/api/expense-categories').send({ name: 'Books' })).body;
    const food = (await api().get('/api/expense-categories')).body[0];
    await api().post('/api/expenses').send({ amountCents: 1250, what: 'Lunch', date: '2026-11-10', categoryId: food.id, kind: 'want', recurring: true }).expect(201);
    await api().post('/api/expenses').send({ amountCents: 4000, what: 'Textbook', date: '2026-11-09', categoryId: mine.id }).expect(201);
    const goal = (await api().post('/api/savings-goals').send({ name: 'A house', targetCents: 1_000_000 })).body;
    const holding = (await api().post('/api/holdings').send({ name: 'Fund', type: 'etf', valueCents: 52_000, valueUpdatedOn: '2026-11-10', monthlyTargetCents: 5_000 })).body;
    await api().post('/api/money-moves').send({ date: '2026-11-10', toType: 'goal', toId: goal.id, amountCents: 20_000, periodStart: '2026-10-01' }).expect(201);
    await api().post('/api/money-moves').send({ date: '2026-11-10', toType: 'holding', toId: holding.id, amountCents: 5_000 }).expect(201);

    const backup = (await api().get('/api/backup/export')).body;
    expect(backup).toMatchObject({ version: 7 });
    const target = makeTestApp();
    await request(target).post('/api/backup/import').send(backup).expect(200);

    const names = (await request(target).get('/api/expense-categories')).body.map((c: { name: string }) => c.name);
    expect(names).toHaveLength(10); // the nine plus Books, no copies
    const expenses = (await request(target).get('/api/expenses')).body;
    expect(expenses.map((e: { what: string; amountCents: number; kind: string; recurring: boolean }) => [e.what, e.amountCents, e.kind, e.recurring])).toEqual([['Lunch', 1250, 'want', true], ['Textbook', 4000, 'need', false]]);
    const targetCategories = (await request(target).get('/api/expense-categories')).body;
    expect(targetCategories.find((c: { id: string }) => c.id === expenses[0].categoryId).name).toBe('Food');
    expect((await request(target).get('/api/savings-goals')).body[0]).toMatchObject({ name: 'A house', targetCents: 1_000_000 });
    expect((await request(target).get('/api/holdings')).body[0]).toMatchObject({ valueCents: 52_000, monthlyTargetCents: 5_000 });
    expect((await request(target).get('/api/money-moves')).body.map((m: { toType: string; amountCents: number }) => [m.toType, m.amountCents])).toEqual([['goal', 20_000], ['holding', 5_000]]);
  });

  it('still reads a version 5 file, with the money tables empty', async () => {
    const target = makeTestApp();
    await request(target).post('/api/backup/import').send({ app: 'voice-todo', version: 5, exportedAt: NOW, calendars: [], tasks: [] }).expect(200);
    expect((await request(target).get('/api/expenses')).body).toEqual([]);
  });
});
