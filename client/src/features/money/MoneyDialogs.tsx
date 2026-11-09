import { useState, type FormEvent, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { formatCents, HOLDING_TYPES, parseCents, type Allocation, type Expense, type Holding, type HoldingType, type SavingsGoal, type UnsettledPeriod } from '@todo/shared';
import type { useMoney } from '../../actions/useMoneyActions';
import { useApp } from '../../app/AppContext';
import { useAppSettings } from '../../data/useApplications';
import { centsToInput, HOLDING_LABEL, periodShort } from '../../lib/money';
import { Button, IconButton } from '../../ui/Button';
import { Field, Input, Select } from '../../ui/fields';
import { Dialog } from '../../ui/Panel';
import { ExpenseForm } from './ExpenseForm';
import { Money } from './Money';

type MoneyApi = ReturnType<typeof useMoney>;

/** Which dialog the Money page has open. */
export type MoneyDialog =
  | { kind: 'goal'; goal: SavingsGoal | null }
  | { kind: 'holding'; holding: Holding | null }
  | { kind: 'putIn'; toType: 'goal' | 'holding'; toId: string; name: string }
  | { kind: 'value'; holding: Holding }
  | { kind: 'move'; period: UnsettledPeriod }
  | { kind: 'expense'; expense: Expense }
  | { kind: 'categories' };

interface Props {
  dialog: MoneyDialog | null;
  onClose: () => void;
  money: MoneyApi;
}

/** A dialog with a Save button tied to its form, and an optional Delete on the left. */
function Shell({ title, formId, submit, onClose, onDelete, children }: { title: string; formId: string; submit: string; onClose: () => void; onDelete?: () => void; children: ReactNode }) {
  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          {onDelete && (
            <Button variant="ghost" className="mr-auto text-danger" onClick={() => { onDelete(); onClose(); }}>
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId}>
            {submit}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}

/** An amount field that checks itself on submit. */
function useAmount(initial: string, { allowZero = false }: { allowZero?: boolean } = {}) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | undefined>();
  return {
    text,
    error,
    setText: (v: string) => {
      setText(v);
      setError(undefined);
    },
    /** The cents, or null (and a message) if what's typed isn't an amount. */
    read: (optional = false) => {
      if (optional && text.trim() === '') return 0;
      const cents = parseCents(text, { allowZero });
      if (cents === null) setError('Type an amount like 250 or 12.50.');
      return cents;
    },
  };
}

function GoalForm({ goal, money, onClose }: { goal: SavingsGoal | null; money: MoneyApi; onClose: () => void }) {
  const [name, setName] = useState(goal?.name ?? '');
  const [nameError, setNameError] = useState<string | undefined>();
  const target = useAmount(goal ? centsToInput(goal.targetCents) : '');
  async function submit(e: FormEvent) {
    e.preventDefault();
    const cents = target.read();
    if (!name.trim()) setNameError('Give the goal a name.');
    if (!name.trim() || cents === null) return;
    if (await money.saveGoal({ name: name.trim(), targetCents: cents }, goal ?? undefined)) onClose();
  }
  return (
    <Shell title={goal ? 'Edit goal' : 'New savings goal'} formId="goal-form" submit={goal ? 'Save' : 'Add goal'} onClose={onClose} onDelete={goal ? () => void money.deleteGoal(goal) : undefined}>
      <form id="goal-form" onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        <Field label="Name" error={nameError}>{(p) => <Input {...p} data-autofocus value={name} maxLength={80} onChange={(e) => { setName(e.target.value); setNameError(undefined); }} />}</Field>
        <Field label="Target" error={target.error}>{(p) => <Input {...p} inputMode="decimal" placeholder="10000" className="font-mono" value={target.text} onChange={(e) => target.setText(e.target.value)} />}</Field>
      </form>
    </Shell>
  );
}

function HoldingForm({ holding, money, onClose }: { holding: Holding | null; money: MoneyApi; onClose: () => void }) {
  const { today } = useApp();
  const [name, setName] = useState(holding?.name ?? '');
  const [nameError, setNameError] = useState<string | undefined>();
  const [type, setType] = useState<HoldingType>(holding?.type ?? 'stock');
  const value = useAmount(holding ? centsToInput(holding.valueCents) : '', { allowZero: true });
  const monthly = useAmount(holding?.monthlyTargetCents ? centsToInput(holding.monthlyTargetCents) : '');
  async function submit(e: FormEvent) {
    e.preventDefault();
    const valueCents = value.read();
    const monthlyCents = monthly.read(true);
    if (!name.trim()) setNameError('Give it a name.');
    if (!name.trim() || valueCents === null || monthlyCents === null) return;
    const changed = !holding || holding.valueCents !== valueCents;
    const saved = await money.saveHolding({ name: name.trim(), type, valueCents, valueUpdatedOn: changed ? today : holding.valueUpdatedOn, monthlyTargetCents: monthlyCents || null }, holding ?? undefined);
    if (saved) onClose();
  }
  return (
    <Shell title={holding ? 'Edit holding' : 'New holding'} formId="holding-form" submit={holding ? 'Save' : 'Add holding'} onClose={onClose} onDelete={holding ? () => void money.deleteHolding(holding) : undefined}>
      <form id="holding-form" onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        <Field label="Name" error={nameError}>{(p) => <Input {...p} data-autofocus value={name} maxLength={80} onChange={(e) => { setName(e.target.value); setNameError(undefined); }} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            {(p) => (
              <Select {...p} value={type} onChange={(e) => setType(e.target.value as HoldingType)}>
                {HOLDING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {HOLDING_LABEL[t]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Worth now" error={value.error} hint="You update this by hand.">{(p) => <Input {...p} inputMode="decimal" placeholder="0.00" className="font-mono" value={value.text} onChange={(e) => value.setText(e.target.value)} />}</Field>
        </div>
        <Field label="Monthly target (optional)" error={monthly.error}>{(p) => <Input {...p} inputMode="decimal" placeholder="e.g. 50" className="font-mono" value={monthly.text} onChange={(e) => monthly.setText(e.target.value)} />}</Field>
      </form>
    </Shell>
  );
}

function PutInForm({ d, money, onClose }: { d: Extract<MoneyDialog, { kind: 'putIn' }>; money: MoneyApi; onClose: () => void }) {
  const { today } = useApp();
  const amount = useAmount('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    const cents = amount.read();
    if (cents === null || !date) return;
    if (await money.putIn({ toType: d.toType, toId: d.toId, amountCents: cents, date, note: note.trim() || null })) onClose();
  }
  return (
    <Shell title={`Add money to ${d.name}`} formId="putin-form" submit="Add" onClose={onClose}>
      <form id="putin-form" onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount" error={amount.error}>{(p) => <Input {...p} data-autofocus inputMode="decimal" placeholder="0.00" className="font-mono" value={amount.text} onChange={(e) => amount.setText(e.target.value)} />}</Field>
          <Field label="Date">{(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        </div>
        <Field label="Note (optional)">{(p) => <Input {...p} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />}</Field>
      </form>
    </Shell>
  );
}

function ValueForm({ holding, money, onClose }: { holding: Holding; money: MoneyApi; onClose: () => void }) {
  const { today } = useApp();
  const value = useAmount(centsToInput(holding.valueCents), { allowZero: true });
  async function submit(e: FormEvent) {
    e.preventDefault();
    const cents = value.read();
    if (cents === null) return;
    const { name, type, monthlyTargetCents } = holding;
    if (await money.saveHolding({ name, type, valueCents: cents, valueUpdatedOn: today, monthlyTargetCents }, holding)) onClose();
  }
  return (
    <Shell title={`What is ${holding.name} worth now?`} formId="value-form" submit="Update" onClose={onClose}>
      <form id="value-form" onSubmit={(e) => void submit(e)} noValidate className="space-y-3">
        <Field label="Worth now" error={value.error} hint="Check where you hold it and type what you see. Nothing is fetched for you.">{(p) => <Input {...p} data-autofocus inputMode="decimal" className="font-mono" value={value.text} onChange={(e) => value.setText(e.target.value)} />}</Field>
      </form>
    </Shell>
  );
}

function MoveForm({ period, money, onClose }: { period: UnsettledPeriod; money: MoneyApi; onClose: () => void }) {
  const { settings } = useAppSettings();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const targets = [...money.goals.map((g) => ({ id: g.id, type: 'goal' as const, name: g.name })), ...money.holdings.map((h) => ({ id: h.id, type: 'holding' as const, name: h.name }))];
  const parsed = targets.map((t) => ({ t, cents: amounts[t.id]?.trim() ? parseCents(amounts[t.id]!) : 0 }));
  const bad = parsed.some((p) => p.cents === null);
  const moved = parsed.reduce((n, p) => n + (p.cents ?? 0), 0);
  const kept = period.remainingCents - moved;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (bad) return setError('Each amount should look like 250 or 12.50.');
    const allocations: Allocation[] = parsed.filter((p) => p.cents).map((p) => ({ toType: p.t.type, toId: p.t.id, amountCents: p.cents! }));
    const problem = await money.moveLeftover(period, allocations);
    if (problem) setError(problem);
    else onClose();
  }
  return (
    <Shell title={`Put ${periodShort(period.period, settings.budget.period)}’s leftover to work`} formId="move-form" submit="Move it" onClose={onClose}>
      <form id="move-form" onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        <p className="text-body">
          <Money className="text-section">{formatCents(period.remainingCents)}</Money> was left of the budget. Split it between your goals and holdings; whatever you don’t allocate is kept as cash, and this stops showing.
        </p>
        {targets.length === 0 ? (
          <p className="text-meta text-ink-muted">You haven’t made a goal or a holding yet. You can keep it as cash now, or add one on the Savings tab first.</p>
        ) : (
          <ul className="space-y-2">
            {targets.map((t) => (
              <li key={t.id} className="grid grid-cols-[1fr_8rem] items-center gap-3">
                <span className="text-body">
                  {t.name} <span className="text-meta text-ink-muted">{t.type === 'goal' ? 'goal' : 'holding'}</span>
                </span>
                <Input aria-label={`Amount for ${t.name}`} inputMode="decimal" placeholder="0.00" className="font-mono" value={amounts[t.id] ?? ''} onChange={(e) => { setAmounts({ ...amounts, [t.id]: e.target.value }); setError(null); }} />
              </li>
            ))}
          </ul>
        )}
        <p className="text-meta text-ink-muted">
          Kept as cash: <Money className={kept < 0 ? 'text-danger' : 'text-ink'}>{formatCents(kept)}</Money>
        </p>
        {error && <p role="alert" className="text-meta text-danger">{error}</p>}
      </form>
    </Shell>
  );
}

function CategoriesForm({ money, onClose }: { money: MoneyApi; onClose: () => void }) {
  const [name, setName] = useState('');
  return (
    <Dialog open onClose={onClose} title="Expense categories" footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <ul className="space-y-2">
        {money.categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <Input aria-label={`Rename ${c.name}`} defaultValue={c.name} maxLength={60} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.name) void money.renameCategory(c, v).then((ok) => !ok && (e.target.value = c.name)); else e.target.value = c.name; }} />
            <IconButton icon={X} label={`Delete ${c.name}`} onClick={() => void money.deleteCategory(c)} />
          </li>
        ))}
      </ul>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) void money.addCategory(name.trim()).then((c) => c && setName('')); }}>
        <Input aria-label="New category" placeholder="New category" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <Button variant="secondary" icon={Plus} type="submit">
          Add
        </Button>
      </form>
      <p className="mt-3 text-meta text-ink-muted">Deleting one keeps its expenses; they just become uncategorized.</p>
    </Dialog>
  );
}

