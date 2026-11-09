import { describe, expect, it } from 'vitest';
import { BACKUP_VERSION, BackupSchema, upgradeBackup } from '../src';

// Shaped like a real export from the original to-do app (version 1).
const v1 = {
  app: 'voice-todo',
  version: 1,
  exportedAt: '2026-11-03T12:00:00.000Z',
  categories: [
    { id: '11111111-1111-4111-8111-111111111111', name: 'School', color: 'blue', sortOrder: 1024, createdAt: '2026-11-02T00:00:00.000Z' },
    { id: '22222222-2222-4222-8222-222222222222', name: 'Work', color: 'amber', sortOrder: 2048, createdAt: '2026-11-02T00:00:00.000Z' },
    { id: '44444444-4444-4444-8444-444444444444', name: 'Fraternity', color: 'purple', sortOrder: 4096, createdAt: '2026-11-02T00:00:00.000Z' },
    { id: '55555555-5555-4555-8555-555555555555', name: 'Gym', color: 'pink', sortOrder: 6144, createdAt: '2026-11-03T00:00:00.000Z' },
  ],
  tasks: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      title: 'Finish COMP 365 lab',
      notes: null,
      dueDate: '2026-11-06',
      dueTime: null,
      priority: 'high',
      categoryId: '11111111-1111-4111-8111-111111111111',
      status: 'todo',
      subtasks: [{ id: 'a', title: 'Part 1', done: true }],
      recurrence: 'weekly',
      estimatedMinutes: 90,
      source: 'brain-dump',
      sourceSnippet: 'finish my lab by Friday',
      sortOrder: 1024,
      createdAt: '2026-11-02T00:00:00.000Z',
      updatedAt: '2026-11-02T00:00:00.000Z',
      completedAt: null,
      nextOccurrenceId: null,
    },
  ],
};

describe('upgradeBackup', () => {
  it('turns a version 1 file into a valid current backup without losing tasks', () => {
    const parsed = BackupSchema.parse(upgradeBackup(v1));
    expect(parsed.version).toBe(BACKUP_VERSION);
    // Same colors and order the database upgrade produces: defaults by their palette color, your own after them.
    expect(parsed.calendars.map((c) => [c.name, c.color, c.sortOrder])).toEqual([
      ['School', 'dusty-blue', 1024],
      ['Work', 'slate', 2048],
      ['Kappa Alpha Psi', 'crimson', 5120], // "Fraternity" was renamed when lists became calendars
      ['Gym', 'crimson', 7168], // your own calendar: kept, after the defaults, 'pink' translated
    ]);
    const task = parsed.tasks[0]!;
    expect(task).toMatchObject({
      title: 'Finish COMP 365 lab',
      calendarId: '11111111-1111-4111-8111-111111111111',
      recurrence: 'weekly',
      source: 'manual', // 'brain-dump' no longer exists
      courseId: null,
      reminders: [],
      rollsOver: true, // repeating tasks roll over unless turned off
      repeatDays: [],
    });
    expect(task.subtasks).toHaveLength(1);
    expect('categoryId' in task).toBe(false);
    expect(parsed.events).toEqual([]);
  });

  it('reads a version 2 file: the routine tables are empty and missing settings keep their current value', () => {
    const v2 = { app: 'voice-todo', version: 2, exportedAt: '2026-11-03T12:00:00.000Z', calendars: [], tasks: [], settings: { offerGoal: 5 } };
    const parsed = BackupSchema.parse(upgradeBackup(v2));
    expect(parsed).toMatchObject({ version: BACKUP_VERSION, weekTemplates: [], routineBlocks: [], routineOverrides: [], settings: { offerGoal: 5 } });
    expect(parsed.settings && 'quotes' in parsed.settings).toBe(false);
  });

  it('leaves non-v1 input alone, so real validation errors surface normally', () => {
    expect(upgradeBackup({ hello: 'world' })).toEqual({ hello: 'world' });
    expect(upgradeBackup(null)).toBeNull();
    expect(BackupSchema.safeParse(upgradeBackup({ hello: 'world' })).success).toBe(false);
  });
});
