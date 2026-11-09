import { useState, type FormEvent } from 'react';
import { ROUTINE_PRIORITIES, type RoutineBlock, type RoutinePriority } from '@todo/shared';
import type { BlockFields } from '../../actions/useRoutineActions';
import { useApp } from '../../app/AppContext';
import { WEEKDAY_NAME } from '../../lib/dates';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Field, Input, Label, Select, Textarea } from '../../ui/fields';
import { Dialog } from '../../ui/Panel';
import { WeekdayPicker } from '../../ui/WeekdayPicker';

export const PRIORITY_LABEL: Record<RoutinePriority, string> = {
  commitment: 'Commitment: never replaced automatically',
  high: 'High: only classes and events replace it',
  normal: 'Normal: gives way to events',
  free: 'Free time',
};
const SOUNDTRACKS = ['lofi', 'news', 'house'];

export type BlockDialogState = { mode: 'new'; defaults: Pick<BlockFields, 'templateId' | 'weekday' | 'start' | 'end'> } | { mode: 'edit'; block: RoutineBlock };

interface Props {
  state: BlockDialogState | null;
  onClose: () => void;
  onSave: (fields: BlockFields, copyTo: number[], existing?: RoutineBlock) => Promise<boolean>;
  onDelete: (block: RoutineBlock) => void;
  onDuplicate: (block: RoutineBlock) => void;
}

