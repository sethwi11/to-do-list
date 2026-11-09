import { useEffect, useMemo, useRef } from 'react';
import { Copy } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import interactionPlugin, { type EventResizeDoneArg } from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import type { DateSelectArg, EventClickArg, EventContentArg, EventDropArg, EventInput } from '@fullcalendar/core';
import { combine, datePart, dayOfWeek, layoutTemplate, minutesBetween, refDate, spanOn, timePart, type Calendar, type CalendarColor, type ClassSlot as SharedClassSlot, type RoutineBlock } from '@todo/shared';
import { shadeFor, shadeProps } from '../../lib/calendarColors';
import { cx } from '../../lib/cx';
import { WEEKDAY_NAME } from '../../lib/dates';
import { BlockText, blockPadding } from '../../ui/blocks';
import { IconButton } from '../../ui/Button';
import { localDateTime } from '../calendar/calendarModel';
import { formatTimeRange } from '../calendar/format';
import '../../styles/calendar.css';

// The template is drawn on one fixed reference week, so FullCalendar does the dragging and resizing.

/** A class from Courses, shown on the grid for reference (edited in Courses). */
export interface ClassSlot extends SharedClassSlot {
  color: CalendarColor;
}

export type Slot = Pick<RoutineBlock, 'weekday' | 'start' | 'end'>;

interface Props {
  blocks: readonly RoutineBlock[];
  classes: readonly ClassSlot[];
  calendarsById: ReadonlyMap<string, Calendar>;
  /** Phones show one day at a time. */
  day: number | null;
  onOpen: (block: RoutineBlock) => void;
  onCreate: (slot: Slot) => void;
  onMove: (block: RoutineBlock, slot: Slot) => Promise<boolean>;
  onCopyDay: (weekday: number) => void;
}

const slotOf = (start: Date, end: Date | null): Slot => {
  const s = localDateTime(start);
  const e = end ? localDateTime(end) : s;
  return { weekday: dayOfWeek(datePart(s)), start: timePart(s), end: timePart(e) };
};

