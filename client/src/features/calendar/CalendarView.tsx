import { useEffect, useMemo, useRef, useState } from 'react';
import { blockMinutesFor, describeLoad, selfIds, timePart, type DayLoad, type EventOccurrence, type PlanItem } from '@todo/shared';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import type { DateSelectArg, EventClickArg, EventContentArg, EventDropArg, EventInput } from '@fullcalendar/core';
import type { DropArg, EventResizeDoneArg } from '@fullcalendar/interaction';
import { useApp } from '../../app/AppContext';
import { cx } from '../../lib/cx';
import { anchorOf, type PopoverAnchor } from '../../ui/Popover';
import '../../styles/calendar.css';
import { describeConflicts, formatTimeRange } from './format';
import { shadeFor, shadeProps } from '../../lib/calendarColors';
import { localDate, localDateTime, selectionToSpan, spanFromFullCalendar, taskSpan, type CalendarItem } from './calendarModel';
import { HeatTooltip } from './HeatLegend';
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
  if (item.kind === 'block') {
    // A time block is moved and stretched like an event, but always has a start and end on the grid (never all-day).
    return { id: item.id, title: item.task.title, start: item.block.start, end: item.block.end, allDay: false, extendedProps: { item } };
  }
  const span = taskSpan(item.task);
  // A to-do can be moved but not stretched: it has a due time, not a duration.
  return { id: item.id, title: item.task.title, start: span.start, end: span.end, allDay: span.allDay, durationEditable: false, extendedProps: { item } };
}

const itemOf = (arg: { event: { extendedProps: Record<string, unknown> } }) => arg.event.extendedProps.item as CalendarItem;
const NO_ROUTINE: PlanItem[] = [];

interface CalendarViewProps {
  view: GridView;
  date: string;
  items: CalendarItem[];
  /** True while the quick-create card is open, so the highlighted range stays on screen until it closes. */
  hasSelection: boolean;
  onSelect: (selection: Selection) => void;
  onOpenItem: (item: CalendarItem, anchor: PopoverAnchor) => void;
  onOpenDay: (date: string) => void;
  /** Month view only: how heavy each day is, to shade it (null = the workload map is off). */
  loads?: Map<string, DayLoad> | null;
  /** Routine blocks to draw behind everything else (read-only here; edited on the Week page). */
  routine?: readonly PlanItem[];
  onOpenRoutine?: (blockId: string) => void;
}

