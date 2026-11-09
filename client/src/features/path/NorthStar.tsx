import { useState, type FormEvent } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import { countdown, daysBetween, northStarDates, type NorthStar as Line, type PathSettings } from '@todo/shared';
import { useApp } from '../../app/AppContext';
import { useAppSettings } from '../../data/useApplications';
import { longDate } from '../../lib/dates';
import { Button, IconButton } from '../../ui/Button';
import { Field, Input, SectionLabel } from '../../ui/fields';
import { Shell as FormDialog } from '../money/MoneyDialogs';

/** Your birthday and the lines of the north star in your own words; "by 30" becomes a date. */
function NorthStarDialog({ path, onClose }: { path: PathSettings; onClose: () => void }) {
  const { showToast } = useApp();
  const { update } = useAppSettings();
  const [birthday, setBirthday] = useState(path.birthday ?? '');
  const [lines, setLines] = useState<{ text: string; age: string }[]>(path.northStar.map((n) => ({ text: n.text, age: String(n.age) })));
  const [error, setError] = useState<string | undefined>();
  const edit = (i: number, change: Partial<(typeof lines)[number]>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...change } : l)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const northStar: Line[] = lines.filter((l) => l.text.trim() || l.age.trim()).map((l) => ({ text: l.text.trim(), age: Number(l.age) }));
    if (northStar.some((n) => !n.text || !Number.isInteger(n.age) || n.age < 1 || n.age > 120)) return setError('Each line needs some words and an age, like “My goal” and 30.');
    try {
      await update({ path: { birthday: birthday || null, northStar } });
      onClose();
    } catch {
      showToast('Couldn’t save that. Check that the server is running.');
    }
  }

  return (
    <FormDialog title="North star" formId="north-star-form" submit="Save" onClose={onClose}>
      <form id="north-star-form" onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        <Field label="Birthday" hint="Every date on this page is worked out from it.">{(p) => <Input {...p} data-autofocus type="date" className="w-44!" value={birthday} onChange={(e) => setBirthday(e.target.value)} />}</Field>
        <div className="space-y-2">
          <span className="block text-label text-ink-muted uppercase">In your own words, and by what age</span>
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input aria-label={`North star line ${i + 1}`} placeholder="My goal" maxLength={80} value={l.text} onChange={(e) => { edit(i, { text: e.target.value }); setError(undefined); }} />
              <Input aria-label={`Age for line ${i + 1}`} inputMode="numeric" placeholder="30" className="w-16! font-mono" value={l.age} onChange={(e) => { edit(i, { age: e.target.value }); setError(undefined); }} />
              <IconButton icon={X} label={`Remove line ${i + 1}`} onClick={() => setLines(lines.filter((_, j) => j !== i))} />
            </div>
          ))}
          {lines.length < 6 && (
            <Button variant="ghost" icon={Plus} onClick={() => setLines([...lines, { text: '', age: '' }])}>
              Add a line
            </Button>
          )}
          {error && <p role="alert" className="text-meta text-danger">{error}</p>}
        </div>
      </form>
    </FormDialog>
  );
}

/** The top of the Path: where this is going, with each date worked out from your birthday. */
export function NorthStar({ path, today }: { path: PathSettings; today: string }) {
  const [open, setOpen] = useState(false);
  const lines = northStarDates(path);
  return (
    <section aria-label="North star">
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionLabel className="flex-1">North star</SectionLabel>
        <Button variant="secondary" icon={Pencil} onClick={() => setOpen(true)}>
          Edit
        </Button>
      </div>
      {path.birthday === null || lines.length === 0 ? (
        <p className="text-body text-ink-muted">{path.birthday === null ? 'Add your birthday and what you’re aiming for, and the dates are worked out for you.' : 'Add what you’re aiming for, and by what age.'}</p>
      ) : (
        <ul className="space-y-1">
          {lines.map((n) => (
            <li key={`${n.text}-${n.age}`} className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-display text-section">
                {n.text} by {n.age}
              </span>
              {n.date && (
                <span className="text-meta text-ink-muted">
                  <span className="font-mono">{longDate(n.date)}</span> · {countdown(daysBetween(today, n.date))} to go
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {open && <NorthStarDialog path={path} onClose={() => setOpen(false)} />}
    </section>
  );
}
