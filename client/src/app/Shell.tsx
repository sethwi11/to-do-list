import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Menu as MenuIcon } from 'lucide-react';
import { useDueNotifications } from '../hooks/useDueNotifications';
import { usePersistedState } from '../hooks/usePersistedState';
import { useSettings } from '../hooks/useSettings';
import { useShortcuts } from '../hooks/useShortcuts';
import { IconButton } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import { useApp } from './AppContext';
import { ErrorBoundary } from './ErrorBoundary';
import { NewMenu } from './NewMenu';
import { SidebarContent } from './Sidebar';

const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';

/** The frame around every page: the sidebar on the left (a 56px rail if collapsed), and the page itself on the right. */
export function Shell() {
  const app = useApp();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = usePersistedState('voice-todo.sidebarCollapsed', false, isBoolean);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const fullHeight = location.pathname === '/calendar' || location.pathname === '/week';

  useDueNotifications(app.tasks, settings.notifications);

  // Going anywhere closes the phone drawer.
  useEffect(() => setDrawerOpen(false), [location.pathname, location.search]);

  useShortcuts({
    newTask: () => document.getElementById('quick-add')?.focus(),
    search: () => {
      const focus = () => document.getElementById('task-search')?.focus();
      if (document.getElementById('task-search')) return focus();
      navigate('/tasks'); // search lives on the Tasks page: go there, then focus it
      window.setTimeout(focus, 60);
    },
    undo: () => void app.undoLast(),
    showHelp: () => app.openDialog({ kind: 'shortcuts' }),
  });

  return (
    <div className="md:flex">
      <aside
        aria-label="Sidebar"
        className={`sticky top-0 hidden h-dvh shrink-0 border-r border-rule bg-surface transition-[width] duration-150 ease-out md:block ${collapsed ? 'w-14' : 'w-62'}`}
      >
        <SidebarContent collapsed={collapsed} onToggleCollapsed={() => setCollapsed(!collapsed)} />
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex h-12 items-center gap-2 border-b border-hairline px-3 md:hidden">
          <IconButton icon={MenuIcon} label="Open menu" onClick={() => setDrawerOpen(true)} />
          <span className="font-display text-section italic">Planner</span>
        </div>
        {/* The calendar fills the screen instead of scrolling the page: its grid scrolls inside it. */}
        <main
          className={
            fullHeight
              ? 'flex h-[calc(100dvh-3rem)] flex-col px-3 pt-3 pb-24 sm:px-5 md:h-dvh md:px-8 md:pt-6 md:pb-4'
              : 'px-5 pt-6 pb-28 sm:px-8 md:px-10 md:pt-10'
          }
        >
          {/* Keyed by address, so leaving a page that crashed clears the message. */}
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<p className="font-display text-title text-ink-muted italic">Loading…</p>}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} label="Menu">
        <SidebarContent onNavigate={() => setDrawerOpen(false)} />
      </Drawer>

      <div className="fixed right-4 bottom-4 z-30 md:hidden">
        <NewMenu variant="fab" />
      </div>
    </div>
  );
}
