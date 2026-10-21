import { describe, expect, it } from 'vitest';
import { CreateTaskInputSchema, UpdateTaskInputSchema } from '../src';

describe('CreateTaskInputSchema', () => {
  it('accepts a minimal task (title only)', () => {
    expect(CreateTaskInputSchema.safeParse({ title: 'Finish COMP 365 lab' }).success).toBe(true);
  });

  it('trims the title and rejects a blank one', () => {
    expect(CreateTaskInputSchema.parse({ title: '  Email Valencia  ' }).title).toBe('Email Valencia');
    expect(CreateTaskInputSchema.safeParse({ title: '   ' }).success).toBe(false);
  });

  it('rejects impossible calendar dates and malformed times', () => {
    expect(CreateTaskInputSchema.safeParse({ title: 'x', dueDate: '2026-02-30' }).success).toBe(false);
    expect(CreateTaskInputSchema.safeParse({ title: 'x', dueTime: '25:00' }).success).toBe(false);
    expect(CreateTaskInputSchema.safeParse({ title: 'x', dueDate: '2026-10-24', dueTime: '09:30' }).success).toBe(true);
  });

  it('rejects unknown enum values', () => {
    expect(CreateTaskInputSchema.safeParse({ title: 'x', priority: 'urgent' }).success).toBe(false);
  });
});

describe('UpdateTaskInputSchema', () => {
  it('allows null to clear a field', () => {
    expect(UpdateTaskInputSchema.parse({ dueDate: null })).toEqual({ dueDate: null });
  });

  it('rejects an empty patch', () => {
    expect(UpdateTaskInputSchema.safeParse({}).success).toBe(false);
  });
});
