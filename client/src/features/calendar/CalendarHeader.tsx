import { CalendarClock, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, FileUp, Flame, ListChecks, PanelRight } from 'lucide-react';
import { cx } from '../../lib/cx';
import { Button, IconButton } from '../../ui/Button';
import { Segmented } from '../../ui/Segmented';
import { CALENDAR_VIEWS, type CalendarViewId } from './calendarModel';

export interface Layers {
  events: boolean;
  tasks: boolean;
  /** Time blocks: time set aside to work on a to-do. */
  blocks: boolean;
  /** The weekly routine from the Week page (Week and Day views only). */
  routine: boolean;
}

interface CalendarHeaderProps {
  title: string;
  view: CalendarViewId;
  layers: Layers;
  onView: (view: CalendarViewId) => void;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLayers: (layers: Layers) => void;
  onImport: () => void;
  /** The workload map (month view): shade each day by how heavy it is. */
  heat: boolean;
  onHeat: (on: boolean) => void;
  /** The to-do panel beside the week and day views, which you drag from to set time aside. */
  panel: boolean;
  onPanel: (on: boolean) => void;
}

const UNIT: Record<CalendarViewId, string> = { month: 'month', week: 'week', day: 'day', agenda: 'week' };

/** The calendar's controls: the title, previous / next / today, the view switcher, and which layers show. */
export function CalendarHeader({ title, view, layers, onView, onToday, onPrev, onNext, onLayers, onImport, heat, onHeat, panel, onPanel }: CalendarHeaderProps) {
  return (
    <header className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <h1 className="mr-auto min-w-0 font-display text-section">
        <span className="sr-only">Calendar: </span>
        {title}
      </h1>

      <div className="flex items-center gap-1">
        <Button variant="secondary" onClick={onToday}>
          Today
        </Button>
        <IconButton icon={ChevronLeft} label={`Previous ${UNIT[view]}`} onClick={onPrev} />
        <IconButton icon={ChevronRight} label={`Next ${UNIT[view]}`} onClick={onNext} />
      </div>

      <Segmented label="Calendar view" value={view} onChange={onView} options={CALENDAR_VIEWS.map((v) => ({ value: v.id, label: v.label }))} />

      <div role="group" aria-label="Show on the calendar" className="flex items-center gap-1">
        <LayerToggle icon={CalendarDays} label="Events" on={layers.events} onChange={(events) => onLayers({ ...layers, events })} />
        <LayerToggle icon={ListChecks} label="To-dos" on={layers.tasks} onChange={(tasks) => onLayers({ ...layers, tasks })} />
        <LayerToggle icon={CalendarClock} label="Time blocks" on={layers.blocks} onChange={(blocks) => onLayers({ ...layers, blocks })} />
        {(view === 'week' || view === 'day') && <LayerToggle icon={CalendarRange} label="Routine" on={layers.routine} onChange={(routine) => onLayers({ ...layers, routine })} />}
      </div>

      {view === 'month' && <LayerToggle icon={Flame} label="Workload" on={heat} onChange={onHeat} title={heat ? 'Hide the workload shading' : 'Shade each day by how heavy it is'} />}
      {(view === 'week' || view === 'day') && (
        <span className="max-lg:hidden">
          <LayerToggle icon={PanelRight} label="To schedule" on={panel} onChange={onPanel} title={panel ? 'Hide the to-do list' : 'Show your to-dos to drag onto the calendar'} />
        </span>
      )}

      <Button variant="secondary" icon={FileUp} onClick={onImport} title="Find events in a picture, PDF, Word document, text or calendar file">
        <span className="max-sm:sr-only">Import from file</span>
      </Button>
    </header>
  );
}

function LayerToggle({ icon: Icon, label, on, onChange, title }: { icon: typeof CalendarDays; label: string; on: boolean; onChange: (on: boolean) => void; title?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title ?? `${on ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
      onClick={() => onChange(!on)}
      className={cx(
        'inline-flex h-8 items-center justify-center gap-1.5 rounded-control border px-2.5 text-body transition-colors duration-150 ease-out max-sm:w-8 max-sm:px-0',
        on ? 'border-ink text-ink hover:bg-accent-soft' : 'border-rule text-ink-muted hover:border-ink-muted hover:text-ink',
      )}
    >
      <Icon className="size-4" aria-hidden />
      <span className="max-sm:sr-only">{label}</span>
    </button>
  );
}
