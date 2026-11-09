import { ChevronDown, ChevronRight } from 'lucide-react';
import { addDays, weekRange } from '@todo/shared';
import { weeklyReviewHooks } from '../../data/usePath';
import { usePersistedState } from '../../hooks/usePersistedState';

const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';

/** The three priorities typed in last week's Sunday review, kept in front of you all week. Collapsible, and it remembers how you left it. */
export function WeekPriorities({ date }: { date: string }) {
  const reviews = weeklyReviewHooks.useList().data;
  const [collapsed, setCollapsed] = usePersistedState('planner.priorities.collapsed', false, isBoolean);
  const lastWeek = addDays(weekRange(date)[0], -7);
  const priorities = reviews?.find((r) => r.weekStart === lastWeek)?.priorities ?? [];
  if (priorities.length === 0) return null;
  const Chevron = collapsed ? ChevronRight : ChevronDown;
  return (
    <section aria-label="This week’s priorities" className="mb-8 border border-rule border-l-4 border-l-accent bg-surface px-4 py-3">
      <button type="button" aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)} className="flex w-full items-center gap-2 text-left text-label text-ink-muted uppercase">
        <Chevron className="size-4" aria-hidden />
        This week’s priorities
        <span className="font-mono font-normal">{priorities.length}</span>
      </button>
      {!collapsed && (
        <ol className="mt-2 space-y-1 text-body">
          {priorities.map((p, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-4 font-mono text-meta text-ink-muted">{i + 1}</span>
              {p}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
