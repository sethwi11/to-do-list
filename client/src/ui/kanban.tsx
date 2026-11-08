import type { ReactNode } from 'react';
import type { CalendarColor } from '@todo/shared';
import { calendarVars } from '../lib/calendarColors';
import { cx } from '../lib/cx';

/** A minimal application card: company, role, date applied in mono, and the calendar's color square. */
export function KanbanCard({
  company,
  role,
  dateApplied,
  color,
  calendarName,
  extra,
  className,
}: {
  company: ReactNode;
  role: string;
  dateApplied?: string;
  color: CalendarColor;
  calendarName?: string;
  extra?: ReactNode;
  className?: string;
}) {
  return (
    <article style={calendarVars(color)} className={cx('border-b border-hairline py-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-body font-medium text-ink">{company}</h3>
        <span title={calendarName} className="mt-1.5 size-2 shrink-0 bg-(color:--c)">
          {calendarName && <span className="sr-only">Calendar: {calendarName}</span>}
        </span>
      </div>
      <p className="text-meta text-ink-muted">{role}</p>
      {dateApplied && (
        <p className="mt-1.5 font-mono text-time text-ink-muted">
          <span className="sr-only">Applied </span>
          {dateApplied}
        </p>
      )}
      {extra}
    </article>
  );
}

/** A column of cards. */
export function KanbanColumn({ title, count, children, className }: { title: string; count: number; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cx('min-w-[9.5rem] flex-1 border-l border-hairline px-3 first:border-l-0 first:pl-0', className)}>
      <h2 className="mb-1 flex items-baseline justify-between gap-2 border-b border-rule pb-2 text-label text-ink-muted uppercase">
        {title}
        <span className="font-mono font-normal">{count}</span>
      </h2>
      {children}
    </section>
  );
}

/** A thin (4px) progress bar: tomato fill on a hairline track. */
export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div>
      <div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} className="h-1 w-full bg-hairline">
        <div className="h-full bg-accent transition-[width] duration-150 ease-out" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 font-mono text-meta text-ink-muted">
        <span className="tabular-nums">
          {value} / {max}
        </span>{' '}
        {label}
      </p>
    </div>
  );
}
