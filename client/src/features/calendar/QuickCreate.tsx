import { useState, type FormEvent } from 'react';
import { useApp } from '../../app/AppContext';
import { usePersistedState } from '../../hooks/usePersistedState';
import { Button } from '../../ui/Button';
import { Input, Select } from '../../ui/fields';
import { Popover, type PopoverAnchor } from '../../ui/Popover';
import { formatWhen } from './format';
import { withNewStart, fromTimeFields, timeProblem, toTimeFields } from '../events/eventForm';

export interface Selection {
  start: string;
  /** Exclusive for an all-day selection. */
  end: string;
  allDay: boolean;
  anchor: PopoverAnchor;
}

const isString = (v: unknown): v is string => typeof v === 'string';

/**
 * The little card that appears when you drag out a time (or click a day): type a title, press
 * Enter, done. "More options" opens the full form with the same values filled in.
 */
export function QuickCreate({ selection, onClose }: { selection: Selection; onClose: () => void }) {
  const { calendars, createEvent, openDialog } = useApp();
  const [lastCalendar, setLastCalendar] = usePersistedState('voice-todo.calendar.lastUsed', '', isString);
  const [title, setTitle] = useState('');
  const [calendarId, setCalendarId] = useState(calendars.some((c) => c.id === lastCalendar) ? lastCalendar : '');
  const [time, setTime] = useState(() => toTimeFields(selection.start, selection.end, selection.allDay));
  const [error, setError] = useState<string | undefined>();

  const span = fromTimeFields(time);

  function more() {
    onClose();
    openDialog({ kind: 'event', mode: 'new', defaults: { ...span, allDay: time.allDay, calendarId: calendarId || null, title: title.trim() || undefined } });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError('Give it a title.');
    const problem = timeProblem(time);
    if (problem) return setError(problem);
    setLastCalendar(calendarId);
    onClose();
    await createEvent({ title: title.trim(), ...span, allDay: time.allDay, calendarId: calendarId || null });
  }

  return (
    <Popover anchor={selection.anchor} label="New event" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3 p-4">
        <div>
          <Input
            aria-label="Event title"
            placeholder="New event"
            value={title}
            maxLength={200}
            data-autofocus
            aria-invalid={error && !title.trim() ? true : undefined}
            onChange={(e) => {
              setTitle(e.target.value);
              setError(undefined);
            }}
          />
          {error && (
            <p role="alert" className="mt-1.5 text-meta text-danger">
              {error}
            </p>
          )}
        </div>

        {time.allDay ? (
          <p className="text-meta text-ink-muted">{formatWhen(span.start, span.end, true)}</p>
        ) : (
          <div className="space-y-2">
            <Input aria-label="Date" type="date" value={time.startDate} onChange={(e) => setTime(withNewStart(time, e.target.value, time.startTime))} />
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <Input aria-label="Start time" type="time" value={time.startTime} onChange={(e) => setTime(withNewStart(time, time.startDate, e.target.value))} />
              <span aria-hidden className="text-ink-muted">
                –
              </span>
              <Input
                aria-label="End time"
                type="time"
                value={time.endTime}
                onChange={(e) => {
                  setTime({ ...time, endTime: e.target.value, endDate: time.startDate });
                  setError(undefined);
                }}
              />
            </div>
          </div>
        )}

        <Select aria-label="Calendar" value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
          <option value="">No calendar</option>
          {calendars.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        <div className="flex items-center justify-between pt-1">
          <Button variant="ghost" onClick={more}>
            More options
          </Button>
          <Button variant="primary" type="submit">
            Add
          </Button>
        </div>
      </form>
    </Popover>
  );
}
