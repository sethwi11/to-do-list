import type { ReactNode } from 'react';

/*
 * Three-column layout: sidebar | task list | voice & review panel.
 * Below the lg breakpoint the columns stack (sidebar on top, panel at the
 * bottom), which handles phone widths without a separate mobile layout.
 */
export function AppShell({ sidebar, main, panel }: { sidebar: ReactNode; main: ReactNode; panel: ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-4 md:grid-cols-[220px_1fr] md:py-6 lg:grid-cols-[220px_1fr_320px]">
        <aside className="md:sticky md:top-6 md:self-start">{sidebar}</aside>
        <main className="min-w-0">{main}</main>
        <aside aria-label="Voice and review" className="md:col-span-2 lg:col-span-1 lg:sticky lg:top-6 lg:self-start">
          {panel}
        </aside>
      </div>
    </div>
  );
}
