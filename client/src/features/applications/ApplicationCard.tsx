import { Link } from 'react-router';
import { appliedDate, type Application, type CalendarColor } from '@todo/shared';
import { cx } from '../../lib/cx';
import { KanbanCard } from '../../ui/kanban';
import { shortDate } from '../../lib/dates';

/** One application as a board card: company (a link to its page), role, the date applied, and a cue if something needs doing. */
export function ApplicationCard({ application: a, color, calendarName, needsFollowUp, className }: { application: Application; color: CalendarColor; calendarName?: string; needsFollowUp?: boolean; className?: string }) {
  const applied = appliedDate(a);
  return (
    <KanbanCard
      className={cx('border-b-0', className)}
      company={
        <Link to={`/applications/${a.id}`} className="hover:underline focus-visible:underline">
          {a.company}
        </Link>
      }
      role={a.role}
      dateApplied={applied && a.status !== 'Wishlist' ? shortDate(applied) : undefined}
      color={color}
      calendarName={calendarName}
      extra={
        <>
          {a.status === 'Wishlist' && a.deadline && (
            <p className="mt-1.5 font-mono text-time text-ink-muted">
              <span className="sr-only">Deadline </span>Due {shortDate(a.deadline)}
            </p>
          )}
          {needsFollowUp && <p className="mt-1.5 text-meta text-accent-ink">Time to follow up?</p>}
        </>
      }
    />
  );
}
