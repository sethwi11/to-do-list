import { useEffect, useRef, useState, type FormEvent } from 'react';
import { parseCents, type Expense, type ExpenseCategory, type ExpenseKind } from '@todo/shared';
import type { ExpenseFields } from '../../actions/useMoneyActions';
import { centsToInput } from '../../lib/money';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Input, Select } from '../../ui/fields';
import { Segmented } from '../../ui/Segmented';

interface Props {
  categories: readonly ExpenseCategory[];
  today: string;
  /** Editing this expense; without it, a quick-add row that clears itself after each add. */
  initial?: Expense;
  submitLabel: string;
  /** Resolves true when it was saved. */
  onSubmit: (fields: ExpenseFields) => Promise<boolean>;
  /** Earlier expenses by what they were (lowercase): typing one of those again fills in its category and need or want. */
  known?: ReadonlyMap<string, { categoryId: string | null; kind: ExpenseKind }>;
  autoFocus?: boolean;
}

/** One expense: amount, what, category, need or want, date, and whether it repeats monthly. "What" is optional (it becomes the category's name), so a typical entry is an amount and Enter. */
export function ExpenseForm({ categories, today, initial, submitLabel, onSubmit, known, autoFocus = false }: Props) {
  const amountRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState(initial ? centsToInput(initial.amountCents) : '');
  const [what, setWhat] = useState(initial?.what ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [kind, setKind] = useState<ExpenseKind>(initial?.kind ?? 'need');
  const [date, setDate] = useState(initial?.date ?? today);
  const [recurring, setRecurring] = useState(initial?.recurring ?? false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (autoFocus) amountRef.current?.focus();
  }, [autoFocus]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const cents = parseCents(amount);
    if (cents === null) return setError('Type an amount like 12.50.');
    if (!date) return setError('Pick a date.');
    const category = categories.find((c) => c.id === categoryId);
    const typed = { amount, what, recurring };
    if (!initial) {
      // Ready for the next one at once, without waiting for the server: the category, need or want and date stay, since the next expense is usually alike.
      setAmount('');
      setWhat('');
      setRecurring(false);
      setError(null);
      amountRef.current?.focus();
    }
    const saved = await onSubmit({ amountCents: cents, what: what.trim() || category?.name || 'Expense', categoryId: categoryId || null, date, kind, recurring });
    // If it didn't save, bring it back (unless the next one is already being typed).
    if (!saved && !initial) {
      setAmount((a) => a || typed.amount);
      setWhat((w) => w || typed.what);
      setRecurring((r) => r || typed.recurring);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate aria-label={initial ? 'Edit expense' : 'Add an expense'} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[7rem_minmax(0,1fr)_11rem]">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="font-mono text-body">$</span>
          <Input ref={amountRef} aria-label="Amount" inputMode="decimal" placeholder="0.00" value={amount} aria-invalid={error ? true : undefined} className="font-mono" onChange={(e) => { setAmount(e.target.value); setError(null); }} />
        </span>
        <Input
          aria-label="What it was"
          placeholder={categories.find((c) => c.id === categoryId)?.name ?? 'What was it? (optional)'}
          value={what}
          maxLength={200}
          onChange={(e) => {
            setWhat(e.target.value);
            const match = initial ? undefined : known?.get(e.target.value.trim().toLowerCase());
            if (match) {
              setCategoryId(match.categoryId ?? '');
              setKind(match.kind);
            }
          }}
        />
        <Select aria-label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Segmented
          label="Need or want"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'need', label: 'Need' },
            { value: 'want', label: 'Want' },
          ]}
        />
        <Input aria-label="Date" type="date" value={date} className="w-40!" onChange={(e) => setDate(e.target.value)} />
        <label className="flex cursor-pointer items-center gap-1 text-body">
          <Checkbox checked={recurring} onChange={(e) => setRecurring(e.target.checked)} label="Repeats every month" />
          Repeats monthly
        </label>
        <Button variant="primary" type="submit" className="ml-auto max-sm:w-full">
          {submitLabel}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
