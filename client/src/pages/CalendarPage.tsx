import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { addDays, eachDate, planDay, workloadByDay, type PlanItem } from '@todo/shared';
import { DayChangeDialog } from '../features/today/DayChangeDialog';
import { usePlanSources } from '../features/today/useTodayPlan';
import { weekStart } from '../features/calendar/calendarModel';
import { useApp } from '../app/AppContext';
import { AgendaView } from '../features/calendar/AgendaView';
import { attachChips, buildItems, calendarUrl, dataRange, isCalendarView, parseCalendarQuery, shiftDate, viewTitle, type CalendarItem, type CalendarViewId } from '../features/calendar/calendarModel';
import { CalendarHeader, type Layers } from '../features/calendar/CalendarHeader';
import { CalendarView } from '../features/calendar/CalendarView';
import { ItemDetail } from '../features/calendar/ItemDetail';
import { HeatLegend } from '../features/calendar/HeatLegend';
import { QuickCreate, type Selection } from '../features/calendar/QuickCreate';
import { SchedulePanel } from '../features/calendar/SchedulePanel';
import { usePersistedState } from '../hooks/usePersistedState';
import type { PopoverAnchor } from '../ui/Popover';
import { ErrorBanner } from '../ui/states';

// Layers saved before time blocks or the routine existed lack those keys: still a valid choice (they default to shown).
type SavedLayers = Pick<Layers, 'events' | 'tasks'> & Partial<Pick<Layers, 'blocks' | 'routine'>>;
const optionalBool = (v: unknown) => v === undefined || typeof v === 'boolean';
const isLayers = (v: unknown): v is SavedLayers =>
  typeof v === 'object' && v !== null && typeof (v as Layers).events === 'boolean' && typeof (v as Layers).tasks === 'boolean' && optionalBool((v as Layers).blocks) && optionalBool((v as Layers).routine);
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';

/** A phone has no room for a month grid, so it starts on the agenda. */
const firstView = (): CalendarViewId => (typeof matchMedia === 'function' && matchMedia('(max-width: 639px)').matches ? 'agenda' : 'month');

/** The calendar. */
export default function CalendarPage() {
  const app = useApp();
  const { events, tasks, timeBlocks, calendarsById, hiddenCalendarIds, today } = app;
  const { src } = usePlanSources();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const query = parseCalendarQuery(params, today);

  const [lastView, setLastView] = usePersistedState<CalendarViewId>('voice-todo.calendar.view', firstView(), isCalendarView);
  const [savedLayers, setLayers] = usePersistedState<SavedLayers>('voice-todo.calendar.layers', { events: true, tasks: true, blocks: true }, isLayers);
  const layers: Layers = { blocks: true, routine: true, ...savedLayers };
  const [heat, setHeat] = usePersistedState<boolean>('voice-todo.calendar.heat', false, isBoolean);
  const [panel, setPanel] = usePersistedState<boolean>('voice-todo.calendar.panel', true, isBoolean);
  const view = query.view ?? lastView;
  const { date } = query;

  const [selection, setSelection] = useState<Selection | null>(null);
  const [detail, setDetail] = useState<{ item: CalendarItem; anchor: PopoverAnchor } | null>(null);
  const [dayChange, setDayChange] = useState<PlanItem | null>(null);

  // Moving to another view or date puts any open card away.
  useEffect(() => {
    setSelection(null);
    setDetail(null);
  }, [view, date]);

  const items = useMemo(() => {
    const [from, to] = dataRange(date);
    return buildItems({ events, tasks, blocks: timeBlocks, calendarsById, hiddenCalendarIds, showEvents: layers.events, showTasks: layers.tasks, showBlocks: layers.blocks }, from, to);
  }, [events, tasks, timeBlocks, calendarsById, hiddenCalendarIds, layers.events, layers.tasks, layers.blocks, date]);

  // The routine shows on Week and Day only; Month and the workload map leave it out.
  const routine = useMemo(() => {
    if (!layers.routine || (view !== 'week' && view !== 'day')) return [];
    const days = view === 'day' ? [date] : eachDate(weekStart(date), addDays(weekStart(date), 7));
    return days.flatMap((d) => planDay(src, d).items.filter((i) => i.kind === 'routine')).filter((i) => i.calendarId === null || !hiddenCalendarIds.has(i.calendarId));
  }, [layers.routine, view, date, src, hiddenCalendarIds]);

  // To-dos with a time inside a routine block sit on top of it instead of splitting its column.
  const { items: shown, onBlock } = useMemo(() => attachChips(items, routine), [items, routine]);

  // The workload map counts everything you have on, whichever calendars are hidden from view: hiding a calendar tidies the page, but it doesn't free up your week.
  const loads = useMemo(() => {
    if (!heat || view !== 'month') return null;
    const [from, to] = dataRange(date);
    return workloadByDay(from, to, { events, blocks: timeBlocks, tasks });
  }, [heat, view, date, events, timeBlocks, tasks]);
  const showPanel = panel && (view === 'week' || view === 'day');

  function go(next: { view?: CalendarViewId; date?: string }) {
    const nextView = next.view ?? view;
    if (next.view) setLastView(next.view);
    navigate(calendarUrl({ view: nextView, date: next.date ?? date }));
  }

  function newEventHere() {
    const start = `${date}T09:00`;
    app.openDialog({ kind: 'event', mode: 'new', defaults: { start, end: `${date}T10:00` } });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CalendarHeader
        title={viewTitle(view, date)}
        view={view}
        layers={layers}
        onView={(v) => go({ view: v })}
        onToday={() => go({ date: today })}
        onPrev={() => go({ date: shiftDate(view, date, -1) })}
        onNext={() => go({ date: shiftDate(view, date, 1) })}
        onLayers={setLayers}
        onImport={app.chooseFilesToImport}
        heat={heat}
        onHeat={setHeat}
        panel={panel}
        onPanel={setPanel}
      />
      {loads && (
        <div className="mb-3">
          <HeatLegend />
        </div>
      )}

      {app.error && <ErrorBanner message={app.error} onRetry={() => void app.reload()} onDismiss={app.dismissError} />}

      <div className="flex min-h-0 flex-1 gap-5">
        <div className="min-h-0 min-w-0 flex-1">
          {view === 'agenda' ? (
            <AgendaView date={date} items={items} onOpenItem={(item, anchor) => setDetail({ item, anchor })} onCreate={newEventHere} />
          ) : (
            <CalendarView
              view={view}
              date={date}
              items={shown}
              chips={onBlock}
              hasSelection={selection !== null}
              onSelect={(s) => {
                setDetail(null);
                setSelection(s);
              }}
              onOpenItem={(item, anchor) => {
                setSelection(null);
                setDetail({ item, anchor });
              }}
              onOpenDay={(d) => go({ view: 'day', date: d })}
              loads={loads}
              routine={routine}
              onOpenRoutine={setDayChange}
            />
          )}
        </div>
        {showPanel && <SchedulePanel />}
      </div>

      {selection && <QuickCreate selection={selection} onClose={() => setSelection(null)} />}
      {detail && <ItemDetail item={detail.item} anchor={detail.anchor} onClose={() => setDetail(null)} />}
      <DayChangeDialog item={dayChange} date={dayChange ? dayChange.start.slice(0, 10) : date} onClose={() => setDayChange(null)} />
    </div>
  );
}
