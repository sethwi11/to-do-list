import { Link } from 'react-router';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { appliedDate, APPLICATION_STATUSES, daysInStatus, type Application, type ApplicationSortKey, type ApplicationStatus, type SortDirection } from '@todo/shared';
import { cx } from '../../lib/cx';
import { Select } from '../../ui/fields';
import { ago, shortDate } from './format';

interface TableProps {
  applications: Application[];
  today: string;
  sort: ApplicationSortKey;
  direction: SortDirection;
  onSort: (key: ApplicationSortKey) => void;
  onStatus: (application: Application, status: ApplicationStatus) => void;
  /** What to say when nothing matches. */
  empty: string;
}

const COLUMNS: { key: ApplicationSortKey; label: string; className?: string }[] = [
  { key: 'company', label: 'Company' },
  { key: 'role', label: 'Role', className: 'max-sm:hidden' },
  { key: 'status', label: 'Status' },
  { key: 'dateApplied', label: 'Applied', className: 'max-md:hidden' },
  { key: 'deadline', label: 'Deadline', className: 'max-md:hidden' },
  { key: 'updated', label: 'Last change', className: 'max-lg:hidden' },
];

/**
 * Every application as a sortable table (a phone gets company, role and status; wider screens add the dates). Click a heading to sort (again to reverse). Each row has a status menu, which
 * is also the plain, keyboard-and-phone-friendly way to move an application along (the board's drag does the same thing).
 */
export function ApplicationTable({ applications, today, sort, direction, onSort, onStatus, empty }: TableProps) {
  if (applications.length === 0) return <p className="py-10 font-display text-title text-ink-muted italic">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-body">
        <thead>
          <tr className="border-b border-rule">
            {COLUMNS.map((c) => (
              <th key={c.key} scope="col" aria-sort={sort === c.key ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'} className={cx('py-2 pr-4 text-label font-semibold text-ink-muted uppercase', c.className)}>
                <button type="button" onClick={() => onSort(c.key)} className="-ml-1 inline-flex items-center gap-1 rounded-control px-1 py-1 uppercase hover:text-ink focus-visible:text-ink">
                  {c.label}
                  {sort === c.key && (direction === 'asc' ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {applications.map((a) => {
            const applied = appliedDate(a);
            return (
              <tr key={a.id} className="border-b border-hairline align-middle hover:bg-surface">
                <td className="py-2 pr-4">
                  <Link to={`/applications/${a.id}`} className="font-medium hover:underline focus-visible:underline">
                    {a.company}
                  </Link>
                  <span className="block text-meta text-ink-muted sm:hidden">{a.role}</span>
                </td>
                <td className="py-2 pr-4 text-ink-muted max-sm:hidden">{a.role}</td>
                <td className="py-2 pr-4">
                  <Select aria-label={`Status of ${a.company}`} value={a.status} onChange={(e) => onStatus(a, e.target.value as ApplicationStatus)} className="h-8 min-w-40" wrapperClassName="w-44">
                    {APPLICATION_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="py-2 pr-4 font-mono text-meta text-ink-muted max-md:hidden">{applied ? shortDate(applied) : '–'}</td>
                <td className="py-2 pr-4 font-mono text-meta text-ink-muted max-md:hidden">{a.deadline ? shortDate(a.deadline) : '–'}</td>
                <td className="py-2 pr-4 text-meta text-ink-muted max-lg:hidden">{ago(daysInStatus(a, today))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
