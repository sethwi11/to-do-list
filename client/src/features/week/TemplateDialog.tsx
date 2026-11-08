import { useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { DEFAULT_BED, DEFAULT_WAKE, type WeekTemplate } from '@todo/shared';
import type { TemplateFields } from '../../actions/useRoutineActions';
import { WEEKDAY_NAME } from '../../lib/dates';
import { Button, IconButton } from '../../ui/Button';
import { Field, Input, Label, Select } from '../../ui/fields';
import { Dialog } from '../../ui/Panel';

export type TemplateDialogState = { mode: 'new' } | { mode: 'edit' | 'duplicate'; template: WeekTemplate };

const DAYS = [1, 2, 3, 4, 5, 6, 0];
const TITLE = { new: 'New week template', edit: 'Week template', duplicate: 'Duplicate template' };

interface Props {
  state: TemplateDialogState | null;
  onClose: () => void;
  onSave: (fields: TemplateFields) => Promise<boolean>;
  onDelete: (template: WeekTemplate) => void;
}

/** A template's name and dates, and (when editing) each day's wake and bed times and the meeting windows. Duplicating asks only for the new name and dates. */
export function TemplateDialog({ state, onClose, onSave, onDelete }: Props) {
  const template = state && state.mode !== 'new' ? state.template : null;
  return (
    <Dialog
      open={state !== null}
      onClose={onClose}
      title={state ? TITLE[state.mode] : ''}
      footer={
        <>
          {state?.mode === 'edit' && (
            <Button variant="ghost" className="mr-auto text-danger" onClick={() => { onDelete(state.template); onClose(); }}>
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="template-form">
            {state?.mode === 'duplicate' ? 'Duplicate' : 'Save'}
          </Button>
        </>
      }
    >
      {state && <TemplateForm key={`${state.mode}${template?.id ?? ''}`} template={template} full={state.mode === 'edit'} duplicate={state.mode === 'duplicate'} onSave={onSave} onSaved={onClose} />}
    </Dialog>
  );
}

function TemplateForm({ template, full, duplicate, onSave, onSaved }: { template: WeekTemplate | null; full: boolean; duplicate: boolean; onSave: Props['onSave']; onSaved: () => void }) {
  const [name, setName] = useState(template ? (duplicate ? `${template.name} (copy)` : template.name) : '');
  const [from, setFrom] = useState(template && !duplicate ? template.effectiveFrom : '');
  const [to, setTo] = useState(template && !duplicate ? (template.effectiveTo ?? '') : '');
  const [days, setDays] = useState(() => DAYS.map((weekday) => template?.days.find((d) => d.weekday === weekday) ?? { weekday, wake: DEFAULT_WAKE, bed: DEFAULT_BED }));
  const [windows, setWindows] = useState(template?.meetingWindows ?? []);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Give the template a name.');
    if (!from) return setError('Choose the first day it applies.');
    if (to && to < from) return setError('The end date must be on or after the start date.');
    if (windows.some((w) => w.end <= w.start)) return setError('Each meeting window must end after it starts.');
    if (await onSave({ name: name.trim(), effectiveFrom: from, effectiveTo: to || null, days, meetingWindows: windows })) onSaved();
  }

  const setDay = (weekday: number, key: 'wake' | 'bed', value: string) => setDays((ds) => ds.map((d) => (d.weekday === weekday ? { ...d, [key]: value } : d)));

  return (
    <form id="template-form" onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
      <Field label="Name" error={error ?? undefined}>
        {(p) => <Input {...p} data-autofocus value={name} maxLength={60} onChange={(e) => { setName(e.target.value); setError(null); }} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From">{(p) => <Input {...p} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
        <Field label="Until" hint="Leave empty for no end">{(p) => <Input {...p} type="date" value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
      </div>
      {duplicate && <p className="text-meta text-ink-muted">Copies every day and block. Edit the copy for the new semester.</p>}

      {full && (
        <>
          <fieldset>
            <legend className="mb-1.5 text-label text-ink-muted uppercase">Wake and bed</legend>
            <div className="grid grid-cols-[6.5rem_1fr_1fr] items-center gap-x-3 gap-y-2">
              {days.map((d) => (
                <div key={d.weekday} className="contents">
                  <span className="text-body">{WEEKDAY_NAME[d.weekday]}</span>
                  <Input type="time" aria-label={`${WEEKDAY_NAME[d.weekday]} wake`} value={d.wake} onChange={(e) => setDay(d.weekday, 'wake', e.target.value)} />
                  <Input type="time" aria-label={`${WEEKDAY_NAME[d.weekday]} bed`} value={d.bed} onChange={(e) => setDay(d.weekday, 'bed', e.target.value)} />
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-meta text-ink-muted">A bedtime earlier than wake time means after midnight.</p>
          </fieldset>

          <div>
            <Label>Meeting windows</Label>
            <p className="mb-2 text-meta text-ink-muted">When you’d rather meet people or schedule interviews.</p>
            <ul className="space-y-2">
              {windows.map((w, i) => {
                const change = (patch: Partial<typeof w>) => setWindows((ws) => ws.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <li key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                    <Select aria-label="Day" value={w.weekday} onChange={(e) => change({ weekday: Number(e.target.value) })}>
                      {DAYS.map((d) => (
                        <option key={d} value={d}>
                          {WEEKDAY_NAME[d]}
                        </option>
                      ))}
                    </Select>
                    <Input type="time" aria-label="From" value={w.start} onChange={(e) => change({ start: e.target.value })} />
                    <Input type="time" aria-label="Until" value={w.end} onChange={(e) => change({ end: e.target.value })} />
                    <IconButton icon={X} label="Remove this window" onClick={() => setWindows((ws) => ws.filter((_, j) => j !== i))} />
                  </li>
                );
              })}
            </ul>
            <Button variant="ghost" icon={Plus} className="mt-2" onClick={() => setWindows((ws) => [...ws, { weekday: 4, start: '15:00', end: '18:00' }])}>
              Add a window
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
