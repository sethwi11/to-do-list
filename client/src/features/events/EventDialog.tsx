import { useMemo, useState, type FormEvent } from 'react';
import { dayOfWeek, findConflicts, selfIds, type EventOccurrence } from '@todo/shared';
import { useApp, type EventDefaults } from '../../app/AppContext';
import { cx } from '../../lib/cx';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Field, Input, Select, Textarea } from '../../ui/fields';
import { Dialog } from '../../ui/Panel';
import { describeConflicts } from '../calendar/format';
import { ConflictNotice } from './ConflictNotice';
import {
  fromRepeatFields,
  fromTimeFields,
  normalizeLink,
  sameRepeat,
  timeProblem,
  toRepeatFields,
  toTimeFields,
  withNewStart,
  type Repeat,
  type RepeatFields,
  type TimeFields,
} from './eventForm';

const REPEAT_LABEL: Record<Repeat, string> = {
  none: 'Never',
  daily: 'Every day',
  weekdays: 'Every weekday',
  weekly: 'Every week',
  monthly: 'Every month',
};
const REPEATS = Object.keys(REPEAT_LABEL) as Repeat[];
const WEEKDAY_INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The dialog for adding an event or editing one occurrence. Which is decided by the shared dialog state. */
export function EventDialog() {
  const { dialog, closeDialog, deleteEvent } = useApp();
  const open = dialog?.kind === 'event';
  const occurrence = open && dialog.mode === 'edit' ? dialog.occurrence : null;

  return (
    <Dialog
      open={open}
      onClose={() => closeDialog('event')}
      title={occurrence ? 'Edit event' : 'New event'}
      footer={
        <>
          {occurrence && (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              onClick={() => {
                // Asks "which events?" first if it repeats; only closes if that went through.
                void deleteEvent(occurrence).then((deleted) => deleted && closeDialog('event'));
              }}
            >
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={() => closeDialog('event')}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="event-form">
            {occurrence ? 'Save' : 'Add event'}
          </Button>
        </>
      }
    >
      {open && (
        // Mounted only while open, so the fields start fresh every time.
        <EventForm occurrence={occurrence} defaults={dialog.mode === 'new' ? dialog.defaults : null} />
      )}
    </Dialog>
  );
}

function EventForm({ occurrence, defaults }: { occurrence: EventOccurrence | null; defaults: EventDefaults | null }) {
  const { calendars, eventTypes, events, createEvent, editEvent, closeDialog } = useApp();

  // The series' rule: an override ("this one moved") has none of its own, so look the series up.
  const series = occurrence?.seriesId ? events.find((e) => e.id === occurrence.seriesId) : undefined;
  const event = occurrence?.event;
  const initialStart = occurrence?.start ?? defaults!.start;
  const initialEnd = occurrence?.end ?? defaults!.end;
  const initialAllDay = occurrence?.allDay ?? defaults?.allDay ?? false;

  const [title, setTitle] = useState(event?.title ?? defaults?.title ?? '');
  const [time, setTime] = useState<TimeFields>(() => toTimeFields(initialStart, initialEnd, initialAllDay));
  const [initialRepeat] = useState<RepeatFields>(() => toRepeatFields((series ?? event)?.recurrence ?? null, toTimeFields(initialStart, initialEnd, initialAllDay).startDate));
  const [repeat, setRepeat] = useState<RepeatFields>(initialRepeat);
  const [calendarId, setCalendarId] = useState(event?.calendarId ?? defaults?.calendarId ?? '');
  const [typeId, setTypeId] = useState(event?.typeId ?? '');
  const [location, setLocation] = useState(event?.location ?? '');
  const [link, setLink] = useState(event?.link ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [errors, setErrors] = useState<{ title?: string; time?: string; link?: string }>({});

  const repeats = !!occurrence?.isRecurring;

  // Warn (never block) if these times overlap another event. The event being edited, and its series, don't count against themselves.
  const conflicts = useMemo(() => {
    if (timeProblem(time) !== null) return [];
    const { start, end } = fromTimeFields(time);
    return findConflicts(events, { start, end, allDay: time.allDay }, occurrence ? selfIds(occurrence) : undefined);
  }, [events, time, occurrence]);

  function changeStart(startDate: string, startTime: string) {
    // A weekly repeat on just the old start's weekday follows the start to its new weekday.
    if (repeat.repeat === 'weekly' && repeat.weekdays.length === 1 && startDate && time.startDate && repeat.weekdays[0] === dayOfWeek(time.startDate)) {
      setRepeat({ ...repeat, weekdays: [dayOfWeek(startDate)] });
    }
    setTime(withNewStart(time, startDate, startTime));
  }

  function toggleWeekday(day: number) {
    const has = repeat.weekdays.includes(day);
    if (has && repeat.weekdays.length === 1) return; // a weekly repeat needs at least one day
    setRepeat({ ...repeat, weekdays: has ? repeat.weekdays.filter((d) => d !== day) : [...repeat.weekdays, day] });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!title.trim()) next.title = 'Give the event a title.';
    next.time = timeProblem(time) ?? undefined;
    const [normalizedLink, linkProblem] = normalizeLink(link);
    if (linkProblem) next.link = linkProblem;
    if (next.title || next.time || next.link) {
      setErrors(next);
      return;
    }

    const { start, end } = fromTimeFields(time);
    const fields = {
      title: title.trim(),
      start,
      end,
      allDay: time.allDay,
      calendarId: calendarId || null,
      typeId: typeId || null,
      location: location.trim() || null,
      link: normalizedLink,
      notes: notes.trim() || null,
    };

    if (!occurrence) {
      const rule = fromRepeatFields(repeat, time.startDate);
      if (await createEvent({ ...fields, recurrence: rule }, { note: describeConflicts(conflicts) })) closeDialog('event');
      return;
    }
    // Only send the repeat rule if it was changed, so an untouched one moves with the event instead of being rebuilt.
    const repeatChanged = !sameRepeat(initialRepeat, repeat, time.startDate);
    const rule = repeatChanged ? fromRepeatFields(repeat, time.startDate, (series ?? event)?.recurrence?.exdates ?? []) : undefined;
    const saved = await editEvent(occurrence, rule === undefined ? fields : { ...fields, recurrence: rule }, { note: describeConflicts(conflicts) });
    if (saved) closeDialog('event'); // on failure (or if they cancelled the scope question) the dialog stays, so nothing typed is lost
  }

  return (
    <form id="event-form" onSubmit={submit} className="space-y-4">
      <Field label="Title" error={errors.title}>
        {(p) => (
          <Input
            {...p}
            value={title}
            maxLength={200}
            placeholder="What's happening?"
            data-autofocus
            onChange={(e) => {
              setTitle(e.target.value);
              setErrors((x) => ({ ...x, title: undefined }));
            }}
          />
        )}
      </Field>

      <label className="flex w-fit cursor-pointer items-center gap-1 text-body">
        <Checkbox
          checked={time.allDay}
          onChange={(e) => setTime((t) => ({ ...t, allDay: e.target.checked }))}
          label="All day"
        />
        All day
      </label>

      <fieldset className="space-y-3" aria-describedby={errors.time ? 'event-time-error' : undefined}>
        <legend className="sr-only">When</legend>
        <div className="grid grid-cols-[1fr_9rem] gap-3 max-sm:grid-cols-[1fr_8.5rem]">
          <Field label="Start">{(p) => <Input {...p} type="date" value={time.startDate} onChange={(e) => changeStart(e.target.value, time.startTime)} />}</Field>
          <Field label="Time" className={cx(time.allDay && 'invisible')}>
            {(p) => <Input {...p} type="time" value={time.startTime} disabled={time.allDay} tabIndex={time.allDay ? -1 : undefined} onChange={(e) => changeStart(time.startDate, e.target.value)} />}
          </Field>
        </div>
        <div className="grid grid-cols-[1fr_9rem] gap-3 max-sm:grid-cols-[1fr_8.5rem]">
          <Field label={time.allDay ? 'Last day' : 'End'}>
            {(p) => <Input {...p} type="date" value={time.endDate} onChange={(e) => { setTime({ ...time, endDate: e.target.value }); setErrors((x) => ({ ...x, time: undefined })); }} />}
          </Field>
          <Field label="Time" className={cx(time.allDay && 'invisible')}>
            {(p) => <Input {...p} type="time" value={time.endTime} disabled={time.allDay} tabIndex={time.allDay ? -1 : undefined} onChange={(e) => { setTime({ ...time, endTime: e.target.value }); setErrors((x) => ({ ...x, time: undefined })); }} />}
          </Field>
        </div>
        {errors.time && (
          <p id="event-time-error" role="alert" className="text-meta text-danger">
            {errors.time}
          </p>
        )}
      </fieldset>
      <ConflictNotice conflicts={conflicts} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Calendar">
          {(p) => (
            <Select {...p} value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
              <option value="">None</option>
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Type">
          {(p) => (
            <Select {...p} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="">None</option>
              {eventTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Repeat">
            {(p) => (
              <Select {...p} value={repeat.repeat} onChange={(e) => setRepeat({ ...repeat, repeat: e.target.value as Repeat })}>
                {REPEATS.map((v) => (
                  <option key={v} value={v}>
                    {REPEAT_LABEL[v]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {repeat.repeat !== 'none' && (
            <Field label="Repeats until" hint="Blank means forever.">
              {(p) => <Input {...p} type="date" value={repeat.until} min={time.startDate} onChange={(e) => setRepeat({ ...repeat, until: e.target.value })} />}
            </Field>
          )}
        </div>
        {repeat.repeat === 'weekly' && (
          <div role="group" aria-label="Repeat on" className="flex gap-1">
            {WEEKDAY_INITIAL.map((initial, day) => {
              const on = repeat.weekdays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  aria-label={WEEKDAY_NAME[day]}
                  onClick={() => toggleWeekday(day)}
                  className={cx(
                    'grid size-9 place-items-center rounded-control border text-body transition-colors duration-150 ease-out',
                    on ? 'border-ink bg-ink text-paper' : 'border-rule text-ink hover:border-ink-muted',
                  )}
                >
                  {initial}
                </button>
              );
            })}
          </div>
        )}
        {repeats && <p className="text-meta text-ink-muted">This event repeats. When you save, you’ll choose which events to change.</p>}
      </div>

      <Field label="Location">{(p) => <Input {...p} value={location} maxLength={300} onChange={(e) => setLocation(e.target.value)} />}</Field>
      <Field label="Link" hint="Zoom, Teams, or Meet." error={errors.link}>
        {(p) => (
          <Input
            {...p}
            inputMode="url"
            value={link}
            maxLength={2000}
            onChange={(e) => {
              setLink(e.target.value);
              setErrors((x) => ({ ...x, link: undefined }));
            }}
          />
        )}
      </Field>
      <Field label="Notes">{(p) => <Textarea {...p} value={notes} maxLength={20000} onChange={(e) => setNotes(e.target.value)} />}</Field>
    </form>
  );
}
