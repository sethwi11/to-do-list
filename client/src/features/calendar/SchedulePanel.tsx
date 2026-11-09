import { useEffect, useMemo, useRef, useState } from 'react';
import { Draggable } from '@fullcalendar/interaction';
import { CalendarPlus, GripVertical, Search } from 'lucide-react';
import { blockMinutesFor, formatMinutes, isOverdue } from '@todo/shared';
import { useApp } from '../../app/AppContext';
import { calendarVars } from '../../lib/calendarColors';
import { formatDueDate } from '../../lib/dates';
import { cx } from '../../lib/cx';
import { IconButton } from '../../ui/Button';
import { Input } from '../../ui/fields';

/** Your open to-dos, beside the Week and Day calendar. */
export function SchedulePanel() {
  const { tasks, calendarsById, scheduledMinutesByTask, today, openDialog } = useApp();
  const [query, setQuery] = useState('');
  const list = useRef<HTMLUListElement>(null);

  const open = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter((t) => t.status === 'todo' && (!q || t.title.toLowerCase().includes(q)))
      .sort((a, b) => {
        const scheduled = Number(scheduledMinutesByTask.has(a.id)) - Number(scheduledMinutesByTask.has(b.id));
        return scheduled || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.sortOrder - b.sortOrder;
      });
  }, [tasks, query, scheduledMinutesByTask]);

  // FullCalendar's own way of dragging something from outside it onto the grid.
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const draggable = new Draggable(el, {
      itemSelector: '[data-schedule-task]',
      minDistance: 4,
      eventData: (item) => ({ title: item.dataset.title ?? '', duration: { minutes: Number(item.dataset.minutes) || 60 }, create: false }),
    });
    return () => draggable.destroy();
  }, []);

  return (
    <aside aria-label="To-dos to schedule" className="hidden min-h-0 w-72 shrink-0 flex-col border-l border-hairline pl-5 lg:flex">
      <h2 className="mb-1 text-label text-ink-muted uppercase">To schedule</h2>
      <p className="mb-3 text-meta text-ink-muted">Drag a to-do onto a time to set that time aside for it.</p>
      <label className="relative mb-2 block">
        <span className="sr-only">Find a to-do</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
        <Input type="search" value={query} placeholder="Find a to-do" className="pl-9" onChange={(e) => setQuery(e.target.value)} />
      </label>
      <ul ref={list} aria-label="Open to-dos" className="min-h-0 flex-1 overflow-y-auto border-t border-hairline">
        {open.map((t) => {
          const calendar = t.calendarId ? calendarsById.get(t.calendarId) : undefined;
          const planned = scheduledMinutesByTask.get(t.id);
          return (
            <li
              key={t.id}
              data-schedule-task
              data-task-id={t.id}
              data-title={t.title}
              data-minutes={blockMinutesFor(t)}
              style={calendar ? calendarVars(calendar.color) : undefined}
              className={cx('group flex cursor-grab items-start gap-1 border-b border-hairline py-2 pr-1 pl-1 hover:bg-surface', calendar && 'border-l-[3px] border-l-(color:--c)')}
            >
              <GripVertical aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-muted" />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-body break-words">{t.title}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-3 font-mono text-time text-ink-muted">
                  {t.dueDate && <span className={cx(isOverdue(t, today) && 'text-danger')}>Due {formatDueDate(t.dueDate, today)}</span>}
                  <span>{formatMinutes(blockMinutesFor(t))}{t.estimatedMinutes ? '' : ' (default)'}</span>
                  {planned ? <span className="text-ink">{formatMinutes(planned)} set aside</span> : null}
                </span>
              </span>
              <IconButton icon={CalendarPlus} label={`Set time aside for "${t.title}"`} onClick={() => openDialog({ kind: 'schedule', taskId: t.id })} className="shrink-0" />
            </li>
          );
        })}
        {open.length === 0 && <li className="py-6 font-display text-title text-ink-muted italic">{query ? 'No to-do matches.' : 'Nothing left to schedule.'}</li>}
      </ul>
    </aside>
  );
}
