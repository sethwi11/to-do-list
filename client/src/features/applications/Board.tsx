import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { APPLICATION_STATUSES, type Application, type ApplicationStatus, type CalendarColor } from '@todo/shared';
import { cx } from '../../lib/cx';
import { KanbanColumn } from '../../ui/kanban';
import { ApplicationCard } from './ApplicationCard';

interface BoardProps {
  applications: Application[];
  color: CalendarColor;
  calendarName?: string;
  /** Applications the follow-up rule has something to say about. */
  followUpIds: ReadonlySet<string>;
  /** A card was dropped in `status`, just before `beforeId` (null = at the end of that column). */
  onMove: (application: Application, status: ApplicationStatus, beforeId: string | null) => void;
}

const COLUMN_PREFIX = 'col:';
const isColumn = (id: UniqueIdentifier) => String(id).startsWith(COLUMN_PREFIX);

/**
 * The kanban board: a column per status, cards you drag between them. Dropping a card in another column is a status
 * change (the server writes it into the timeline); dropping it elsewhere in its own column just reorders it.
 *
 * Mouse and touch can grab a card anywhere (touch needs a short press, so scrolling the board still works); keyboard
 * and screen reader users use the grip beside each card (focus it, Space to pick up, arrows to move, Space to drop). The
 * detail page and the table have a plain status menu as well.
 */
export function Board({ applications, color, calendarName, followUpIds, onMove }: BoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<ApplicationStatus | null>(null);

  const byId = useMemo(() => new Map(applications.map((a) => [a.id, a])), [applications]);
  const columns = useMemo(
    () => Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, applications.filter((a) => a.status === s).sort((a, b) => a.sortOrder - b.sortOrder)])) as Record<ApplicationStatus, Application[]>,
    [applications],
  );
  const active = activeId ? byId.get(activeId) : undefined;

  const statusOf = (id: UniqueIdentifier | null | undefined): ApplicationStatus | null => {
    if (id === null || id === undefined) return null;
    return isColumn(id) ? (String(id).slice(COLUMN_PREFIX.length) as ApplicationStatus) : (byId.get(String(id))?.status ?? null);
  };
  const nameOf = (id: UniqueIdentifier) => byId.get(String(id))?.company ?? 'card';

  const announcements: Announcements = {
    onDragStart: ({ active: a }) => `Picked up ${nameOf(a.id)}.`,
    onDragOver: ({ active: a, over }) => (over ? `${nameOf(a.id)} is over ${statusOf(over.id) ?? 'the board'}.` : undefined),
    onDragEnd: ({ active: a, over }) => (over ? `${nameOf(a.id)} was dropped in ${statusOf(over.id) ?? 'the board'}.` : `${nameOf(a.id)} was put back.`),
    onDragCancel: ({ active: a }) => `Moving ${nameOf(a.id)} was cancelled.`,
  };

  function handleDragEnd({ active: dragged, over }: DragEndEvent) {
    setActiveId(null);
    setOverStatus(null);
    const app = byId.get(String(dragged.id));
    const status = statusOf(over?.id);
    if (!app || !over || !status || over.id === dragged.id) return;

    // Dropped on a column (its empty space or header): the end of it. Dropped on a card: above it or below it,
    // depending on which half of that card the dragged card's middle is over.
    let beforeId: string | null = null;
    if (!isColumn(over.id)) {
      const others = columns[status].filter((a) => a.id !== app.id);
      const at = others.findIndex((a) => a.id === over.id);
      const rect = dragged.rect.current.translated;
      const below = rect ? rect.top + rect.height / 2 > over.rect.top + over.rect.height / 2 : false;
      beforeId = others[at + (below ? 1 : 0)]?.id ?? null;
    }
    onMove(app, status, beforeId);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      accessibility={{ announcements }}
      onDragStart={({ active: a }) => setActiveId(String(a.id))}
      onDragOver={({ over }) => setOverStatus(statusOf(over?.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setOverStatus(null);
      }}
    >
      {/* Seven columns don't fit beside the sidebar, so the board scrolls sideways instead of squeezing the cards. */}
      <div className="-mx-1 flex overflow-x-auto px-1 pb-4">
        {APPLICATION_STATUSES.map((status) => (
          <Column key={status} status={status} applications={columns[status]} highlighted={overStatus === status && !!active && active.status !== status} color={color} calendarName={calendarName} followUpIds={followUpIds} />
        ))}
      </div>
      <DragOverlay>
        {active && (
          <div className="cursor-grabbing rounded-control border border-rule bg-surface px-3">
            <ApplicationCard application={active} color={color} calendarName={calendarName} needsFollowUp={followUpIds.has(active.id)} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ status, applications, highlighted, color, calendarName, followUpIds }: { status: ApplicationStatus; applications: Application[]; highlighted: boolean; color: CalendarColor; calendarName?: string; followUpIds: ReadonlySet<string> }) {
  const { setNodeRef } = useDroppable({ id: `${COLUMN_PREFIX}${status}` });
  return (
    <KanbanColumn title={status} count={applications.length} className={cx('transition-colors duration-150 ease-out', highlighted && 'bg-accent-soft')}>
      <div ref={setNodeRef} className="min-h-32 pb-4">
        <SortableContext items={applications.map((a) => a.id)} strategy={verticalListSortingStrategy}>
          {applications.map((a) => (
            <SortableCard key={a.id} application={a} color={color} calendarName={calendarName} needsFollowUp={followUpIds.has(a.id)} />
          ))}
        </SortableContext>
        {applications.length === 0 && <p className="pt-3 text-meta text-ink-muted">Nothing here.</p>}
      </div>
    </KanbanColumn>
  );
}

function SortableCard({ application, color, calendarName, needsFollowUp }: { application: Application; color: CalendarColor; calendarName?: string; needsFollowUp: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: application.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...listeners}
      className={cx('group relative cursor-grab border-b border-hairline touch-manipulation', isDragging && 'opacity-40')}
    >
      {/* The grip is the keyboard's way to pick the card up (the pointer can grab the whole card). */}
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        aria-label={`Move ${application.company}`}
        className="absolute top-3 right-5 grid size-5 place-items-center rounded-control text-ink-muted opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 focus-visible:opacity-100"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <ApplicationCard application={application} color={color} calendarName={calendarName} needsFollowUp={needsFollowUp} />
    </div>
  );
}
