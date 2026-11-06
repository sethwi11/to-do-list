import { Clock, TriangleAlert } from 'lucide-react';
import type { Calendar, EventType } from '@todo/shared';
import { cx } from '../../lib/cx';
import { Checkbox } from '../../ui/Checkbox';
import { Field, Input, Select } from '../../ui/fields';
import { Segmented } from '../../ui/Segmented';
import { describeRepeat } from '../calendar/format';
import { withNewStart } from '../events/eventForm';
import type { Card, CardKind } from './cards';

const REMINDER_CHOICES = [
  { minutes: 3 * 24 * 60, label: '3 days before' },
  { minutes: 24 * 60, label: '1 day before' },
  { minutes: 60, label: '1 hour before' },
];

interface CandidateCardProps {
  card: Card;
  /** Why it can't be added yet, after an attempt. */
  problem?: string;
  calendars: Calendar[];
  eventTypes: EventType[];
  onChange: (patch: Partial<Card>) => void;
  /** Called when the card gets attention, so the source pane can show where it came from. */
  onFocus: () => void;
  focused: boolean;
}

function Badge({ icon: Icon, children }: { icon: typeof Clock; children: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-control border border-rule px-1.5 py-0.5 text-meta text-ink">
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

/** One thing found in a file, with every field editable, an Add checkbox, and the words it came from underneath. */
export function CandidateCard({ card, problem, calendars, eventTypes, onChange, onFocus, focused }: CandidateCardProps) {
  const { time } = card;
  const isTask = card.kind === 'task';
  const set = (patch: Partial<Card>) => onChange(patch);

  return (
    <li onFocusCapture={onFocus} onPointerDownCapture={onFocus} className={cx('border-b border-hairline py-4 pl-1 transition-colors duration-150 ease-out', focused && 'bg-surface')}>
      <div className="flex items-start gap-2">
        <Checkbox checked={card.include} onChange={(e) => set({ include: e.target.checked })} label={`Add “${card.title || 'this item'}”`} className="mt-0.5" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Input aria-label="Title" value={card.title} maxLength={200} aria-invalid={problem && !card.title.trim() ? true : undefined} onChange={(e) => set({ title: e.target.value })} className="min-w-0 flex-1 basis-52 font-medium" />
            <Segmented
              label="Add as"
              value={card.kind}
              onChange={(kind: CardKind) => set({ kind })}
              options={[
                { value: 'event', label: 'Event' },
                { value: 'task', label: 'To-do' },
              ]}
            />
          </div>

          {(card.lowConfidence || card.past || card.duplicateOf) && (
            <div className="flex flex-wrap gap-1.5">
              {card.lowConfidence && <Badge icon={TriangleAlert}>Not sure about this one</Badge>}
              {card.past && <Badge icon={Clock}>Already past</Badge>}
              {card.duplicateOf && <Badge icon={TriangleAlert}>{card.duplicateOf.includes('in this import') ? `Same as “${card.duplicateOf}` : `Looks like “${card.duplicateOf}”, already on your calendar`}</Badge>}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <Field label={isTask ? 'Due' : 'Date'} className="w-40">
              {(p) => <Input {...p} type="date" value={time.startDate} onChange={(e) => set({ time: withNewStart(time, e.target.value, time.startTime) })} />}
            </Field>
            {isTask ? (
              <Field label="Time (optional)" className="w-36">
                {(p) => <Input {...p} type="time" value={time.allDay ? '' : time.startTime} onChange={(e) => set({ time: e.target.value ? { ...time, allDay: false, startTime: e.target.value } : { ...time, allDay: true } })} />}
              </Field>
            ) : (
              <>
                {!time.allDay && (
                  <>
                    <Field label="From" className="w-36">
                      {(p) => <Input {...p} type="time" value={time.startTime} onChange={(e) => set({ time: withNewStart(time, time.startDate, e.target.value) })} />}
                    </Field>
                    <Field label="To" className="w-36">
                      {(p) => <Input {...p} type="time" value={time.endTime} onChange={(e) => set({ time: { ...time, endTime: e.target.value } })} />}
                    </Field>
                  </>
                )}
                {time.endDate !== time.startDate && (
                  <Field label={time.allDay ? 'Last day' : 'Ends on'} className="w-40">
                    {(p) => <Input {...p} type="date" value={time.endDate} onChange={(e) => set({ time: { ...time, endDate: e.target.value } })} />}
                  </Field>
                )}
                <label className="flex h-9 cursor-pointer items-center gap-1 text-body">
                  <Checkbox checked={time.allDay} onChange={(e) => set({ time: { ...time, allDay: e.target.checked } })} label="All day" />
                  All day
                </label>
              </>
            )}
          </div>

          {card.recurrence && !isTask && <p className="text-meta text-ink-muted">Repeats: {describeRepeat(card.recurrence)}{card.recurrence.exdates.length > 0 ? ` (skipping ${card.recurrence.exdates.length} ${card.recurrence.exdates.length === 1 ? 'date' : 'dates'})` : ''}</p>}

          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Calendar">
              {(p) => (
                <Select {...p} value={card.calendarId} onChange={(e) => set({ calendarId: e.target.value })}>
                  <option value="">None</option>
                  {calendars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {!isTask && (
              <Field label="Type">
                {(p) => (
                  <Select {...p} value={card.typeId} onChange={(e) => set({ typeId: e.target.value })}>
                    <option value="">None</option>
                    {eventTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            <Field label="Location">{(p) => <Input {...p} value={card.location} maxLength={300} onChange={(e) => set({ location: e.target.value })} />}</Field>
            <Field label="Link">{(p) => <Input {...p} inputMode="url" value={card.link} maxLength={2000} onChange={(e) => set({ link: e.target.value })} />}</Field>
          </div>

          {isTask && (
            <fieldset>
              <legend className="mb-1 text-label text-ink-muted uppercase">Remind me</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {REMINDER_CHOICES.map(({ minutes, label }) => (
                  <label key={minutes} className="flex cursor-pointer items-center gap-1 text-body">
                    <Checkbox
                      size="sm"
                      checked={card.reminders.includes(minutes)}
                      onChange={(e) => set({ reminders: e.target.checked ? [...card.reminders, minutes].sort((a, b) => b - a) : card.reminders.filter((m) => m !== minutes) })}
                      label={label}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {problem && (
            <p role="alert" className="text-meta text-danger">
              {problem}
            </p>
          )}
          {card.snippet && (
            <p className="line-clamp-2 text-meta text-ink-muted">
              <span className="text-label uppercase">From the file{card.page ? `, page ${card.page}` : ''}: </span>
              {card.snippet}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
