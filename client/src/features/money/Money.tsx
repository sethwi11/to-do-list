import { cx } from '../../lib/cx';

/** An amount in the mono font, lined up in columns. */
export function Money({ children, className }: { children: string; className?: string }) {
  return <span className={cx('font-mono tabular-nums', className)}>{children}</span>;
}

/** A thin progress bar; `over` turns it red and fills it. */
export function Bar({ share, over = false, label }: { share: number; over?: boolean; label: string }) {
  const pct = over ? 100 : Math.round(Math.min(1, Math.max(0, share)) * 100);
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-hairline">
      <div className={cx('h-full rounded-full', over ? 'bg-danger' : 'bg-accent')} style={{ width: `${pct}%` }} />
    </div>
  );
}
