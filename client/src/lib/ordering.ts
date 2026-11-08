import type { Task } from '@todo/shared';

const GAP = 1024;
/** Below this gap, floating-point midpoints are running out of precision. */
const MIN_GAP = 1e-6;

export type MoveResult =
  | { kind: 'single'; sortOrder: number }
  /** Gaps are exhausted: renumber every task in this global order. */
  | { kind: 'rebalance'; orderedIds: string[] };

/** Computes a new sortOrder when `movedId` is dropped between `before` and `after` (its new neighbors in the visible list; either may be missing at the ends). */
export function computeMove(
  allTasks: Task[],
  movedId: string,
  before: Task | undefined,
  after: Task | undefined,
): MoveResult {
  if (before && after) {
    if (after.sortOrder - before.sortOrder > MIN_GAP) {
      return { kind: 'single', sortOrder: (before.sortOrder + after.sortOrder) / 2 };
    }
    // Rebalance: global order with the moved task placed right after `before`.
    const ordered = [...allTasks].sort((a, b) => a.sortOrder - b.sortOrder).filter((t) => t.id !== movedId);
    const at = ordered.findIndex((t) => t.id === before.id) + 1;
    const ids = ordered.map((t) => t.id);
    ids.splice(at, 0, movedId);
    return { kind: 'rebalance', orderedIds: ids };
  }
  if (before) return { kind: 'single', sortOrder: before.sortOrder + GAP };
  if (after) return { kind: 'single', sortOrder: after.sortOrder - GAP };
  return { kind: 'single', sortOrder: 0 };
}
