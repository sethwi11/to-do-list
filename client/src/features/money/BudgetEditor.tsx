import { useEffect, useState } from 'react';
import { formatCents, parseCents, type BudgetSettings } from '@todo/shared';
import { useApp } from '../../app/AppContext';
import { useAppSettings } from '../../data/useApplications';
import { centsToInput } from '../../lib/money';
import { Input } from '../../ui/fields';
import { Segmented } from '../../ui/Segmented';

/** The spending budget: an amount and a period (month or week), saved as you change it. */
export function BudgetEditor() {
  const { showToast } = useApp();
  const { settings, update } = useAppSettings();
  const b = settings.budget;
  const [amount, setAmount] = useState(b.amountCents ? centsToInput(b.amountCents) : '');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setAmount(b.amountCents ? centsToInput(b.amountCents) : ''), [b.amountCents]);

  async function save(changes: Partial<BudgetSettings>) {
    const previous = b;
    try {
      await update({ budget: changes });
      setError(null);
      showToast(changes.amountCents !== undefined ? `Budget is ${changes.amountCents ? formatCents(changes.amountCents) : 'not set'}` : `Budget is per ${changes.period}`, () => void update({ budget: previous }));
    } catch {
      setError('Couldn’t save the budget. Check that the server is running.');
    }
  }
  function commit() {
    const text = amount.trim();
    const cents = text === '' ? 0 : parseCents(text);
    if (cents === null) return setError('Type an amount like 1000 or 850.50.');
    if (cents !== b.amountCents) void save({ amountCents: cents });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="mb-1 block text-label text-ink-muted uppercase">Budget</span>
        <span className="flex items-center gap-1.5">
          <span className="font-mono text-body">$</span>
          <Input inputMode="decimal" value={amount} placeholder="0.00" className="w-28! font-mono" aria-invalid={error ? true : undefined} onChange={(e) => setAmount(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />
        </span>
      </label>
      <Segmented
        label="Budget period"
        value={b.period}
        onChange={(period) => void save({ period })}
        options={[
          { value: 'month', label: 'Per month' },
          { value: 'week', label: 'Per week' },
        ]}
      />
      {error && (
        <p role="alert" className="w-full text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
