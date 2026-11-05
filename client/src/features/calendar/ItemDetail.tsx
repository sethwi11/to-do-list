import type { ReactNode } from 'react';
import { ExternalLink, ListChecks, MapPin, Pencil, Repeat, Tag, Trash2, X } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { calendarVars } from '../../lib/calendarColors';
import { formatDueDate, formatTime } from '../../lib/dates';
import { IconButton } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Popover, type PopoverAnchor } from '../../ui/Popover';
import type { CalendarItem } from './calendarModel';
import { describeRepeat, formatWhen } from './format';

const REPEAT_WORDS = { daily: 'every day', weekdays: 'every weekday', weekly: 'every week', monthly: 'every month' } as const;

/** What you see when you click something on the calendar: the details, and Edit / Delete. */
export function ItemDetail({ item, anchor, onClose }: { item: CalendarItem; anchor: PopoverAnchor; onClose: () => void }) {
  return (
    <Popover anchor={anchor} label={item.kind === 'event' ? 'Event details' : 'To-do details'} onClose={onClose}>
      <div style={calendarVars(item.color)} className="border-l-[3px] border-l-(color:--c) p-4">
        {item.kind === 'event' ? <EventDetail item={item} onClose={onClose} /> : <TaskDetail item={item} onClose={onClose} />}
      </div>
    </Popover>
  );
}

function Row({ icon: Icon, children }: { icon: typeof MapPin; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-body text-ink">
      <Icon className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}

function Header({ title, onClose }: { title: ReactNode; onClose: () => void }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2">
      <h2 className="min-w-0 font-display text-section break-words">{title}</h2>
      <IconButton icon={X} label="Close" onClick={onClose} className="-mt-1 -mr-2 shrink-0" />
    </div>
  );
}

function CalendarLine({ item }: { item: CalendarItem }) {
  if (!item.calendarName) return null;
  return (
    <p className="flex items-center gap-2 text-meta text-ink-muted">
      <span aria-hidden className="size-2.5 bg-(color:--c)" />
      {item.calendarName}
    </p>
  );
}

function Notes({ text }: { text: string | null }) {
  return text ? <p className="line-clamp-4 text-meta whitespace-pre-wrap text-ink-muted">{text}</p> : null;
}

function EventDetail({ item, onClose }: { item: Extract<CalendarItem, { kind: 'event' }>; onClose: () => void }) {
  const { openDialog, deleteEvent, eventTypesById, events } = useApp();
  const { occurrence } = item;
  const event = occurrence.event;
  // An override ("this one moved") has no rule of its own; its series does.
  const rule = (occurrence.seriesId ? events.find((e) => e.id === occurrence.seriesId) : event)?.recurrence ?? null;
  const type = event.typeId ? eventTypesById.get(event.typeId) : undefined;

  return (
    <>
      <Header title={event.title} onClose={onClose} />
      <div className="space-y-2">
        <p className="font-mono text-meta text-ink-muted">{formatWhen(occurrence.start, occurrence.end, occurrence.allDay)}</p>
        {rule && (
          <Row icon={Repeat}>
            {describeRepeat(rule)}
            {occurrence.isOverride && <span className="text-ink-muted"> (this one was changed)</span>}
          </Row>
        )}
        {event.location && <Row icon={MapPin}>{event.location}</Row>}
        {event.link && (
          <Row icon={ExternalLink}>
            {/* noopener: the page we open must not get a handle back to this one. */}
            <a href={event.link} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline underline-offset-2">
              {new URL(event.link).host}
            </a>
          </Row>
        )}
        {type && <Row icon={Tag}>{type.name}</Row>}
        <CalendarLine item={item} />
        <Notes text={event.notes} />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3">
        <IconButton
          icon={Trash2}
          label="Delete event"
          className="text-danger"
          onClick={() => {
            onClose();
            void deleteEvent(occurrence);
          }}
        />
        <button
          type="button"
          onClick={() => {
            onClose();
            openDialog({ kind: 'event', mode: 'edit', occurrence });
          }}
          className="inline-flex h-8 items-center gap-2 rounded-control border border-ink px-3 text-body font-medium text-ink transition-colors duration-150 ease-out hover:bg-accent-soft"
        >
          <Pencil className="size-4" aria-hidden />
          Edit
        </button>
      </div>
    </>
  );
}

function TaskDetail({ item, onClose }: { item: Extract<CalendarItem, { kind: 'task' }>; onClose: () => void }) {
  const { openDialog, removeTask, toggleTask, today } = useApp();
  const { task } = item;
  const done = task.status === 'done';
  const subtasksDone = task.subtasks.filter((s) => s.done).length;

  return (
    <>
      <div className="mb-3 flex items-start gap-1">
        <Checkbox
          checked={done}
          label={`Mark "${task.title}" as ${done ? 'not done' : 'done'}`}
          onChange={() => {
            onClose();
            void toggleTask(task);
          }}
          className="-ml-2"
        />
        <h2 className={`min-w-0 flex-1 pt-1 font-display text-section break-words ${done ? 'text-ink-muted line-through' : ''}`}>{task.title}</h2>
        <IconButton icon={X} label="Close" onClick={onClose} className="-mt-0 -mr-2 shrink-0" />
      </div>
      <div className="space-y-2">
        <p className="font-mono text-meta text-ink-muted">
          To-do · due {formatDueDate(task.dueDate!, today)}
          {task.dueTime && ` at ${formatTime(task.dueTime)}`}
        </p>
        {task.subtasks.length > 0 && (
          <Row icon={ListChecks}>
            {subtasksDone} of {task.subtasks.length} subtasks done
          </Row>
        )}
        {task.recurrence !== 'none' && <Row icon={Repeat}>Repeats {REPEAT_WORDS[task.recurrence]}</Row>}
        <CalendarLine item={item} />
        <Notes text={task.notes} />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3">
        <IconButton
          icon={Trash2}
          label="Delete task"
          className="text-danger"
          onClick={() => {
            onClose();
            void removeTask(task);
          }}
        />
        <button
          type="button"
          onClick={() => {
            onClose();
            openDialog({ kind: 'task', mode: 'edit', id: task.id });
          }}
          className="inline-flex h-8 items-center gap-2 rounded-control border border-ink px-3 text-body font-medium text-ink transition-colors duration-150 ease-out hover:bg-accent-soft"
        >
          <Pencil className="size-4" aria-hidden />
          Edit
        </button>
      </div>
    </>
  );
}