/** Month, Week, and Day, drawn by FullCalendar (which does the hard parts: layout of overlapping events, dragging, resizing, selecting). */
export function CalendarView({ view, date, items, hasSelection, onSelect, onOpenItem, onOpenDay, loads = null, routine = NO_ROUTINE, onOpenRoutine }: CalendarViewProps) {
  const { clashesFor, editEvent, rescheduleTask, toggleTask, tasks, scheduleTask, moveTimeBlock, showToast } = useApp();
  const [tip, setTip] = useState<{ load: DayLoad; x: number; y: number } | null>(null);
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

  const events = useMemo(
    () => [...items.map(toFullCalendarEvent), ...routine.map((r): EventInput => ({ id: r.key, title: r.title, start: r.start, end: r.end, editable: false, extendedProps: { routine: r } }))],
    [items, routine],
  );

  function handleSelect(info: DateSelectArg) {
    const span = spanFromFullCalendar(info.start, info.end, info.allDay);
    const { start, end } = selectionToSpan(span.start, span.end, span.allDay);
    // Point at the highlighted range if it is on screen (after FullCalendar has drawn it), else where the pointer was.
    window.setTimeout(() => {
      const mark = container.current?.querySelector('.fc-highlight, .fc-event-mirror');
      const pointer = info.jsEvent && 'clientX' in info.jsEvent ? { x: info.jsEvent.clientX, y: info.jsEvent.clientY } : { x: window.innerWidth / 2, y: window.innerHeight / 3 };
      onSelect({ start, end, allDay: span.allDay, anchor: mark ? anchorOf(mark) : pointer });
    }, 0);
  }

  function handleClick(info: EventClickArg) {
    info.jsEvent.preventDefault();
    const r = info.event.extendedProps.routine as PlanItem | undefined;
    if (r) return onOpenRoutine?.(r.sourceId!);
    // The checkbox on a to-do does its own thing; clicking it shouldn't also open the details.
    if ((info.jsEvent.target as HTMLElement).closest('input[type=checkbox]')) return;
    onOpenItem(itemOf(info), anchorOf(info.el));
  }

  /** A warning for the toast if the new time overlaps something. */
  const clashNote = (occurrence: EventOccurrence, span: { start: string; end: string; allDay: boolean }) => describeConflicts(clashesFor(span, { events: selfIds(occurrence) }));

  async function handleDrop(info: EventDropArg) {
    const item = itemOf(info);
    const span = spanFromFullCalendar(info.event.start!, info.event.end, info.event.allDay);
    if (item.kind === 'block') {
      const saved = await moveTimeBlock(item.block, { start: span.start, end: span.end });
      if (!saved) info.revert();
      return;
    }
    if (item.kind === 'task') {
      const saved = await rescheduleTask(item.task, { dueDate: span.start.slice(0, 10), dueTime: span.allDay ? null : span.start.slice(11, 16) });
      if (!saved) info.revert();
      return;
    }
    const title = item.occurrence.event.title;
    const saved = await editEvent(item.occurrence, span, { verb: 'Move', message: `Moved “${title}”`, note: clashNote(item.occurrence, span) });
    if (!saved) info.revert(); // cancelled, or the server said no: snap it back
  }

  async function handleResize(info: EventResizeDoneArg) {
    const item = itemOf(info);
    if (item.kind === 'block') {
      const span = spanFromFullCalendar(info.event.start!, info.event.end, false);
      if (!(await moveTimeBlock(item.block, { start: span.start, end: span.end }))) info.revert();
      return;
    }
    if (item.kind !== 'event') return info.revert();
    const span = spanFromFullCalendar(info.event.start!, info.event.end, info.event.allDay);
    const title = item.occurrence.event.title;
    const saved = await editEvent(item.occurrence, span, { verb: 'Resize', message: `Resized “${title}”`, note: clashNote(item.occurrence, span) });
    if (!saved) info.revert();
  }

  /** A to-do dragged in from the panel and dropped on a time: set that time aside for it. */
  function handleExternalDrop(info: DropArg) {
    const task = tasks.find((t) => t.id === info.draggedEl.dataset.taskId);
    if (!task) return;
    if (info.allDay) {
      showToast('Drop it on a time of day to set that time aside for it.');
      return;
    }
    void scheduleTask(task, localDateTime(info.date), blockMinutesFor(task));
  }

  function renderContent(arg: EventContentArg) {
    const r = arg.event.extendedProps.routine as PlanItem | undefined;
    if (r) {
      const look = shadeProps(r.color, shadeFor(r));
      return (
        <div style={look.style} title={`${r.title} (routine)`} className={cx('h-full overflow-hidden rounded-control px-1.5 py-0.5 text-ink opacity-80', look.className)}>
          <p className="truncate text-meta leading-tight font-medium">{r.title}</p>
          <p className="truncate font-mono text-time">{formatTimeRange(timePart(r.start), timePart(r.end))}</p>
        </div>
      );
    }
    const item = arg.event.extendedProps.item as CalendarItem | undefined;
    // While you drag out a range, FullCalendar draws a temporary "ghost" event that isn't one of ours.
    if (!item) return <div className="h-full rounded-control border border-dashed border-accent bg-accent-soft" />;
    const compact = arg.view.type === 'dayGridMonth' || arg.event.allDay;
    return <ItemBlock item={item} compact={compact} month={arg.view.type === 'dayGridMonth'} onToggleTask={(task) => void toggleTask(task)} />;
  }

  return (
    <div
      ref={container}
      className={cx('planner-cal h-full min-h-0')}
      onMouseMove={(e) => {
        if (!loads || view !== 'month') return;
        const target = e.target as HTMLElement;
        const cell = target.closest<HTMLElement>('.fc-daygrid-day[data-date]');
        const load = cell && !target.closest('.fc-event, .fc-popover') ? loads.get(cell.dataset.date!) : undefined;
        setTip(load ? { load, x: e.clientX, y: e.clientY } : null);
      }}
      onMouseLeave={() => setTip(null)}
    >
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
        slotLabelFormat={{ hour: 'numeric', minute: '2-digit', omitZeroMinute: true, meridiem: 'short', hour12: true }}
        selectable
        selectMirror
        unselectAuto={false}
        selectLongPressDelay={350}
        editable
        droppable={view !== 'month'}
        dropAccept="[data-schedule-task]"
        drop={handleExternalDrop}
        // A time block belongs to a time of day, so it can't be dropped into the all-day row.
        eventAllow={(dropInfo, dragged) => !(dragged?.extendedProps.item?.kind === 'block' && dropInfo.allDay)}
        eventLongPressDelay={350}
        eventResizableFromStart
        select={handleSelect}
        eventClick={handleClick}
        eventDrop={(info) => void handleDrop(info)}
        eventResize={(info) => void handleResize(info)}
        dayHeaderContent={(arg) => {
          // For headers FullCalendar hands over midnight UTC of the day (the month view even uses a reference week in 1970), so read it as UTC: reading it in local time would show the day before in the Americas.
          const weekday = arg.date.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
          if (arg.view.type === 'dayGridMonth') return <span className="block px-2 py-2 text-label text-ink-muted uppercase">{weekday}</span>;
          return (
            <span className="flex items-center gap-2 px-2 py-2">
              <span className="text-label text-ink-muted uppercase">{weekday}</span>
              <span className={cx('grid size-8 place-items-center rounded-full font-display text-section', arg.isToday && 'bg-accent-fill text-on-accent-fill')}>{arg.date.getUTCDate()}</span>
            </span>
          );
        }}
        // The workload map: each day gets a shade (heat-1 to heat-4) from its load, and its description for screen readers.
        dayCellClassNames={(arg) => {
          const load = loads?.get(localDate(arg.date));
          return load && load.level > 0 ? [`heat-${load.level}`] : [];
        }}
        dayCellContent={(arg) => {
          const load = loads?.get(localDate(arg.date));
          return (
            <>
              <span className={cx('grid size-6 place-items-center rounded-full font-mono text-meta', arg.isToday ? 'bg-accent-fill text-on-accent-fill' : 'text-ink')}>{arg.date.getDate()}</span>
              {load && <span className="sr-only">{describeLoad(load)}</span>}
            </>
          );
        }}
      />
      {tip && <HeatTooltip load={tip.load} x={tip.x} y={tip.y} />}
    </div>
  );
}