/** Every dialog on the Money page; only the one in `dialog` is mounted, so each starts fresh. */
export function MoneyDialogs({ dialog, onClose, money }: Props) {
  const { today } = useApp();
  if (!dialog) return null;
  switch (dialog.kind) {
    case 'goal':
      return <GoalForm goal={dialog.goal} money={money} onClose={onClose} />;
    case 'holding':
      return <HoldingForm holding={dialog.holding} money={money} onClose={onClose} />;
    case 'putIn':
      return <PutInForm d={dialog} money={money} onClose={onClose} />;
    case 'value':
      return <ValueForm holding={dialog.holding} money={money} onClose={onClose} />;
    case 'move':
      return <MoveForm key={dialog.period.period.start} period={dialog.period} money={money} onClose={onClose} />;
    case 'categories':
      return <CategoriesForm money={money} onClose={onClose} />;
    case 'expense': {
      const { expense } = dialog;
      return (
        <Dialog open onClose={onClose} title="Edit expense" footer={<Button variant="ghost" className="mr-auto text-danger" onClick={() => { void money.deleteExpense(expense); onClose(); }}>Delete</Button>}>
          <ExpenseForm
            categories={money.categories}
            today={today}
            initial={expense}
            submitLabel="Save"
            onSubmit={async (f) => {
              const saved = await money.saveExpense(expense, f);
              if (saved) onClose();
              return saved !== null;
            }}
          />
        </Dialog>
      );
    }
  }
}
