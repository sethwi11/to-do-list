import type { Task } from '@todo/shared';
import { describe, expect, it } from 'vitest';
import { applyFilters, DEFAULT_FILTERS, sortTasks } from './filters';
import { computeMove } from './ordering';
import { inView } from './views';

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
    sortOrder: n * 1024,
    createdAt: '2026-11-02T00:00:00.000Z',
    updatedAt: '2026-11-02T00:00:00.000Z',
    completedAt: null,
    nextOccurrenceId: null,
    ...overrides,
  };
}

const today = '2026-11-02';

describe('inView', () => {
  it('upcoming = the next 7 days, excluding today', () => {
    const view = { type: 'smart', id: 'upcoming' } as const;
    expect(inView(task({ dueDate: today }), view, today)).toBe(false);
    expect(inView(task({ dueDate: '2026-11-03' }), view, today)).toBe(true);
    expect(inView(task({ dueDate: '2026-11-09' }), view, today)).toBe(true);
    expect(inView(task({ dueDate: '2026-11-10' }), view, today)).toBe(false);
  });

  it('overdue = open tasks due before today', () => {
    const view = { type: 'smart', id: 'overdue' } as const;
    expect(inView(task({ dueDate: '2026-11-01' }), view, today)).toBe(true);
    expect(inView(task({ dueDate: '2026-11-01', status: 'done' }), view, today)).toBe(false);
    expect(inView(task({ dueDate: null }), view, today)).toBe(false);
  });

  it('category views match by id', () => {
    const t = task({ categoryId: 'abc' });
    expect(inView(t, { type: 'category', id: 'abc' }, today)).toBe(true);
    expect(inView(t, { type: 'category', id: 'xyz' }, today)).toBe(false);
  });
});

describe('applyFilters', () => {
  it('searches titles, notes, and subtask titles case-insensitively', () => {
    const tasks = [
      task({ title: 'Lab report' }),
      task({ title: 'x', notes: 'remember the LAB goggles' }),
      task({ title: 'y', subtasks: [{ id: 's', title: 'lab part 2', done: false }] }),
      task({ title: 'Groceries' }),
    ];
    expect(applyFilters(tasks, { ...DEFAULT_FILTERS, query: 'lab' }, today)).toHaveLength(3);
  });

  it('combines filters with AND', () => {
    const tasks = [
      task({ priority: 'high', dueDate: today }),
      task({ priority: 'high', dueDate: null }),
      task({ priority: 'low', dueDate: today }),
    ];
    expect(applyFilters(tasks, { ...DEFAULT_FILTERS, priority: 'high', due: 'today' }, today)).toHaveLength(1);
    expect(applyFilters(tasks, { ...DEFAULT_FILTERS, due: 'none' }, today)).toHaveLength(1);
  });
});

describe('sortTasks', () => {
  it('due mode: by date (undated last), then priority', () => {
    const undated = task({ title: 'undated' });
    const laterHigh = task({ title: 'laterHigh', dueDate: '2026-11-05', priority: 'high' });
    const soonLow = task({ title: 'soonLow', dueDate: '2026-11-03', priority: 'low' });
    const soonHigh = task({ title: 'soonHigh', dueDate: '2026-11-03', priority: 'high' });
    expect(sortTasks([undated, laterHigh, soonLow, soonHigh], 'due').map((t) => t.title)).toEqual([
      'soonHigh',
      'soonLow',
      'laterHigh',
      'undated',
    ]);
    expect(sortTasks([undated, laterHigh, soonLow, soonHigh], 'priority').map((t) => t.title)).toEqual([
      'soonHigh',
      'laterHigh',
      'undated',
      'soonLow',
    ]);
  });
});

describe('computeMove', () => {
  it('uses the midpoint between neighbors', () => {
    const a = task({ sortOrder: 1000 });
    const b = task({ sortOrder: 2000 });
    expect(computeMove([a, b], 'x', a, b)).toEqual({ kind: 'single', sortOrder: 1500 });
  });

  it('extends past the ends of the list', () => {
    const a = task({ sortOrder: 1000 });
    expect(computeMove([a], 'x', a, undefined)).toEqual({ kind: 'single', sortOrder: 2024 });
    expect(computeMove([a], 'x', undefined, a)).toEqual({ kind: 'single', sortOrder: -24 });
  });

  it('rebalances when the gap is exhausted', () => {
    const a = task({ sortOrder: 1 });
    const b = task({ sortOrder: 1 + 1e-9 });
    const moved = task({ sortOrder: 5 });
    const result = computeMove([a, b, moved], moved.id, a, b);
    expect(result).toEqual({ kind: 'rebalance', orderedIds: [a.id, moved.id, b.id] });
  });
});
