import { useMemo, useState } from 'react';
import { Plus, X as XIcon } from 'lucide-react';
import { formatCents, holdingStats, portfolio, savingsProgress, type CalendarColor, type HoldingType, type MoneyMove } from '@todo/shared';
import type { useMoney } from '../../actions/useMoneyActions';
import { calendarVars } from '../../lib/calendarColors';
import { plainDate, shortDate } from '../../lib/dates';
import { HOLDING_LABEL } from '../../lib/money';
import { Button, IconButton } from '../../ui/Button';
import { SectionLabel } from '../../ui/fields';
import { Bar, Money } from './Money';
import type { MoneyDialog } from './MoneyDialogs';

const TYPE_COLOR: Record<HoldingType, CalendarColor> = { stock: 'indigo', etf: 'dusty-blue', crypto: 'ochre', savings: 'sage', 'real-estate': 'terracotta', other: 'slate' };

/** +$50 / -$20, and +4.0% / -20.0%. */
const signed = (cents: number) => `${cents > 0 ? '+' : ''}${formatCents(cents)}`;
const percent = (ratio: number | null) => (ratio === null ? '' : ` (${ratio > 0 ? '+' : ''}${(ratio * 100).toFixed(1)}%)`);

/** What went in, newest first, each removable (with Undo). */
function MoveLog({ moves, money, empty }: { moves: readonly MoneyMove[]; money: ReturnType<typeof useMoney>; empty: string }) {
  if (moves.length === 0) return <p className="py-1 text-meta text-ink-muted">{empty}</p>;
  return (
    <ul className="border-t border-hairline">
      {[...moves].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).map((m) => (
        <li key={m.id} className="flex items-center justify-between gap-3 border-b border-hairline py-1 text-meta">
          <span className="text-ink-muted">
            {plainDate(m.date)}
            {m.periodStart ? ' · from a leftover' : ''}
            {m.note ? ` · ${m.note}` : ''}
          </span>
          <span className="flex items-center gap-1">
            <Money className="text-ink">{formatCents(m.amountCents)}</Money>
            <IconButton icon={XIcon} label={`Remove ${formatCents(m.amountCents)} from ${plainDate(m.date)}`} onClick={() => void money.removeMove(m)} className="size-7" />
          </span>
        </li>
      ))}
    </ul>
  );
}
interface Props {
  money: ReturnType<typeof useMoney>;
  today: string;
  open: (dialog: MoneyDialog) => void;
}

