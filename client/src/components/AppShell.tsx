import type { ReactNode } from 'react';

/*
 * Three-column layout: sidebar | task list | voice & review panel.
 * Below the lg breakpoint the columns stack (sidebar on top, panel at the
 * bottom), which handles phone widths without a separate mobile layout.
 *
 * Columns use minmax(0, 1fr), not plain 1fr: a grid column's minimum size
 * defaults to its content's width, so the horizontally scrolling view row on
 * phones would stretch the whole page sideways.
 */
export function AppShell({ sidebar, main, panel }: { sidebar: ReactNode; main: ReactNode; panel: ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-6 px-4 pt-4 pb-28 md:grid-cols-[200px_minmax(0,1fr)] md:gap-8 md:py-8 lg:grid-cols-[200px_minmax(0,1fr)_300px] lg:pb-8 xl:grid-cols-[220px_minmax(0,1fr)_340px]">
        <aside className="md:sticky md:top-8 md:self-start">{sidebar}</aside>
        <main className="min-w-0">{main}</main>
        <aside aria-label="Voice and review" className="md:col-span-2 lg:sticky lg:top-8 lg:col-span-1 lg:self-start">
          {panel}
        </aside>
      </div>
    </div>
  );
}
