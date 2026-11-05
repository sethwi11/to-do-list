import { CalendarPlus, ChevronDown, Briefcase, FileUp, ListPlus, Plus } from 'lucide-react';
import { useLocation } from 'react-router';
import { newEventSpan, parseCalendarQuery } from '../features/calendar/calendarModel';
import { cx } from '../lib/cx';
import { Menu, type MenuItem } from '../ui/Menu';
import { useApp } from './AppContext';

/**
 * The "New" button and its menu. Task and Event work; the others are listed so you can see
 * what's coming, but can't be chosen yet. Each is enabled when its feature is built.
 */
export function NewMenu({ variant }: { variant: 'sidebar' | 'rail' | 'fab' }) {
  const { openDialog, today } = useApp();
  const location = useLocation();
  // Looking at a day on the calendar? A new event starts on that day.
  const lookingAt = location.pathname === '/calendar' ? parseCalendarQuery(new URLSearchParams(location.search), today).date : null;
  const items: MenuItem[] = [
    { label: 'Task', icon: ListPlus, onSelect: () => openDialog({ kind: 'task', mode: 'new', defaults: {} }) },
    { label: 'Event', icon: CalendarPlus, onSelect: () => openDialog({ kind: 'event', mode: 'new', defaults: newEventSpan(lookingAt, new Date()) }) },
    { label: 'Import file', icon: FileUp, disabled: true, hint: 'Soon' },
    { label: 'Application', icon: Briefcase, disabled: true, hint: 'Soon' },
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
            'inline-flex items-center justify-center bg-accent-ink text-on-accent transition-colors duration-150 ease-out hover:bg-accent-ink/90',
            variant === 'sidebar' && 'h-8 w-full gap-2 rounded-control px-3 text-body font-medium',
            variant === 'rail' && 'size-8 rounded-control',
            // On a phone: a square tomato button with 4px corners, bottom right.
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