/** Savings goals and investments, all typed in by hand: totals and progress, never advice. */
export function SavingsTab({ money, today, open }: Props) {
  const { goals, holdings, moves } = money;
  const [log, setLog] = useState<string | null>(null);
  const pf = useMemo(() => portfolio(holdings, moves, today), [holdings, moves, today]);
  const toggle = (id: string) => setLog(log === id ? null : id);

  return (
    <div className="space-y-12">
      <section aria-label="Savings goals">
        <div className="mb-2 flex items-center justify-between gap-3">
          <SectionLabel count={goals.length} className="flex-1">Savings goals</SectionLabel>
          <Button variant="secondary" icon={Plus} onClick={() => open({ kind: 'goal', goal: null })}>
            New goal
          </Button>
        </div>
        {goals.length === 0 && <p className="text-meta text-ink-muted">A goal is something you’re saving toward, with a target. Money you move from a leftover (or add yourself) fills it.</p>}
        <ul className="space-y-6">
          {goals.map((g) => {
            const { savedCents, share } = savingsProgress(g, moves);
            return (
              <li key={g.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <h3 className="font-display text-title">{g.name}</h3>
                  <p className="text-body">
                    <Money>{formatCents(savedCents)}</Money> <span className="text-meta text-ink-muted">of</span> <Money>{formatCents(g.targetCents)}</Money> <span className="text-meta text-ink-muted">· {Math.round(share * 100)}%</span>
                  </p>
                </div>
                <div className="my-1.5 max-w-xl">
                  <Bar share={share} label={`${g.name}: progress to the target`} />
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button variant="secondary" onClick={() => open({ kind: 'putIn', toType: 'goal', toId: g.id, name: g.name })}>
                    Add money
                  </Button>
                  <Button variant="ghost" aria-expanded={log === g.id} onClick={() => toggle(g.id)}>
                    History
                  </Button>
                  <Button variant="ghost" onClick={() => open({ kind: 'goal', goal: g })}>
                    Edit
                  </Button>
                </div>
                {log === g.id && <MoveLog moves={moves.filter((m) => m.toType === 'goal' && m.toId === g.id)} money={money} empty="Nothing added yet." />}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Investments">
        <div className="mb-2 flex items-center justify-between gap-3">
          <SectionLabel count={holdings.length} className="flex-1">Investments</SectionLabel>
          <Button variant="secondary" icon={Plus} onClick={() => open({ kind: 'holding', holding: null })}>
            New holding
          </Button>
        </div>
        {holdings.length === 0 ? (
          <p className="text-meta text-ink-muted">A holding is something you own (a stock, a fund, crypto, a savings account…). You type what you put in and what it’s worth; nothing is fetched and nothing connects to an account.</p>
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-4 border-y border-hairline py-3">
              <div>
                <dt className="text-label text-ink-muted uppercase">Put in</dt>
                <dd><Money className="text-title">{formatCents(pf.putInCents)}</Money></dd>
              </div>
              <div>
                <dt className="text-label text-ink-muted uppercase">Worth now</dt>
                <dd><Money className="text-title">{formatCents(pf.worthCents)}</Money></dd>
              </div>
              <div>
                <dt className="text-label text-ink-muted uppercase">Gain or loss</dt>
                <dd><Money className={pf.gainCents < 0 ? 'text-title text-danger' : 'text-title'}>{`${signed(pf.gainCents)}${percent(pf.gainRatio)}`}</Money></dd>
              </div>
            </dl>
            {pf.allocation.length > 0 && (
              <div className="mt-4" aria-label="Allocation by type">
                <div role="img" aria-label={`Allocation: ${pf.allocation.map((a) => `${HOLDING_LABEL[a.type]} ${Math.round(a.share * 100)}%`).join(', ')}`} className="flex h-3 overflow-hidden rounded-full bg-hairline">
                  {pf.allocation.map((a) => (
                    <span key={a.type} style={{ ...calendarVars(TYPE_COLOR[a.type]), width: `${a.share * 100}%` }} className="h-full bg-(color:--c)" />
                  ))}
                </div>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-meta text-ink-muted">
                  {pf.allocation.map((a) => (
                    <li key={a.type} style={calendarVars(TYPE_COLOR[a.type])} className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="size-2.5 bg-(color:--c)" />
                      {HOLDING_LABEL[a.type]} <Money className="text-ink">{`${Math.round(a.share * 100)}%`}</Money>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ul className="mt-6 space-y-6">
              {holdings.map((h) => {
                const s = holdingStats(h, moves, today);
                return (
                  <li key={h.id}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                      <h3 className="font-display text-title">
                        {h.name} <span className="font-body text-meta text-ink-muted">{HOLDING_LABEL[h.type]}</span>
                      </h3>
                      <p className="text-body">
                        <Money>{formatCents(s.worthCents)}</Money>{' '}
                        <Money className={s.gainCents < 0 ? 'text-meta text-danger' : 'text-meta text-ink-muted'}>{`${signed(s.gainCents)}${percent(s.gainRatio)}`}</Money>
                      </p>
                    </div>
                    <p className="text-meta text-ink-muted">
                      Put in <Money>{formatCents(s.putInCents)}</Money> · value updated {shortDate(h.valueUpdatedOn)}
                    </p>
                    {s.monthly && (
                      <div className="mt-1 max-w-xl">
                        <p className="text-meta">
                          <Money>{formatCents(s.monthly.thisMonthCents)}</Money> <span className="text-ink-muted">of</span> <Money>{formatCents(s.monthly.targetCents)}</Money> <span className="text-ink-muted">this month</span>
                        </p>
                        <Bar share={s.monthly.thisMonthCents / s.monthly.targetCents} label={`${h.name}: this month's contributions against its target`} />
                      </div>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <Button variant="secondary" onClick={() => open({ kind: 'value', holding: h })}>
                        Update value
                      </Button>
                      <Button variant="secondary" onClick={() => open({ kind: 'putIn', toType: 'holding', toId: h.id, name: h.name })}>
                        Add money
                      </Button>
                      <Button variant="ghost" aria-expanded={log === h.id} onClick={() => toggle(h.id)}>
                        Contributions
                      </Button>
                      <Button variant="ghost" onClick={() => open({ kind: 'holding', holding: h })}>
                        Edit
                      </Button>
                    </div>
                    {log === h.id && <MoveLog moves={moves.filter((m) => m.toType === 'holding' && m.toId === h.id)} money={money} empty="No contributions logged yet." />}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <p className="border-t border-hairline pt-3 text-meta text-ink-muted">Tracking only. Everything here is what you typed in: nothing connects to a bank or fetches prices, and none of it is advice.</p>
    </div>
  );
}
