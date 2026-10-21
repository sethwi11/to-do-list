import type { Task } from '@todo/shared';
import { describe, expect, it } from 'vitest';
import { filterForView, sortTasks } from './taskViews';

let n = 0;
function task(overrides: Partial<Task>): Task {
  n++;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    title: `Task ${n}`,
    notes: null,
    dueDate: null,
    dueTime: null,
    priority: 'medium',
    categoryId: null,
    status: 'todo',
    subtasks: [],
    recurrence: 'none',
    estimatedMinutes: null,
    source: 'manual',
    sourceSnippet: null,
    sortOrder: n,
    createdAt: '2026-10-21T00:00:00.000Z',
    updatedAt: '2026-10-21T00:00:00.000Z',
    completedAt: null,
    ...overrides,
  };
}

describe('filterForView', () => {
  it('today shows only tasks due today', () => {
    const tasks = [task({ dueDate: '2026-10-21' }), task({ dueDate: '2026-10-22' }), task({})];
    expect(filterForView(tasks, 'today', '2026-10-21')).toHaveLength(1);
    expect(filterForView(tasks, 'all', '2026-10-21')).toHaveLength(3);
  });
});

describe('sortTasks', () => {
  it('orders open before done, then by date (undated last), then priority', () => {
    const done = task({ title: 'done', status: 'done', dueDate: '2026-10-01' });
    const undated = task({ title: 'undated' });
    const laterHigh = task({ title: 'laterHigh', dueDate: '2026-10-25', priority: 'high' });
    const soonLow = task({ title: 'soonLow', dueDate: '2026-10-22', priority: 'low' });
    const soonHigh = task({ title: 'soonHigh', dueDate: '2026-10-22', priority: 'high' });

    expect(sortTasks([done, undated, laterHigh, soonLow, soonHigh]).map((t) => t.title)).toEqual([
      'soonHigh',
      'soonLow',
      'laterHigh',
      'undated',
      'done',
    ]);
  });
});