export function WeekGrid({ blocks, classes, calendarsById, day, onOpen, onCreate, onMove, onCopyDay }: Props) {
  const ref = useRef<FullCalendar>(null);
  const view = day === null ? 'timeGridWeek' : 'timeGridDay';

  useEffect(() => {
    ref.current?.getApi().changeView(view, refDate(day ?? 1));
  }, [view, day]);

  // The stronger block takes the full width; a covered block shows only as "+1 hidden" on it, and a partly covered one as what's left (not draggable: click it to edit).
  const { events, hides } = useMemo(() => {
    const layout = layoutTemplate(blocks, classes);
    const out: EventInput[] = [];
    for (const b of blocks) {
      const whole = spanOn(refDate(b.weekday), b.start, b.end);
      const pieces = layout.pieces.get(b.id) ?? [];
      const clipped = pieces.length !== 1 || pieces[0]!.start !== whole.start || pieces[0]!.end !== whole.end;
      pieces.forEach((p, i) => out.push({ id: `${b.id}#${i}`, ...p, editable: !clipped, extendedProps: { block: b, clipped } }));
    }
    for (const c of classes) out.push({ id: c.key, start: combine(refDate(c.weekday), c.start), end: combine(refDate(c.weekday), c.end), editable: false, extendedProps: { cls: c } });
    return { events: out, hides: layout.hides };
  }, [blocks, classes]);

  function renderContent(arg: EventContentArg) {
    const { block, cls, clipped } = arg.event.extendedProps as { block?: RoutineBlock; cls?: ClassSlot; clipped?: boolean };
    if (!block && !cls) return <div className="h-full rounded-control border border-dashed border-accent bg-accent-soft" />;
    const minutes = minutesBetween(localDateTime(arg.event.start!), localDateTime(arg.event.end!));
    const title = block?.title ?? cls!.title;
    const color = block ? (block.calendarId ? (calendarsById.get(block.calendarId)?.color ?? 'slate') : null) : cls!.color;
    const look = shadeProps(color, block ? shadeFor({ kind: 'routine', priority: block.priority }) : 'solid');
    const category = block ? (block.priority === 'free' ? 'Free' : block.calendarId ? calendarsById.get(block.calendarId)?.name : undefined) : 'Class';
    const time = formatTimeRange(block?.start ?? cls!.start, block?.end ?? cls!.end);
    const hidden = (hides.get(block?.id ?? cls!.key) ?? []).map((id) => blocks.find((b) => b.id === id)!).filter(Boolean);
    const marker =
      hidden.length > 0 ? (
        <span className="text-time italic">
          +{hidden.length} hidden:{' '}
          {hidden.map((h, i) => (
            <span key={h.id} data-hidden-id={h.id} className="underline underline-offset-2">
              {h.title}
              {i < hidden.length - 1 ? ', ' : ''}
            </span>
          ))}
        </span>
      ) : null;
    return (
      <div
        style={look.style}
        title={[title, category, time, clipped && 'partly covered', ...hidden.map((h) => `hides ${h.title}`)].filter(Boolean).join(' · ')}
        className={cx('h-full overflow-hidden rounded-control text-ink', blockPadding(minutes), look.className)}
      >
        <BlockText title={title} detail={category} time={time} minutes={minutes} notes={marker && <p className="truncate">{marker}</p>} alert={minutes < 60 && hidden.length > 0 ? <span className="font-mono text-time">+{hidden.length}</span> : undefined} />
      </div>
    );
  }

  const blockOf = (info: { event: { extendedProps: Record<string, unknown> } }) => info.event.extendedProps.block as RoutineBlock | undefined;

  async function handleChange(info: EventDropArg | EventResizeDoneArg) {
    const block = blockOf(info);
    if (!block || !(await onMove(block, slotOf(info.event.start!, info.event.end)))) info.revert();
  }

  return (
    <div className="planner-cal h-full min-h-0">
      <FullCalendar
        ref={ref}
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView={view}
        initialDate={refDate(day ?? 1)}
        headerToolbar={false}
        height="100%"
        firstDay={1}
        allDaySlot={false}
        events={events}
        eventContent={renderContent}
        scrollTime="06:00:00"
        slotDuration="00:30:00"
        snapDuration="00:05:00"
        eventMinHeight={0}
        slotLabelFormat={{ hour: 'numeric', minute: '2-digit', omitZeroMinute: true, meridiem: 'short', hour12: true }}
        selectable
        selectMirror
        selectLongPressDelay={350}
        editable
        eventLongPressDelay={350}
        eventResizableFromStart
        select={(info: DateSelectArg) => {
          ref.current?.getApi().unselect();
          onCreate(slotOf(info.start, info.end));
        }}
        eventClick={(info: EventClickArg) => {
          // Tapping a name in "+1 hidden" opens that block; anywhere else opens the block itself.
          const hiddenId = (info.jsEvent.target as HTMLElement).closest<HTMLElement>('[data-hidden-id]')?.dataset.hiddenId;
          const block = hiddenId ? blocks.find((b) => b.id === hiddenId) : blockOf(info);
          if (block) onOpen(block);
        }}
        eventDrop={(info) => void handleChange(info)}
        eventResize={(info) => void handleChange(info)}
        dayHeaderContent={(arg) => {
          // Header dates are midnight UTC, so read the weekday in UTC.
          const weekday = arg.date.getUTCDay();
          return (
            <span className="flex items-center justify-between gap-1 px-2 py-1.5">
              <span className="text-label text-ink-muted uppercase">{WEEKDAY_NAME[weekday]!.slice(0, 3)}</span>
              <IconButton icon={Copy} label={`Copy ${WEEKDAY_NAME[weekday]} to other days`} onClick={() => onCopyDay(weekday)} className="size-7" />
            </span>
          );
        }}
      />
    </div>
  );
}
