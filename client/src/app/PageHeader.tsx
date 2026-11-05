import type { ReactNode } from 'react';
import type { TaskDefaults } from './AppContext';
import { QuickAdd } from './QuickAdd';
import { ThemeToggle } from './ThemeToggle';

interface PageHeaderProps {
  /** The page title, in 40px Fraunces. On Today this is the weekday. */
  title: string;
  /** A second line in muted 22px Fraunces, e.g. the date. */
  subtitle?: string;
  /** Small mono text beside the subtitle, e.g. "WK 45". */
  aside?: string;
  /** What the quick-add box fills in for tasks added from this page. */
  quickAddDefaults?: TaskDefaults;
  children?: ReactNode;
}

/** The top of every page: the title on the left; quick add and the theme toggle on the right. */
export function PageHeader({ title, subtitle, aside, quickAddDefaults, children }: PageHeaderProps) {
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0">
          <h1 className="font-display text-page break-words">{title}</h1>
          {subtitle && (
            <p className="flex items-baseline gap-3">
              <span className="font-display text-section text-ink-muted">{subtitle}</span>
              {aside && <span className="font-mono text-meta text-ink-muted">{aside}</span>}
            </p>
          )}
        </div>
        <div className="flex w-full items-center gap-4 sm:w-auto">
          <QuickAdd defaults={quickAddDefaults} className="min-w-0 flex-1 sm:w-72 sm:flex-none" />
          <ThemeToggle className="max-sm:hidden" />
        </div>
      </div>
      {children}
    </header>
  );
}
