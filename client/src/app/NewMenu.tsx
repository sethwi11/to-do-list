import { CalendarPlus, ChevronDown, Briefcase, FileUp, ListPlus, Plus, Wallet } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { newEventSpan, parseCalendarQuery } from '../features/calendar/calendarModel';
import { cx } from '../lib/cx';
import { Menu, type MenuItem } from '../ui/Menu';
import { useApp } from './AppContext';

/** The "New" button and its menu: a task, an event, a file to read events from, an internship application, or an expense. */
export function NewMenu({ variant }: { variant: 'sidebar' | 'rail' | 'fab' }) {
  const { openDialog, today, chooseFilesToImport } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  // Looking at a day on the calendar? A new event starts on that day.
  const lookingAt = location.pathname === '/calendar' ? parseCalendarQuery(new URLSearchParams(location.search), today).date : null;
  const items: MenuItem[] = [
    { label: 'Task', icon: ListPlus, onSelect: () => openDialog({ kind: 'task', mode: 'new', defaults: {} }) },
    { label: 'Event', icon: CalendarPlus, onSelect: () => openDialog({ kind: 'event', mode: 'new', defaults: newEventSpan(lookingAt, new Date()) }) },
    { label: 'Import file', icon: FileUp, onSelect: chooseFilesToImport },
    { label: 'Application', icon: Briefcase, onSelect: () => openDialog({ kind: 'application', id: 'new' }) },
    // The Money page's quick-add row is the fastest way to log one, so the menu takes you there with it focused.
    { label: 'Expense', icon: Wallet, onSelect: () => navigate('/money?add=1') },
  ];

  return (
    <Menu
      items={items}
      side={variant === 'fab' ? 'top' : 'bottom'}
      align={variant === 'fab' ? 'end' : 'start'}
      className={variant === 'sidebar' ? 'w-full' : undefined}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={variant === 'sidebar' ? undefined : 'New'}
          className={cx(
            'inline-flex items-center justify-center bg-accent-fill text-on-accent-fill transition-colors duration-150 ease-out hover:bg-accent-fill/85',
            variant === 'sidebar' && 'h-8 w-full gap-2 rounded-control px-3 text-body font-medium',
            variant === 'rail' && 'size-8 rounded-control',
            // On a phone: a square honey button with 4px corners, bottom right.
            variant === 'fab' && 'size-14 rounded-control',
          )}
        >
          <Plus className={variant === 'fab' ? 'size-6' : 'size-4'} aria-hidden />
          {variant === 'sidebar' && (
            <>
              New
              <ChevronDown className="ml-auto size-4" aria-hidden />
            </>
          )}
        </button>
      )}
    />
  );
}
