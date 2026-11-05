import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useApp } from '../app/AppContext';
import { AgendaView } from '../features/calendar/AgendaView';
import { buildItems, calendarUrl, dataRange, isCalendarView, parseCalendarQuery, shiftDate, viewTitle, type CalendarItem, type CalendarViewId } from '../features/calendar/calendarModel';
import { CalendarHeader, type Layers } from '../features/calendar/CalendarHeader';
import { CalendarView } from '../features/calendar/CalendarView';
import { ItemDetail } from '../features/calendar/ItemDetail';
import { QuickCreate, type Selection } from '../features/calendar/QuickCreate';
import { usePersistedState } from '../hooks/usePersistedState';
import type { PopoverAnchor } from '../ui/Popover';
import { ErrorBanner } from '../ui/states';

const isLayers = (v: unknown): v is Layers => typeof v === 'object' && v !== null && typeof (v as Layers).events === 'boolean' && typeof (v as Layers).tasks === 'boolean';

/** A phone has no room for a month grid, so it starts on the agenda. */
const firstView = (): CalendarViewId => (typeof matchMedia === 'function' && matchMedia('(max-width: 639px)').matches ? 'agenda' : 'month');

/**
 * The calendar. Which view and date it shows live in the address bar (/calendar?view=week&date=...),
 * so a link, the mini month, and the back button all land in the right place. With no view in the
 * address, it opens on the one you used last.
 */
export default function CalendarPage() {
  const app = useApp();
  const { events, tasks, calendarsById, hiddenCalendarIds, today } = app;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const query = parseCalendarQuery(params, today);

  const [lastView, setLastView] = usePersistedState<CalendarViewId>('voice-todo.calendar.view', firstView(), isCalendarView);
  const [layers, setLayers] = usePersistedState<Layers>('voice-todo.calendar.layers', { events: true, tasks: true }, isLayers);
  const view = query.view ?? lastView;
  const { date } = query;

  const [selection, setSelection] = useState<Selection | null>(null);
  const [detail, setDetail] = useState<{ item: CalendarItem; anchor: PopoverAnchor } | null>(null);

  // Moving to another view or date puts any open card away.
  useEffect(() => {
    setSelection(null);
    setDetail(null);
  }, [view, date]);

  const items = useMemo(() => {
    const [from, to] = dataRange(date);
    return buildItems({ events, tasks, calendarsById, hiddenCalendarIds, showEvents: layers.events, showTasks: layers.tasks }, from, to);
  }, [events, tasks, calendarsById, hiddenCalendarIds, layers, date]);

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
      />

      {app.error && <ErrorBanner message={app.error} onRetry={() => void app.reload()} onDismiss={app.dismissError} />}

      <div className="min-h-0 flex-1">
        {view === 'agenda' ? (
          <AgendaView date={date} items={items} onOpenItem={(item, anchor) => setDetail({ item, anchor })} onCreate={newEventHere} />
        ) : (
          <CalendarView
            view={view}
            date={date}
            items={items}
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
          />
        )}
      </div>

      {selection && <QuickCreate selection={selection} onClose={() => setSelection(null)} />}
      {detail && <ItemDetail item={detail.item} anchor={detail.anchor} onClose={() => setDetail(null)} />}
    </div>
  );
}
