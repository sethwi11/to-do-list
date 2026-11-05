import type { ReactNode } from 'react';

/*
 * Sidebar | content. Below the md breakpoint the sidebar stacks on top, which
 * handles phone widths without a separate mobile layout.
 *
 * Columns use minmax(0, 1fr), not plain 1fr: a grid column's minimum size
 * defaults to its content's width, so the horizontally scrolling view row on
 * phones would stretch the whole page sideways.
 */
export function AppShell({ sidebar, main }: { sidebar: ReactNode; main: ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-6 px-4 pt-4 pb-12 md:grid-cols-[200px_minmax(0,1fr)] md:gap-8 md:py-8 xl:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="md:sticky md:top-8 md:self-start">{sidebar}</aside>
        <main className="min-w-0 max-w-3xl">{main}</main>
      </div>
    </div>
  );
}
