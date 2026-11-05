import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { CALENDAR_COLORS, type Calendar, type CalendarColor } from '@todo/shared';
import { useApp } from '../../app/AppContext';
import { calendarVars } from '../../lib/calendarColors';
import { tasksUrl } from '../../lib/taskParams';
import { Button } from '../../ui/Button';
import { Field, Input } from '../../ui/fields';
import { Dialog } from '../../ui/Panel';

const colorLabel = (c: CalendarColor) => c.charAt(0).toUpperCase() + c.slice(1).replace('-', ' ');

/** Create a calendar, or rename, recolor, or delete one. */
export function CalendarDialog() {
  const { dialog, closeDialog, calendarsById, tasks, removeCalendar } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const open = dialog?.kind === 'calendar';
  const editing = open && dialog.id !== 'new' ? (calendarsById.get(dialog.id) ?? null) : null;
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) setConfirming(false);
  }, [open]);

  const taskCount = editing ? tasks.filter((t) => t.calendarId === editing.id).length : 0;

  async function remove(calendar: Calendar) {
    if (await removeCalendar(calendar.id)) {
      closeDialog('calendar');
      // If the list on screen was filtered to this calendar, it no longer exists: go back to all tasks.
      if (new URLSearchParams(location.search).get('calendar') === calendar.id) navigate(tasksUrl());
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => closeDialog('calendar')}
      title={editing ? 'Edit calendar' : 'New calendar'}
      footer={
        confirming && editing ? (
          <>
            <p className="mr-auto self-center text-meta text-ink-muted">
              {taskCount > 0 ? `Its ${taskCount} task${taskCount === 1 ? '' : 's'} will stay, without a calendar.` : 'It has no tasks.'}
            </p>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button variant="primary" onClick={() => void remove(editing)}>
              Delete calendar
            </Button>
          </>
        ) : (
          <>
            {editing && (
              <Button variant="ghost" className="mr-auto text-danger" onClick={() => setConfirming(true)}>
                Delete
              </Button>
            )}
            <Button variant="ghost" onClick={() => closeDialog('calendar')}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="calendar-form">
              {editing ? 'Save' : 'Create'}
            </Button>
          </>
        )
      }
    >
      {open && <CalendarForm calendar={editing} />}
    </Dialog>
  );
}

function CalendarForm({ calendar }: { calendar: Calendar | null }) {
  const { createCalendar, updateCalendar, closeDialog } = useApp();
  const [name, setName] = useState(calendar?.name ?? '');
  const [color, setColor] = useState<CalendarColor>(calendar?.color ?? 'ochre');
  const [error, setError] = useState<string | undefined>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Give the calendar a name.');
      return;
    }
    const ok = calendar ? await updateCalendar(calendar.id, { name: name.trim(), color }) : (await createCalendar(name.trim(), color)) !== null;
    if (ok) closeDialog('calendar');
  }

  return (
    <form id="calendar-form" onSubmit={submit} className="space-y-5">
      <Field label="Name" error={error}>
        {(p) => (
          <Input
            {...p}
            value={name}
            maxLength={50}
            data-autofocus
            placeholder="School, ACM, Gym…"
            onChange={(e) => {
              setName(e.target.value);
              setError(undefined);
            }}
          />
        )}
      </Field>

      {/* A radio group: arrow keys move between colors, and screen readers announce each color's name. */}
      <fieldset>
        <legend className="mb-1.5 text-label text-ink-muted uppercase">Color</legend>
        <div className="flex flex-wrap gap-2">
          {CALENDAR_COLORS.map((c) => (
            <label key={c} title={colorLabel(c)} className="cursor-pointer" style={calendarVars(c)}>
              <input type="radio" name="calendar-color" value={c} checked={color === c} onChange={() => setColor(c)} className="peer sr-only" />
              <span className="sr-only">{colorLabel(c)}</span>
              <span aria-hidden className="block size-7 bg-(color:--c) outline-offset-2 peer-checked:outline-2 peer-checked:outline-ink peer-focus-visible:outline-2 peer-focus-visible:outline-accent" />
            </label>
          ))}
        </div>
      </fieldset>
    </form>
  );
}