/** Add or edit one routine block, and optionally copy it to other days. */
export function BlockDialog({ state, onClose, onSave, onDelete, onDuplicate }: Props) {
  const editing = state?.mode === 'edit' ? state.block : null;
  return (
    <Dialog
      open={state !== null}
      onClose={onClose}
      title={editing ? 'Edit block' : 'New block'}
      footer={
        <>
          {editing && (
            <>
              <Button variant="ghost" className="mr-auto text-danger" onClick={() => { onDelete(editing); onClose(); }}>
                Delete
              </Button>
              <Button variant="ghost" onClick={() => { onDuplicate(editing); onClose(); }}>
                Duplicate
              </Button>
            </>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="block-form">
            {editing ? 'Save' : 'Add block'}
          </Button>
        </>
      }
    >
      {state && <BlockForm key={editing?.id ?? 'new'} start={state.mode === 'edit' ? state.block : state.defaults} existing={editing} onSaved={onClose} onSave={onSave} />}
    </Dialog>
  );
}

function BlockForm({ start, existing, onSave, onSaved }: { start: Partial<RoutineBlock>; existing: RoutineBlock | null; onSave: Props['onSave']; onSaved: () => void }) {
  const { calendars } = useApp();
  const [f, setF] = useState({
    title: start.title ?? '',
    calendarId: start.calendarId ?? '',
    weekday: start.weekday ?? 1,
    start: start.start ?? '09:00',
    end: start.end ?? '10:00',
    priority: start.priority ?? ('normal' as RoutinePriority),
    altTitle: start.altTitle ?? '',
    altCalendarId: start.altCalendarId ?? '',
    focus: start.focus ?? false,
    soundtrack: start.soundtrack ?? '',
    notify: start.notify ?? true,
    schoolDaysOnly: start.schoolDaysOnly ?? false,
    reschedulable: start.reschedulable ?? true,
    notes: start.notes ?? '',
  });
  const [copyTo, setCopyTo] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) => setF((x) => ({ ...x, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) return setError('Give the block a title.');
    if (f.start === f.end) return setError('The block must end at a different time than it starts.');
    const fields: BlockFields = {
      templateId: start.templateId!,
      weekday: f.weekday,
      start: f.start,
      end: f.end,
      title: f.title.trim(),
      calendarId: f.calendarId || null,
      altTitle: f.altTitle.trim() || null,
      altCalendarId: f.altTitle.trim() && f.altCalendarId ? f.altCalendarId : null,
      priority: f.priority,
      focus: f.focus,
      soundtrack: f.soundtrack || null,
      notify: f.notify,
      schoolDaysOnly: f.schoolDaysOnly,
      reschedulable: f.reschedulable && f.priority !== 'free',
      notes: f.notes.trim() || null,
    };
    if (await onSave(fields, copyTo.filter((d) => d !== f.weekday), existing ?? undefined)) onSaved();
  }

  const calendarOptions = calendars.map((c) => (
    <option key={c.id} value={c.id}>
      {c.name}
    </option>
  ));
  const toggle = (key: 'focus' | 'notify' | 'schoolDaysOnly' | 'reschedulable', label: string, hint: string) => (
    <label className="flex cursor-pointer items-center gap-2">
      <Checkbox checked={f[key]} onChange={(e) => set(key, e.target.checked)} label={label} />
      <span>
        <span className="block text-body">{label}</span>
        <span className="block text-meta text-ink-muted">{hint}</span>
      </span>
    </label>
  );

  return (
    <form id="block-form" onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
      <Field label="Title" error={error ?? undefined}>
        {(p) => <Input {...p} data-autofocus value={f.title} maxLength={100} onChange={(e) => { set('title', e.target.value); setError(null); }} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          {(p) => (
            <Select {...p} value={f.calendarId} onChange={(e) => set('calendarId', e.target.value)}>
              <option value="">None</option>
              {calendarOptions}
            </Select>
          )}
        </Field>
        <Field label="Day">
          {(p) => (
            <Select {...p} value={f.weekday} onChange={(e) => set('weekday', Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <option key={d} value={d}>
                  {WEEKDAY_NAME[d]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts">{(p) => <Input {...p} type="time" value={f.start} onChange={(e) => set('start', e.target.value)} />}</Field>
        <Field label="Ends" hint={f.end <= f.start && f.end !== f.start ? 'Ends after midnight' : undefined}>
          {(p) => <Input {...p} type="time" value={f.end} onChange={(e) => set('end', e.target.value)} />}
        </Field>
      </div>
      <Field label="Priority">
        {(p) => (
          <Select {...p} value={f.priority} onChange={(e) => set('priority', e.target.value as RoutinePriority)}>
            {ROUTINE_PRIORITIES.map((pr) => (
              <option key={pr} value={pr}>
                {PRIORITY_LABEL[pr]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Or instead (optional)">{(p) => <Input {...p} value={f.altTitle} maxLength={100} placeholder="e.g. Homework" onChange={(e) => set('altTitle', e.target.value)} />}</Field>
        <Field label="Its category">
          {(p) => (
            <Select {...p} value={f.altCalendarId} disabled={!f.altTitle.trim()} onChange={(e) => set('altCalendarId', e.target.value)}>
              <option value="">None</option>
              {calendarOptions}
            </Select>
          )}
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {toggle('focus', 'Focus block', 'Pomodoro available')}
        {toggle('schoolDaysOnly', 'School days only', 'Hidden outside the semester and on breaks')}
        {f.priority !== 'free' && toggle('reschedulable', 'Can be rescheduled', 'If something takes its time, it shows in Missed this week')}
        {toggle('notify', 'Pop-ups', 'Start and stop notifications for this block')}
        <Field label="Soundtrack">
          {(p) => (
            <Select {...p} value={f.soundtrack} onChange={(e) => set('soundtrack', e.target.value)}>
              <option value="">None</option>
              {[...new Set([...SOUNDTRACKS, ...(f.soundtrack ? [f.soundtrack] : [])])].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Notes">{(p) => <Textarea {...p} value={f.notes} maxLength={2000} className="min-h-16" onChange={(e) => set('notes', e.target.value)} />}</Field>
      <div>
        <Label>Also add a copy on</Label>
        <WeekdayPicker value={copyTo} onChange={setCopyTo} mondayFirst disabled={[f.weekday]} />
      </div>
    </form>
  );
}
