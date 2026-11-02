import Anthropic from '@anthropic-ai/sdk';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { ExtractionResult } from '@todo/shared';
import { ClaudeAiService } from '../src/ai/ClaudeAiService';
import { toStructuredOutputSchema } from '../src/ai/jsonSchema';
import { ExtractionResultSchema } from '@todo/shared';
import { makeTestApp } from './helpers';

/** A fake Anthropic client whose beta.messages.create returns (or throws) what we tell it to. */
function mockClaude(impl: () => unknown) {
  const create = vi.fn(async (_params: unknown) => impl());
  const client = { beta: { messages: { create } } } as unknown as Anthropic;
  return { client, create };
}

const reply = (result: ExtractionResult, stop_reason = 'end_turn') => ({
  stop_reason,
  content: [{ type: 'text', text: JSON.stringify(result) }],
});

const baseRequest = {
  text: 'I need to finish my COMP 365 lab by Friday, email Valencia tomorrow morning, and mark the grocery one done',
  mode: 'voice',
  clientNow: { date: '2026-11-02', time: '09:15', timezone: 'America/New_York' },
  existingTasks: [
    { id: 'groceries-id', title: 'Pick up groceries', dueDate: null, dueTime: null, status: 'todo' },
    { id: 'gym-id', title: 'Go to the gym', dueDate: '2026-11-02', dueTime: null, status: 'todo' },
  ],
  categories: ['School', 'Work', 'Personal'],
};

const task = (title: string, extra: Partial<ExtractionResult['tasks'][number]> = {}) => ({
  title,
  notes: null,
  dueDate: null,
  dueTime: null,
  priority: 'medium' as const,
  category: null,
  subtasks: [],
  recurrence: 'none' as const,
  estimatedMinutes: null,
  confidence: 0.9,
  sourceSnippet: title,
  ...extra,
});

describe('POST /api/ai/extract', () => {
  it('returns 503 with setup instructions when no API key is configured', async () => {
    const res = await request(makeTestApp(null)).post('/api/ai/extract').send(baseRequest).expect(503);
    expect(res.body.message).toMatch(/ANTHROPIC_API_KEY/);
  });

  it('rejects an invalid request body before calling Claude', async () => {
    const { client, create } = mockClaude(() => ({}));
    await request(makeTestApp(new ClaudeAiService(client)))
      .post('/api/ai/extract')
      .send({ ...baseRequest, text: '' })
      .expect(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('sends a cached system prompt, a JSON schema, and the date table; returns sanitized results', async () => {
    const { client, create } = mockClaude(() =>
      reply({
        tasks: [
          task('Finish COMP 365 lab', { dueDate: '2026-11-06', priority: 'high', category: 'school' }),
          task('Email Valencia', { dueDate: '2026-11-03', dueTime: '09:00', category: 'Clubs' }),
          task('Go to the gym'), // duplicate of an existing task: must be dropped
          task('email valencia.'), // duplicate within the response: must be dropped
        ],
        actions: [
          { type: 'complete', targetTaskId: 'groceries-id', changes: null, queryRange: null, description: 'Mark "Pick up groceries" as done', confidence: 0.95 },
          { type: 'delete', targetTaskId: 'made-up-id', changes: null, queryRange: null, description: 'Delete something', confidence: 0.9 },
        ],
        spokenReply: 'Got it, I found 2 tasks.',
        clarifyingQuestion: null,
      }),
    );

    const res = await request(makeTestApp(new ClaudeAiService(client))).post('/api/ai/extract').send(baseRequest).expect(200);

    // What we sent to Claude
    const params = create.mock.calls[0]![0] as unknown as Record<string, any>;
    expect(params.model).toBe('claude-sonnet-5-5');
    expect(params.output_config.format.type).toBe('json_schema');
    expect(params.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(params.messages[0].content).toContain('"Friday" / "this Friday": 2026-11-06');
    expect(params.messages[0].content).toContain('id=groceries-id');

    // What came back after sanitizing
    expect(res.body.tasks.map((t: { title: string }) => t.title)).toEqual(['Finish COMP 365 lab', 'Email Valencia']);
    expect(res.body.tasks[0].category).toBe('School'); // case-insensitive match to a real list
    expect(res.body.tasks[1].category).toBeNull(); // invented list name dropped
    expect(res.body.actions).toHaveLength(1); // action with an unknown id dropped
    expect(res.body.actions[0].targetTaskId).toBe('groceries-id');
  });

  it('returns 502 when Claude output fails zod validation', async () => {
    const { client } = mockClaude(() => ({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: JSON.stringify({ tasks: [{ title: 'x', confidence: 7 }] }) }],
    }));
    const res = await request(makeTestApp(new ClaudeAiService(client))).post('/api/ai/extract').send(baseRequest).expect(502);
    expect(res.body.message).toMatch(/unexpected shape/);
  });

  it('maps a refusal to 422 and a rate limit to 429', async () => {
    const refusal = mockClaude(() => ({ stop_reason: 'refusal', content: [] }));
    await request(makeTestApp(new ClaudeAiService(refusal.client))).post('/api/ai/extract').send(baseRequest).expect(422);

    const limited = mockClaude(() => {
      throw new Anthropic.RateLimitError(429, undefined, 'rate limited', new Headers());
    });
    await request(makeTestApp(new ClaudeAiService(limited.client))).post('/api/ai/extract').send(baseRequest).expect(429);
  });
});

describe('toStructuredOutputSchema', () => {
  it('closes every object and strips unsupported keywords but keeps enums', () => {
    const json = JSON.stringify(toStructuredOutputSchema(ExtractionResultSchema));
    expect(json).not.toMatch(/"pattern"|"minimum"|"maximum"|"\$schema"/);
    expect(json).toContain('"enum":["low","medium","high"]');
    const objects = json.match(/"type":"object"/g)!.length;
    const closed = json.match(/"additionalProperties":false/g)!.length;
    expect(closed).toBe(objects);
  });
});

describe('backup export/import', () => {
  it('round-trips data and merges without duplicating', async () => {
    const source = makeTestApp();
    await request(source).post('/api/tasks').send({ title: 'Read chapter 4' });
    await request(source).post('/api/categories').send({ name: 'Gym' });
    const { body: backup } = await request(source).get('/api/backup/export').expect(200);
    expect(backup).toMatchObject({ app: 'voice-todo', version: 1 });

    const target = makeTestApp();
    const first = await request(target).post('/api/backup/import').send(backup).expect(200);
    expect(first.body).toEqual({ categoriesAdded: 1, tasksAdded: 1, tasksUpdated: 0 }); // default lists matched by name
    const again = await request(target).post('/api/backup/import').send(backup).expect(200);
    expect(again.body).toEqual({ categoriesAdded: 0, tasksAdded: 0, tasksUpdated: 1 });
    expect((await request(target).get('/api/tasks')).body).toHaveLength(1);
  });

  it('rejects a file that is not a backup', async () => {
    await request(makeTestApp()).post('/api/backup/import').send({ hello: 'world' }).expect(400);
  });
});
