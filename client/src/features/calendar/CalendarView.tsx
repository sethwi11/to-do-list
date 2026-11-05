import { useEffect, useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import type { DateSelectArg, EventClickArg, EventContentArg, EventDropArg, EventInput } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import { useApp } from '../../app/AppContext';
import { cx } from '../../lib/cx';
import { anchorOf, type PopoverAnchor } from '../../ui/Popover';
import '../../styles/calendar.css';
import { localDate, selectionToSpan, spanFromFullCalendar, taskSpan, type CalendarItem } from './calendarModel';
import { ItemBlock } from './ItemBlock';
import type { Selection } from './QuickCreate';

type GridView = 'month' | 'week' | 'day';
const FC_VIEW: Record<GridView, string> = { month: 'dayGridMonth', week: 'timeGridWeek', day: 'timeGridDay' };

/** An item as FullCalendar wants it. The item itself rides along in `extendedProps`, so handlers get it back untouched. */
function toFullCalendarEvent(item: CalendarItem): EventInput {
  if (item.kind === 'event') {
    const { occurrence } = item;
    // All-day events are plain dates; FullCalendar treats a date-only end as exclusive, same as the stored value.
    const day = (v: string) => (occurrence.allDay ? v.slice(0, 10) : v);
    return { id: item.id, title: occurrence.event.title, start: day(occurrence.start), end: day(occurrence.end), allDay: occurrence.allDay, extendedProps: { item } };
  }
  const span = taskSpan(item.task);
  // A to-do can be moved but not stretched: it has a due time, not a duration.
  return { id: item.id, title: item.task.title, start: span.start, end: span.end, allDay: span.allDay, durationEditable: false, extendedProps: { item } };
}

const itemOf = (arg: { event: { extendedProps: Record<string, unknown> } }) => arg.event.extendedProps.item as CalendarItem;

interface CalendarViewProps {
  view: GridView;
  date: string;
  items: CalendarItem[];
  /** True while the quick-create card is open, so the highlighted range stays on screen until it closes. */
  hasSelection: boolean;
  onSelect: (selection: Selection) => void;
  onOpenItem: (item: CalendarItem, anchor: PopoverAnchor) => void;
  onOpenDay: (date: string) => void;
}

/**
 * Month, Week, and Day, drawn by FullCalendar (which does the hard parts: layout of overlapping
 * events, dragging, resizing, selecting). The page owns the date and view (they're in the address
 * bar), and this component just follows them. Items are drawn by our own blocks.
 */
export function CalendarView({ view, date, items, hasSelection, onSelect, onOpenItem, onOpenDay }: CalendarViewProps) {
  const { editEvent, rescheduleTask, toggleTask } = useApp();
  const ref = useRef<FullCalendar>(null);
  const container = useRef<HTMLDivElement>(null);

  // Keep FullCalendar on the view and date from the address bar.
  useEffect(() => {
    const api = ref.current?.getApi();
    if (!api) return;
    if (api.view.type !== FC_VIEW[view]) api.changeView(FC_VIEW[view], date);
    else api.gotoDate(date);
  }, [view, date]);

  // The highlighted range clears once the card for it is closed.
  useEffect(() => {
    if (!hasSelection) ref.current?.getApi().unselect();
  }, [hasSelection]);

  const events = useMemo(() => items.map(toFullCalendarEvent), [items]);

  function handleSelect(info: DateSelectArg) {
    const span = spanFromFullCalendar(info.start, info.end, info.allDay);
    const { start, end } = selectionToSpan(span.start, span.end, span.allDay);
    // Point at the highlighted range if it is on screen (after FullCalendar has drawn it), else where the pointer was.
    // A timer, not requestAnimationFrame: animation frames pause whenever the page isn't being painted.
    window.setTimeout(() => {
      const mark = container.current?.querySelector('.fc-highlight, .fc-event-mirror');
      const pointer = info.jsEvent && 'clientX' in info.jsEvent ? { x: info.jsEvent.clientX, y: info.jsEvent.clientY } : { x: window.innerWidth / 2, y: window.innerHeight / 3 };
      onSelect({ start, end, allDay: span.allDay, anchor: mark ? anchorOf(mark) : pointer });
    }, 0);
  }

  function handleClick(info: EventClickArg) {
    info.jsEvent.preventDefault();
    // The checkbox on a to-do does its own thing; clicking it shouldn't also open the details.
    if ((info.jsEvent.target as HTMLElement).closest('input[type=checkbox]')) return;
    onOpenItem(itemOf(info), anchorOf(info.el));
  }

  async function handleDrop(info: EventDropArg) {
    const item = itemOf(info);
    const span = spanFromFullCalendar(info.event.start!, info.event.end, info.event.allDay);
    if (item.kind === 'task') {
      const saved = await rescheduleTask(item.task, { dueDate: span.start.slice(0, 10), dueTime: span.allDay ? null : span.start.slice(11, 16) });
      if (!saved) info.revert();
      return;
    }
    const title = item.occurrence.event.title;
    const saved = await editEvent(item.occurrence, span, { verb: 'Move', message: `Moved “${title}”` });
    if (!saved) info.revert(); // cancelled, or the server said no: snap it back
  }

  async function handleResize(info: EventResizeDoneArg) {
    const item = itemOf(info);
    if (item.kind !== 'event') return info.revert();
    const span = spanFromFullCalendar(info.event.start!, info.event.end, info.event.allDay);
    const title = item.occurrence.event.title;
    const saved = await editEvent(item.occurrence, span, { verb: 'Resize', message: `Resized “${title}”` });
    if (!saved) info.revert();
  }

  function renderContent(arg: EventContentArg) {
    const item = arg.event.extendedProps.item as CalendarItem | undefined;
    // While you drag out a range, FullCalendar draws a temporary "ghost" event that isn't one of ours.
    if (!item) return <div className="h-full rounded-control border border-dashed border-accent bg-accent-soft" />;
    const compact = arg.view.type === 'dayGridMonth' || arg.event.allDay;
    return <ItemBlock item={item} compact={compact} month={arg.view.type === 'dayGridMonth'} onToggleTask={(t) => void toggleTask(t.task)} />;
  }

  return (
    <div ref={container} className={cx('planner-cal h-full min-h-0')}>
      <FullCalendar
        ref={ref}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={FC_VIEW[view]}
        initialDate={date}
        headerToolbar={false}
        height="100%"
        firstDay={0}
        events={events}
        eventContent={renderContent}
        eventDisplay="block"
        dayMaxEvents
        moreLinkClick={(arg) => onOpenDay(localDate(arg.date))}
        moreLinkContent={(arg) => (
          <>
            +{arg.num}
            <span className="max-sm:hidden"> more</span>
          </>
        )}
        navLinks
        navLinkDayClick={(d) => onOpenDay(localDate(d))}
        nowIndicator
        scrollTime="07:00:00"
        slotDuration="00:30:00"
        snapDuration="00:15:00"
        eventMinHeight={24}
        allDayText="All day"
        slotLabelFormat={{ hour: 'numeric', minute: '2-digit', omitZeroMinute: true, meridiem: 'short' }}
        selectable
        selectMirror
        unselectAuto={false}
        selectLongPressDelay={350}
        editable
        eventLongPressDelay={350}
        eventResizableFromStart
        select={handleSelect}
        eventClick={handleClick}
        eventDrop={(info) => void handleDrop(info)}
        eventResize={(info) => void handleResize(info)}
        dayHeaderContent={(arg) => {
          // For headers FullCalendar hands over midnight UTC of the day (the month view even uses a reference week in 1970),
          // so read it as UTC: reading it in local time would show the day before in the Americas.
          const weekday = arg.date.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
          if (arg.view.type === 'dayGridMonth') return <span className="block px-2 py-2 text-label text-ink-muted uppercase">{weekday}</span>;
          return (
            <span className="flex items-center gap-2 px-2 py-2">
              <span className="text-label text-ink-muted uppercase">{weekday}</span>
              <span className={cx('grid size-8 place-items-center rounded-full font-display text-section', arg.isToday && 'bg-accent-ink text-on-accent')}>{arg.date.getUTCDate()}</span>
            </span>
          );
        }}
        dayCellContent={(arg) => (
          <span className={cx('grid size-6 place-items-center rounded-full font-mono text-meta', arg.isToday ? 'bg-accent-ink text-on-accent' : 'text-ink')}>{arg.date.getDate()}</span>
        )}
      />
    </div>
  );
}
