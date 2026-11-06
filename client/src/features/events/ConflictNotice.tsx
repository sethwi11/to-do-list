import { timePart, type EventOccurrence } from '@todo/shared';
import { TriangleAlert } from 'lucide-react';
import { formatTimeRange } from '../calendar/format';

const SHOWN = 3;

/**
 * A warning that a time overlaps other events. It warns and nothing more: saving is never blocked.
 * The wrapper is always on the page (just empty when there is no clash), because a live region
 * only announces changes to something that already exists.
 */
export function ConflictNotice({ conflicts }: { conflicts: EventOccurrence[] }) {
  return (
    <div role="status" aria-live="polite">
      {conflicts.length > 0 && (
        <div className="flex gap-2 border-l-[3px] border-warning bg-paper py-2 pr-2 pl-3 text-meta text-ink">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium">This overlaps {conflicts.length === 1 ? 'another event' : `${conflicts.length} other events`}.</p>
            <ul className="mt-0.5 text-ink-muted">
              {conflicts.slice(0, SHOWN).map((o) => (
                <li key={o.key} className="truncate">
                  “{o.event.title}” <span className="font-mono text-time">{formatTimeRange(timePart(o.start), timePart(o.end))}</span>
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
