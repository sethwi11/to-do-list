import { useMemo } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { CalendarCheck, CalendarDays, ListTodo, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Plus, Settings } from 'lucide-react';
import { calendarVars } from '../lib/calendarColors';
import { cx } from '../lib/cx';
import { tasksUrl } from '../lib/taskParams';
import { IconButton } from '../ui/Button';
import { useApp } from './AppContext';
import { MiniMonth } from './MiniMonth';
import { NewMenu } from './NewMenu';

interface SidebarProps {
  /** The narrow icon-only rail (56px) instead of the full 248px sidebar. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Called after any navigation, so a phone's drawer can close itself. */
  onNavigate?: () => void;
}

const navClass = (collapsed: boolean) => ({ isActive }: { isActive: boolean }) =>
  cx(
    'relative flex h-9 items-center gap-3 rounded-control text-body transition-colors duration-150 ease-out',
    collapsed ? 'w-9 justify-center' : 'px-3',
    isActive ? 'bg-accent-soft font-medium text-ink' : 'text-ink hover:bg-accent-soft',
  );

/**
 * The sidebar, styled like a notebook spine: surface color with a strong rule down its edge.
 * From the top: the app name, the New button, navigation, a month for jumping to a date, the
 * calendars, and Settings at the very bottom. The same component fills the 56px rail and the
 * phone's slide-out drawer.
 */
export function SidebarContent({ collapsed = false, onToggleCollapsed, onNavigate }: SidebarProps) {
  const { calendars, tasks, today, openDialog, hiddenCalendarIds, toggleCalendarHidden } = useApp();
  const location = useLocation();
  const activeCalendar = location.pathname === '/tasks' ? new URLSearchParams(location.search).get('calendar') : null;

  const openCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tasks) if (t.status === 'todo' && t.calendarId) counts.set(t.calendarId, (counts.get(t.calendarId) ?? 0) + 1);
    return counts;
  }, [tasks]);
  const dueToday = tasks.filter((t) => t.status === 'todo' && t.dueDate !== null && t.dueDate <= today).length;

  const nav = [
    { to: '/', label: 'Today', icon: CalendarCheck, end: true, count: dueToday },
    { to: '/calendar', label: 'Calendar', icon: CalendarDays, end: false, count: 0 },
    { to: '/tasks', label: 'Tasks', icon: ListTodo, end: false, count: 0 },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className={cx('flex items-center pt-5 pb-3', collapsed ? 'justify-center' : 'justify-between px-4')}>
        {!collapsed && <span className="font-display text-section italic">Planner</span>}
        {onToggleCollapsed && (
          <IconButton icon={collapsed ? PanelLeftOpen : PanelLeftClose} label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={onToggleCollapsed} />
        )}
      </div>

      <div className={cx('pb-4', collapsed ? 'flex justify-center' : 'px-3')}>
        <NewMenu variant={collapsed ? 'rail' : 'sidebar'} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <nav aria-label="Main" className={cx('pb-4', collapsed ? 'flex flex-col items-center gap-1' : 'space-y-0.5 px-3')}>
          {nav.map(({ to, label, icon: Icon, end, count }) => (
            <NavLink key={to} to={to} end={end} onClick={onNavigate} className={navClass(collapsed)} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined}>
              {({ isActive }) => (
                <>
                  {/* The accent marks where you are. */}
                  {isActive && !collapsed && <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] bg-accent" />}
                  <Icon className="size-[18px] shrink-0" aria-hidden />
                  {!collapsed && <span className="flex-1">{label}</span>}
                  {!collapsed && count > 0 && <span className="font-mono text-meta text-ink-muted tabular-nums">{count}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {!collapsed && <MiniMonth onNavigate={onNavigate} />}

        <section aria-label="Calendars" className={cx('pb-4', collapsed ? 'flex flex-col items-center gap-1 pt-2' : 'px-3')}>
          {!collapsed && (
            <div className="mb-1 flex items-center justify-between pr-1 pl-3">
              <h2 className="text-label text-ink-muted uppercase">Calendars</h2>
              <IconButton icon={Plus} label="New calendar" onClick={() => openDialog({ kind: 'calendar', id: 'new' })} className="size-6" />
            </div>
          )}
          {collapsed && <IconButton icon={Plus} label="New calendar" onClick={() => openDialog({ kind: 'calendar', id: 'new' })} />}
          <ul className={collapsed ? 'space-y-1' : 'space-y-0.5'}>
            {calendars.map((c) => {
              const active = activeCalendar === c.id;
              const count = openCounts.get(c.id) ?? 0;
              const visible = !hiddenCalendarIds.has(c.id);
              return (
                <li key={c.id} style={calendarVars(c.color)} className="group relative flex items-center">
                  {!collapsed && (
                    // The color square is also the switch for showing this calendar on the calendar page: filled = shown, outline = hidden.
                    <button
                      type="button"
                      aria-pressed={visible}
                      aria-label={`Show “${c.name}” on the calendar`}
                      title={visible ? 'Shown on the calendar. Click to hide.' : 'Hidden from the calendar. Click to show.'}
                      onClick={() => toggleCalendarHidden(c.id)}
                      className="grid size-8 shrink-0 place-items-center rounded-control transition-colors duration-150 ease-out hover:bg-accent-soft"
                    >
                      <span aria-hidden className={cx('size-2.5 border-[1.5px] border-(color:--c)', visible ? 'bg-(color:--c)' : 'bg-transparent')} />
                    </button>
                  )}
                  <Link
                    to={tasksUrl({ calendarId: c.id })}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? c.name : undefined}
                    aria-label={collapsed ? c.name : undefined}
                    className={cx(
                      'flex h-8 min-w-0 flex-1 items-center gap-3 rounded-control text-body transition-colors duration-150 ease-out hover:bg-accent-soft',
                      collapsed ? 'w-9 flex-none justify-center' : 'pr-3 pl-1 max-md:pr-10', // on a phone the ⋯ button is always visible, so leave room for it beside the count
                      active && 'bg-accent-soft font-medium',
                      !collapsed && !visible && 'text-ink-muted',
                    )}
                  >
                    {/* In the narrow rail there's no room for a switch, so the square is just the link, dimmed if hidden. */}
                    {collapsed && <span aria-hidden className={cx('size-2.5 shrink-0 bg-(color:--c)', !visible && 'opacity-30')} />}
                    {!collapsed && <span className="min-w-0 flex-1 truncate">{c.name}</span>}
                    {!collapsed && count > 0 && <span className="font-mono text-meta text-ink-muted tabular-nums group-hover:invisible group-focus-within:invisible max-md:visible!">{count}</span>}
                  </Link>
                  {!collapsed && (
                    <IconButton
                      icon={MoreHorizontal}
                      label={`Edit calendar “${c.name}”`}
                      onClick={() => openDialog({ kind: 'calendar', id: c.id })}
                      className="absolute right-0 size-8 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className={cx('border-t border-hairline p-3', collapsed && 'flex justify-center')}>
        {collapsed ? (
          <IconButton icon={Settings} label="Settings" onClick={() => openDialog({ kind: 'settings' })} />
        ) : (
          <button
            type="button"
            onClick={() => openDialog({ kind: 'settings' })}
            className="flex h-9 w-full items-center gap-3 rounded-control px-3 text-body text-ink transition-colors duration-150 ease-out hover:bg-accent-soft"
          >
            <Settings className="size-[18px]" aria-hidden />
            Settings
          </button>
        )}
      </div>
    </div>
  );
}
