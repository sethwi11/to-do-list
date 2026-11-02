import { describe, expect, it } from 'vitest';
import { buildDateContext, ExtractionResultSchema, ExtractRequestSchema, lastDayOfMonth } from '../src';

describe('buildDateContext (date resolution table)', () => {
  // Monday, November 2, 2026
  const ctx = buildDateContext('2026-11-02');

  it('resolves weekday names to the next occurrence', () => {
    expect(ctx).toContain('Today: Monday 2026-11-02');
    expect(ctx).toContain('Tomorrow: Tuesday 2026-11-03');
    expect(ctx).toContain('"Friday" / "this Friday": 2026-11-06');
    expect(ctx).toContain('"next Friday": 2026-11-13');
    expect(ctx).toContain('"Monday" / "this Monday": 2026-11-02');
  });

  it('resolves week and month phrases', () => {
    expect(ctx).toContain('"end of the week": 2026-11-06');
    expect(ctx).toContain('"this weekend": 2026-11-07');
    expect(ctx).toContain('"next week" (start): 2026-11-09');
    expect(ctx).toContain('"end of the month": 2026-11-30');
  });

  it('handles weekends and month ends', () => {
    const sat = buildDateContext('2026-11-07');
    expect(sat).toContain('"end of the week": 2026-11-13'); // next Friday
    expect(sat).toContain('"next week" (start): 2026-11-09');
    expect(lastDayOfMonth('2028-02-10')).toBe('2028-02-29');
  });
});

describe('extraction schemas', () => {
  const validResult = {
    tasks: [
      {
        title: 'Finish COMP 365 lab',
        notes: null,
        dueDate: '2026-11-06',
        dueTime: null,
        priority: 'high',
        category: 'School',
        subtasks: [],
        recurrence: 'none',
        estimatedMinutes: 90,
        confidence: 0.92,
        sourceSnippet: 'I need to finish my COMP 365 lab by Friday',
      },
    ],
    actions: [],
    spokenReply: 'Got it, I found 1 task.',
    clarifyingQuestion: null,
  };

  it('accepts a well-formed result', () => {
    expect(ExtractionResultSchema.safeParse(validResult).success).toBe(true);
  });

  it('rejects out-of-range confidence, bad dates, and unknown action types', () => {
    const bad = (patch: object) => ({ ...validResult, ...patch });
    expect(ExtractionResultSchema.safeParse(bad({ tasks: [{ ...validResult.tasks[0], confidence: 1.4 }] })).success).toBe(false);
    expect(ExtractionResultSchema.safeParse(bad({ tasks: [{ ...validResult.tasks[0], dueDate: 'Friday' }] })).success).toBe(false);
    expect(
      ExtractionResultSchema.safeParse(
        bad({ actions: [{ type: 'archive', targetTaskId: 'x', changes: null, queryRange: null, description: '', confidence: 1 }] }),
      ).success,
    ).toBe(false);
  });

  it('fills request defaults', () => {
    const req = ExtractRequestSchema.parse({
      text: 'email Valencia tomorrow',
      mode: 'voice',
      clientNow: { date: '2026-11-02', time: '09:15', timezone: 'America/New_York' },
    });
    expect(req).toMatchObject({ recentContext: [], existingTasks: [], alreadyExtracted: [], pendingQuestion: null });
  });

  it('rejects empty text', () => {
    expect(
      ExtractRequestSchema.safeParse({
        text: '   ',
        mode: 'voice',
        clientNow: { date: '2026-11-02', time: '09:15', timezone: 'UTC' },
      }).success,
    ).toBe(false);
  });
});
