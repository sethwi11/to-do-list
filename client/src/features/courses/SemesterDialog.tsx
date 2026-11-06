import { useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import type { ExcludedRange, Semester } from '@todo/shared';
import { useNavigate } from 'react-router';
import { useApp } from '../../app/AppContext';
import { Button, IconButton } from '../../ui/Button';
import { Field, Input } from '../../ui/fields';
import { Dialog } from '../../ui/Panel';
import { suggestSemester, thanksgivingBreak } from './courseModel';

/** Create a semester, or change its dates and breaks, or delete it. */
export function SemesterDialog() {
  const { dialog, closeDialog, semesters, courses, deleteSemester } = useApp();
  const open = dialog?.kind === 'semester';
  const editing = open && dialog.id !== 'new' ? (semesters.find((s) => s.id === dialog.id) ?? null) : null;
  const [confirming, setConfirming] = useState(false);
  const courseCount = editing ? courses.filter((c) => c.semesterId === editing.id).length : 0;

  return (
    <Dialog
      open={open}
      onClose={() => {
        setConfirming(false);
        closeDialog('semester');
      }}
      title={editing ? 'Edit semester' : 'New semester'}
      footer={
        confirming && editing ? (
          <>
            <p className="mr-auto max-w-72 self-center text-meta text-ink-muted">
              This deletes {courseCount === 0 ? 'the semester' : `the semester, its ${courseCount} ${courseCount === 1 ? 'course' : 'courses'}, their class meetings and their syllabus files`}. It can’t be undone. To just hide it, archive it instead.
            </p>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                void deleteSemester(editing).then((done) => {
                  if (done) {
                    setConfirming(false);
                    closeDialog('semester');
                  }
                });
              }}
            >
              Delete semester
            </Button>
          </>
        ) : (
          <>
            {editing && (
              <Button variant="ghost" className="mr-auto text-danger" onClick={() => setConfirming(true)}>
                Delete
              </Button>
            )}
            <Button variant="ghost" onClick={() => closeDialog('semester')}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="semester-form">
              {editing ? 'Save' : 'Add semester'}
            </Button>
          </>
        )
      }
    >
      {open && <SemesterForm semester={editing} />}
    </Dialog>
  );
}

const blankBreak = (): ExcludedRange => ({ start: '', end: '', label: null });

function SemesterForm({ semester }: { semester: Semester | null }) {
  const { today, saveSemester, closeDialog } = useApp();
  const navigate = useNavigate();
  const suggestion = suggestSemester(today);

  const [name, setName] = useState(semester?.name ?? suggestion.name);
  const [startDate, setStartDate] = useState(semester?.startDate ?? suggestion.startDate);
  const [endDate, setEndDate] = useState(semester?.endDate ?? suggestion.endDate);
  const [breaks, setBreaks] = useState<ExcludedRange[]>(semester?.excludedRanges ?? []);
  const [error, setError] = useState<string | undefined>();

  const year = Number((endDate || startDate || today).slice(0, 4));
  const thanksgiving = thanksgivingBreak(year);
  const hasThanksgiving = breaks.some((b) => b.label === 'Thanksgiving');
  const setBreak = (i: number, patch: Partial<ExcludedRange>) => setBreaks((all) => all.map((b, n) => (n === i ? { ...b, ...patch } : b)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Give the semester a name.');
    if (!startDate || !endDate) return setError('Choose when it starts and ends.');
    if (endDate < startDate) return setError('The semester can’t end before it starts.');
    const cleaned = breaks.filter((b) => b.start || b.end).map((b) => ({ start: b.start, end: b.end || b.start, label: b.label?.trim() || null }));
    const bad = cleaned.find((b) => !b.start || b.end < b.start);
    if (bad) return setError('Each break needs a first day, and its last day can’t be before its first.');
    const saved = await saveSemester({ name: name.trim(), startDate, endDate, excludedRanges: cleaned, archived: semester?.archived ?? false }, semester ?? undefined);
    if (saved) {
      closeDialog('semester');
      navigate(`/courses?semester=${saved.id}`);
    }
  }

  return (
    <form id="semester-form" onSubmit={submit} className="space-y-5">
      <Field label="Name">
        {(p) => (
          <Input
            {...p}
            value={name}
            maxLength={60}
            data-autofocus
            onChange={(e) => {
              setName(e.target.value);
              setError(undefined);
            }}
          />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="First day of classes">{(p) => <Input {...p} type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setError(undefined); }} />}</Field>
        <Field label="Last day of classes">{(p) => <Input {...p} type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setError(undefined); }} />}</Field>
      </div>

      {/* min-w-0: a fieldset won't shrink below its widest child by default, which pushed the date fields past the dialog on a phone. */}
      <fieldset className="min-w-0">
        <legend className="mb-1 text-label text-ink-muted uppercase">Breaks</legend>
        <p className="mb-2 text-meta text-ink-muted">Days with no classes (fall break, Thanksgiving). Class meetings are skipped on them.</p>
        <ul className="space-y-2">
          {breaks.map((b, i) => (
            <li key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <Field label="What" className="col-span-3 sm:col-span-1">
                {(p) => <Input {...p} value={b.label ?? ''} maxLength={60} placeholder="Fall break" onChange={(e) => setBreak(i, { label: e.target.value })} />}
              </Field>
              <Field label="From">{(p) => <Input {...p} type="date" value={b.start} onChange={(e) => setBreak(i, { start: e.target.value, end: b.end && b.end >= e.target.value ? b.end : e.target.value })} />}</Field>
              <Field label="To">{(p) => <Input {...p} type="date" value={b.end} min={b.start} onChange={(e) => setBreak(i, { end: e.target.value })} />}</Field>
              <IconButton icon={X} label={`Remove break ${b.label || i + 1}`} className="mb-0.5" onClick={() => setBreaks((all) => all.filter((_, n) => n !== i))} />
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" icon={Plus} onClick={() => setBreaks((all) => [...all, blankBreak()])}>
            Add a break
          </Button>
          {!hasThanksgiving && thanksgiving.start >= startDate && thanksgiving.end <= endDate && (
            <Button variant="ghost" onClick={() => setBreaks((all) => [...all, thanksgiving])}>
              Add Thanksgiving ({thanksgiving.start.slice(5).replace('-', '/')}–{thanksgiving.end.slice(5).replace('-', '/')})
            </Button>
          )}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
      {semester && <p className="text-meta text-ink-muted">If you change the dates or breaks, every course’s classes are rebuilt to match. Classes you cancelled or moved stay that way.</p>}
    </form>
  );
}
