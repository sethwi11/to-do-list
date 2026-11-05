import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

/** An empty list: one line of Fraunces italic and one ghost button. No illustrations, left-aligned. */
export function EmptyState({ message, children, className }: { message: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cx('py-10', className)}>
      <p className="font-display text-title text-ink-muted italic">{message}</p>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

/**
 * Placeholder rows while data loads: hairline-colored bars that slowly breathe (never a
 * spinner). A fading bar rather than a sweeping highlight keeps the design free of gradients.
 */
export function SkeletonRows({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} aria-hidden className="flex min-h-11 items-center gap-3 border-b border-hairline pl-2">
          <span className="size-4 animate-breathe rounded-[3px] bg-hairline" />
          <span className="h-3 animate-breathe rounded-control bg-hairline" style={{ width: `${70 - ((i * 13) % 35)}%`, animationDelay: `${i * 150}ms` }} />
        </div>
      ))}
    </div>
  );
}
