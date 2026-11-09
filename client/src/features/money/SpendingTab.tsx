import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';
import { addDays, biggestWants, budgetSummary, formatCents, periodOf, previousPeriod, recurringCosts, unsettledPeriods, type BudgetSettings, type Expense, type UnsettledPeriod } from '@todo/shared';
import type { useMoney } from '../../actions/useMoneyActions';
import { plainDate } from '../../lib/dates';
import { periodShort, periodTitle } from '../../lib/money';
import { Button, IconButton } from '../../ui/Button';
import { SectionLabel } from '../../ui/fields';
import { BudgetEditor } from './BudgetEditor';
import { ExpenseForm } from './ExpenseForm';
import { Bar, Money } from './Money';
import type { MoneyDialog } from './MoneyDialogs';

interface Props {
  money: ReturnType<typeof useMoney>;
  budget: BudgetSettings;
  today: string;
  /** Focus the amount field (the New menu's "Expense" lands here). */
  focusAdd: boolean;
  open: (dialog: MoneyDialog) => void;
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-1.5 text-body last:border-b-0">
    <span>{label}</span>
    {children}
  </div>
);

/** Spending: what's left, the pace, a quick way to add an expense, the leftover to put to work, and where it all went. */
export function SpendingTab({ money, budget, today, focusAdd, open }: Props) {
  const { expenses, moves, categories, categoriesById } = money;
  const [viewDate, setViewDate] = useState(today);
  const p = periodOf(viewDate, budget.period);
  const current = today >= p.start && today < p.end;
  // A finished period is read as of its last day, so its pace is just its total.
  const asOf = current ? today : addDays(p.end, -1);
  const s = useMemo(() => budgetSummary(expenses, budget.amountCents, budget.period, asOf), [expenses, budget, asOf]);
  const unsettled = useMemo(() => unsettledPeriods(expenses, moves, budget.amountCents, budget.period, today), [expenses, moves, budget, today]);
  const wants = biggestWants(s);
  const recurring = useMemo(() => recurringCosts(expenses, today), [expenses, today]);
  const mine = expenses.filter((e) => e.date >= p.start && e.date < p.end);
  // Newest first, so the latest category and need-or-want for each "what" wins.
  const known = useMemo(() => {
    const m = new Map<string, { categoryId: string | null; kind: Expense['kind'] }>();
    for (const e of expenses) if (!m.has(e.what.trim().toLowerCase())) m.set(e.what.trim().toLowerCase(), { categoryId: e.categoryId, kind: e.kind });
    return m;
  }, [expenses]);
  const unit = budget.period;
  const hasBudget = budget.amountCents > 0;
  const nameOf = (id: string | null) => (id ? (categoriesById.get(id)?.name ?? 'Other') : 'No category');
  const shift = (dir: -1 | 1) => setViewDate(dir === -1 ? previousPeriod(p, unit).start : p.end);
  const diff = s.spentCents - s.lastSpentCents;

  return (
    <div className="space-y-10">
      {!hasBudget && (
        <section aria-label="Set a budget" className="border border-rule bg-surface p-4">
          <h2 className="font-display text-section">Set a budget</h2>
          <p className="mb-3 text-meta text-ink-muted">How much you plan to spend each {unit}. You can change it any time in Settings.</p>
          <BudgetEditor />
        </section>
      )}

      {unsettled.map((u: UnsettledPeriod) => (
        <section key={u.period.start} aria-label={`${periodShort(u.period, unit)} leftover`} className="flex flex-wrap items-center justify-between gap-3 border border-rule border-l-4 border-l-accent bg-surface px-4 py-3">
          <p className="text-body">
            <span className="font-medium">{periodShort(u.period, unit)}:</span> <Money>{formatCents(u.remainingCents)}</Money> was left over{u.movedCents > 0 ? ' (some already moved)' : ''}. Put it to work?
          </p>
          <Button variant="primary" onClick={() => open({ kind: 'move', period: u })}>
            Move it
          </Button>
        </section>
      ))}

      <section aria-label="Budget">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-section">{periodTitle(p, unit)}</h2>
          <span className="flex items-center gap-1">
            <IconButton icon={ChevronLeft} label={`Previous ${unit}`} onClick={() => shift(-1)} />
            <Button variant="ghost" disabled={current} onClick={() => setViewDate(today)}>
              {unit === 'month' ? 'This month' : 'This week'}
            </Button>
            <IconButton icon={ChevronRight} label={`Next ${unit}`} disabled={current} onClick={() => shift(1)} />
          </span>
        </div>
        {hasBudget ? (
          <>
            <p className="mt-2 font-mono text-page tabular-nums">
              <span className={s.leftCents < 0 ? 'text-danger' : undefined}>{formatCents(s.leftCents)}</span> <span className="font-body text-title text-ink-muted">{s.leftCents < 0 ? 'over' : 'left'}</span>
            </p>
            <div className="mt-2 max-w-xl">
              <Bar share={s.spentCents / budget.amountCents} over={s.leftCents < 0} label="How much of the budget is spent" />
            </div>
            <p className="mt-2 text-meta text-ink-muted">
              <Money className="text-ink">{formatCents(s.spentCents)}</Money> of <Money>{formatCents(budget.amountCents)}</Money> spent
              {current && (
                <>
                  {' · '}at this rate: <Money className={s.paceCents > budget.amountCents ? 'text-danger' : 'text-ink'}>{formatCents(s.paceCents)}</Money> by the end of the {unit}
                </>
              )}
            </p>
          </>
        ) : (
          <p className="mt-2 text-body">
            Spent <Money>{formatCents(s.spentCents)}</Money>
          </p>
        )}
      </section>

      <section aria-label="Add an expense">
        <SectionLabel className="mb-3">Add an expense</SectionLabel>
        <ExpenseForm
          categories={categories}
          today={today}
          submitLabel="Add"
          autoFocus={focusAdd}
          known={known}
          onSubmit={async (f) => (await money.addExpense(f)) !== null}
        />
      </section>

      <div className="grid gap-x-12 gap-y-10 md:grid-cols-2">
        <section aria-label="Spending by category">
          <SectionLabel className="mb-2">By category</SectionLabel>
          {s.byCategory.length === 0 ? (
            <p className="text-meta text-ink-muted">Nothing spent this {unit} yet.</p>
          ) : (
            <ul className="space-y-2">
              {s.byCategory.map((c) => (
                <li key={c.categoryId ?? 'none'}>
                  <div className="flex items-baseline justify-between text-body">
                    <span>{nameOf(c.categoryId)}</span>
                    <Money>{formatCents(c.cents)}</Money>
                  </div>
                  <Bar share={c.cents / s.spentCents} label={`${nameOf(c.categoryId)}: share of what you spent`} />
                </li>
              ))}
            </ul>
          )}
          <Button variant="ghost" icon={Settings2} className="mt-2" onClick={() => open({ kind: 'categories' })}>
            Edit categories
          </Button>
        </section>

        <div className="space-y-8">
          <section aria-label="Needs and wants">
            <SectionLabel className="mb-1">Wants and needs</SectionLabel>
            <Row label="Wants"><Money>{formatCents(s.wantCents)}</Money></Row>
            <Row label="Needs"><Money>{formatCents(s.needCents)}</Money></Row>
          </section>

          <section aria-label="Compared with last period">
            <SectionLabel className="mb-1">Compared with last {unit}</SectionLabel>
            <Row label="This one"><Money>{formatCents(s.spentCents)}</Money></Row>
            <Row label="Last one"><Money>{formatCents(s.lastSpentCents)}</Money></Row>
            <Row label={diff === 0 ? 'The same' : diff > 0 ? 'More' : 'Less'}><Money>{formatCents(Math.abs(diff))}</Money></Row>
          </section>

          <section aria-label="Biggest wants">
            <SectionLabel className="mb-1">Where I could save</SectionLabel>
            <p className="mb-1 text-meta text-ink-muted">Your biggest “want” categories this {unit}, as plain numbers.</p>
            {wants.length === 0 ? <p className="text-meta text-ink-muted">No wants logged yet.</p> : wants.map((w) => <Row key={w.categoryId ?? 'none'} label={nameOf(w.categoryId)}><Money>{formatCents(w.wantCents)}</Money></Row>)}
          </section>
        </div>
      </div>

      <section aria-label="Recurring costs">
        <SectionLabel count={recurring.length} className="mb-1">Recurring costs</SectionLabel>
        {recurring.length === 0 ? (
          <p className="text-meta text-ink-muted">Tick “Repeats monthly” on an expense (a subscription, say) and it will be listed here.</p>
        ) : (
          <>
            <ul>
              {recurring.map((r) => (
                <li key={r.what.toLowerCase()} className="flex items-center justify-between gap-4 border-b border-hairline py-1.5 text-body">
                  <span>
                    {r.what} <span className="text-meta text-ink-muted">· {nameOf(r.categoryId)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <Money>{formatCents(r.amountCents)}</Money>
                    {r.enteredThisMonth ? (
                      <span className="w-20 text-right text-meta text-ink-muted">entered</span>
                    ) : (
                      <Button variant="secondary" onClick={() => void money.addExpense({ amountCents: r.amountCents, what: r.what, categoryId: r.categoryId, date: today, kind: r.kind, recurring: true })}>
                        Add now
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-meta text-ink-muted">
              About <Money className="text-ink">{formatCents(recurring.reduce((n, r) => n + r.amountCents, 0))}</Money> a month.
            </p>
          </>
        )}
      </section>

      <section aria-label="Expenses">
        <SectionLabel count={mine.length} className="mb-1">Expenses</SectionLabel>
        {mine.length === 0 ? (
          <p className="text-meta text-ink-muted">None this {unit}.</p>
        ) : (
          <ul>
            {mine.map((e) => (
              <li key={e.id} className="border-b border-hairline">
                <button type="button" onClick={() => open({ kind: 'expense', expense: e })} className="flex w-full items-baseline gap-3 py-2 text-left hover:bg-surface" aria-label={`Edit ${e.what}, ${formatCents(e.amountCents)}`}>
                  <span className="w-24 shrink-0 font-mono text-time text-ink-muted">{plainDate(e.date)}</span>
                  <span className="min-w-0 flex-1 text-body">
                    {e.what} <span className="text-meta text-ink-muted">· {nameOf(e.categoryId)}{e.kind === 'want' ? ' · want' : ''}{e.recurring ? ' · monthly' : ''}</span>
                  </span>
                  <Money className="text-body">{formatCents(e.amountCents)}</Money>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
