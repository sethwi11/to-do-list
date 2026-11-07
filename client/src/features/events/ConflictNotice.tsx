import { timePart, type Clash } from '@todo/shared';
import { TriangleAlert } from 'lucide-react';
import { formatTimeRange } from '../calendar/format';

const SHOWN = 3;

/** "another event", "2 other time blocks", "3 other things": whatever the overlaps are. */
function describeCount(conflicts: Clash[]): string {
  const kinds = new Set(conflicts.map((c) => c.kind));
  const noun = kinds.size > 1 ? ['thing', 'things'] : kinds.has('block') ? ['time block', 'time blocks'] : ['event', 'events'];
  return conflicts.length === 1 ? `another ${noun[0]}` : `${conflicts.length} other ${noun[1]}`;
}

/**
 * A warning that a time overlaps other events or time blocks. It warns and nothing more: saving is never blocked.
 * The wrapper is always on the page (just empty when there is no clash), because a live region
 * only announces changes to something that already exists.
 */
export function ConflictNotice({ conflicts }: { conflicts: Clash[] }) {
  return (
    <div role="status" aria-live="polite">
      {conflicts.length > 0 && (
        <div className="flex gap-2 border-l-[3px] border-warning bg-paper py-2 pr-2 pl-3 text-meta text-ink">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium">This overlaps {describeCount(conflicts)}.</p>
            <ul className="mt-0.5 text-ink-muted">
              {conflicts.slice(0, SHOWN).map((c) => (
                <li key={c.key} className="flex gap-1.5">
                  {/* The name gives way on a narrow screen; the time, which is what you need to compare, stays whole. */}
                  <span className="min-w-0 truncate">
                    {c.kind === 'block' ? 'Time for ' : ''}“{c.title}”
                  </span>
                  <span className="shrink-0 font-mono text-time">{formatTimeRange(timePart(c.start), timePart(c.end))}</span>
                </li>
              ))}
              {conflicts.length > SHOWN && <li>and {conflicts.length - SHOWN} more</li>}
            </ul>
            <p className="mt-0.5 text-ink-muted">You can still save it.</p>
          </div>
        </div>
      )}
    </div>
  );
}
