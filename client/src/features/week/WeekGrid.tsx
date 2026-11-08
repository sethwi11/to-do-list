import { useEffect, useMemo, useRef } from 'react';
import { Copy } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import interactionPlugin, { type EventResizeDoneArg } from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import type { DateSelectArg, EventClickArg, EventContentArg, EventDropArg, EventInput } from '@fullcalendar/core';
import { addDays, combine, datePart, dayOfWeek, spanOn, timePart, type Calendar, type CalendarColor, type RoutineBlock } from '@todo/shared';
import { shadeFor, shadeProps } from '../../lib/calendarColors';
import { cx } from '../../lib/cx';
import { WEEKDAY_NAME } from '../../lib/dates';
import { IconButton } from '../../ui/Button';
import { localDateTime } from '../calendar/calendarModel';
import { formatTimeRange } from '../calendar/format';
import '../../styles/calendar.css';

// The template is drawn on one fixed reference week (Monday 2001-01-01), so FullCalendar does the dragging and resizing.
const REF_MONDAY = '2001-01-01';
const refDate = (weekday: number) => addDays(REF_MONDAY, (weekday + 6) % 7);

/** A class from Courses, shown on the grid for reference (edited in Courses). */
export interface ClassSlot {
  key: string;
  title: string;
  weekday: number;
  start: string;
  end: string;
  color: CalendarColor;
}

export type Slot = Pick<RoutineBlock, 'weekday' | 'start' | 'end'>;

interface Props {
  blocks: readonly RoutineBlock[];
  classes: readonly ClassSlot[];
  /** Block id -> the stronger block that keeps the overlapping time. */
  covered: ReadonlyMap<string, RoutineBlock>;
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

export function WeekGrid({ blocks, classes, covered, calendarsById, day, onOpen, onCreate, onMove, onCopyDay }: Props) {
  const ref = useRef<FullCalendar>(null);
  const view = day === null ? 'timeGridWeek' : 'timeGridDay';

  useEffect(() => {
    const api = ref.current?.getApi();
    if (!api) return;
    api.changeView(view, refDate(day ?? 1));
  }, [view, day]);

  const events = useMemo<EventInput[]>(
    () => [
      ...blocks.map((b) => ({ id: b.id, ...spanOn(refDate(b.weekday), b.start, b.end), extendedProps: { block: b } })),
      ...classes.map((c) => ({ id: c.key, start: combine(refDate(c.weekday), c.start), end: combine(refDate(c.weekday), c.end), editable: false, extendedProps: { cls: c } })),
    ],
    [blocks, classes],
  );

  function renderContent(arg: EventContentArg) {
    const { block, cls } = arg.event.extendedProps as { block?: RoutineBlock; cls?: ClassSlot };
    if (!block && !cls) return <div className="h-full rounded-control border border-dashed border-accent bg-accent-soft" />;
    const title = block?.title ?? cls!.title;
    const color = block ? (block.calendarId ? (calendarsById.get(block.calendarId)?.color ?? 'slate') : null) : cls!.color;
    const look = shadeProps(color, block ? shadeFor({ kind: 'routine', priority: block.priority }) : 'solid');
    const winner = block && covered.get(block.id);
    const category = block ? (block.calendarId ? calendarsById.get(block.calendarId)?.name : 'Free') : 'Class';
    return (
      <div style={look.style} title={winner ? `${title}: ${winner.title} keeps this time` : title} className={cx('h-full overflow-hidden rounded-control px-1.5 py-0.5 text-ink', look.className, winner && 'opacity-55')}>
        <p className="truncate text-meta leading-tight font-semibold">{title}</p>
        <p className="truncate text-time">
          {winner ? `under ${winner.title}` : category} · <span className="font-mono">{formatTimeRange(block?.start ?? cls!.start, block?.end ?? cls!.end)}</span>
        </p>
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
        eventMinHeight={20}
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
          const block = blockOf(info);
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
