import { useMemo, useState, type FormEvent } from 'react';
import { Check, Plus, RotateCcw } from 'lucide-react';
import { addDays, countdown, daysBetween, doneMinutes, formatCents, formatMinutes, goalProgress, savingsProgress, type CheckIn, type Milestone, type MoneyMove, type SavingsGoal } from '@todo/shared';
import { useMilestones } from '../../actions/usePathActions';
import { useApp } from '../../app/AppContext';
import { useAppSettings } from '../../data/useApplications';
import { checkInHooks } from '../../data/useCheckIns';
import { goalHooks, moneyMoveHooks } from '../../data/useMoney';
import { calendarVars } from '../../lib/calendarColors';
import { cx } from '../../lib/cx';
import { longDate } from '../../lib/dates';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Field, Input, SectionLabel, Select } from '../../ui/fields';
import { Bar, Money } from '../money/Money';
import { Shell as FormDialog } from '../money/MoneyDialogs';

type Api = ReturnType<typeof useMilestones>;

function MilestoneForm({ milestone, goals, api, onClose }: { milestone: Milestone | null; goals: readonly SavingsGoal[]; api: Api; onClose: () => void }) {
  const { calendars } = useApp();
  const [title, setTitle] = useState(milestone?.title ?? '');
  const [titleError, setTitleError] = useState<string | undefined>();
  const [targetDate, setTargetDate] = useState(milestone?.targetDate ?? '');
  const [calendarIds, setCalendarIds] = useState(milestone?.calendarIds ?? []);
  const [goalId, setGoalId] = useState(milestone?.savingsGoalId ?? '');
  const [trackOffers, setTrackOffers] = useState(milestone?.trackOffers ?? false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setTitleError('Give the milestone a name.');
    const saved = await api.save({ title: title.trim(), targetDate: targetDate || null, calendarIds, savingsGoalId: goalId || null, trackOffers }, milestone ?? undefined);
    if (saved) onClose();
  }

  return (
    <FormDialog title={milestone ? 'Edit milestone' : 'New milestone'} formId="milestone-form" submit={milestone ? 'Save' : 'Add milestone'} onClose={onClose} onDelete={milestone ? () => void api.deleteMilestone(milestone) : undefined}>
      <form id="milestone-form" onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        <Field label="Milestone" error={titleError}>{(p) => <Input {...p} data-autofocus value={title} maxLength={120} onChange={(e) => { setTitle(e.target.value); setTitleError(undefined); }} />}</Field>
        <Field label="Target date (optional)">{(p) => <Input {...p} type="date" className="w-44!" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />}</Field>
        <div>
          <span className="mb-1.5 block text-label text-ink-muted uppercase">Categories whose hours feed it</span>
          <div className="flex flex-wrap gap-1.5">
            {calendars.map((c) => {
              const on = calendarIds.includes(c.id);
              return (
                <button key={c.id} type="button" aria-pressed={on} onClick={() => setCalendarIds(on ? calendarIds.filter((id) => id !== c.id) : [...calendarIds, c.id])} style={calendarVars(c.color)} className={cx('inline-flex h-7 items-center gap-1.5 rounded-control border px-2 text-meta transition-colors duration-150', on ? 'border-ink text-ink' : 'border-hairline text-ink-muted')}>
                  <span aria-hidden className="size-2 bg-(color:--c)" />
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
        <Field label="Savings goal feeding it">
          {(p) => (
            <Select {...p} value={goalId} onChange={(e) => setGoalId(e.target.value)}>
              <option value="">None</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <label className="flex cursor-pointer items-center gap-1 text-body">
          <Checkbox checked={trackOffers} onChange={(e) => setTrackOffers(e.target.checked)} label="Counts offers from Applications" />
          Counts offers from Applications (the offer goal in Settings)
        </label>
      </form>
    </FormDialog>
  );
}

/** What feeds a milestone, as plain readouts: offers against the goal, a savings goal's progress, and the hours put into its categories. */
function Inputs({ m, today, checkIns, goals, moves }: { m: Milestone; today: string; checkIns: readonly CheckIn[]; goals: readonly SavingsGoal[]; moves: readonly MoneyMove[] }) {
  const { applications, calendarsById } = useApp();
  const { settings } = useAppSettings();
  const goal = m.savingsGoalId ? goals.find((g) => g.id === m.savingsGoalId) : undefined;
  const offers = m.trackOffers ? goalProgress(applications, settings.offerGoal, settings.offerTargetDate, today) : null;
  const saved = goal ? savingsProgress(goal, moves) : null;
  const weekAgo = addDays(today, -6);
  const monthAgo = addDays(today, -27);
  if (!offers && !saved && m.calendarIds.length === 0) return null;
  return (
    <ul className="mt-2 max-w-xl space-y-2 text-meta">
      {offers && (
        <li>
          <p>
            <span className="font-mono text-ink">{offers.offers}</span> of <span className="font-mono">{offers.goal}</span> offers <span className="text-ink-muted">· {offers.daysLeft >= 0 ? `${countdown(offers.daysLeft)} left` : 'target date has passed'}</span>
          </p>
          <Bar share={offers.offers / offers.goal} label="Offers so far against the goal" />
        </li>
      )}
      {goal && saved && (
        <li>
          <p>
            <Money className="text-ink">{formatCents(saved.savedCents)}</Money> of <Money>{formatCents(goal.targetCents)}</Money> <span className="text-ink-muted">· {goal.name}</span>
          </p>
          <Bar share={saved.share} label={`${goal.name}: progress to the target`} />
        </li>
      )}
      {m.calendarIds.length > 0 && (
        <li>
          <span className="font-mono text-ink">{formatMinutes(doneMinutes(checkIns, m.calendarIds, weekAgo, today))}</span> this week,{' '}
          <span className="font-mono text-ink">{formatMinutes(doneMinutes(checkIns, m.calendarIds, monthAgo, today))}</span> in the last 4 weeks
          <span className="text-ink-muted"> · {m.calendarIds.map((id) => calendarsById.get(id)?.name).filter(Boolean).join(', ')}</span>
        </li>
      )}
    </ul>
  );
}

/** The milestones of the Foundation stage, each with the inputs feeding it. */
export function Milestones({ today }: { today: string }) {
  const api = useMilestones();
  const checkIns = checkInHooks.useList().data ?? [];
  const goals = goalHooks.useList().data ?? [];
  const moves = moneyMoveHooks.useList().data ?? [];
  const [dialog, setDialog] = useState<{ milestone: Milestone | null } | null>(null);
  // Open ones first (the soonest target on top), reached ones after.
  const sorted = useMemo(() => [...api.milestones].sort((a, b) => Number(a.reachedOn !== null) - Number(b.reachedOn !== null) || (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999') || a.sortOrder - b.sortOrder), [api.milestones]);

  return (
    <section aria-label="Milestones">
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionLabel count={sorted.length} className="flex-1">Milestones</SectionLabel>
        <Button variant="secondary" icon={Plus} onClick={() => setDialog({ milestone: null })}>
          New milestone
        </Button>
      </div>
      {sorted.length === 0 && !api.loading && <p className="text-meta text-ink-muted">A milestone is something concrete you’re working toward. Link it to categories, a savings goal or your offers, and the inputs show up under it.</p>}
      <ul className="divide-y divide-hairline border-y border-hairline">
        {sorted.map((m) => (
          <li key={m.id} className="py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className={cx('text-body', m.reachedOn && 'text-ink-muted')}>
                <span className={cx('font-medium', m.reachedOn && 'line-through')}>{m.title}</span>
                <span className="text-meta text-ink-muted">
                  {m.reachedOn ? ` · reached ${longDate(m.reachedOn)}` : m.targetDate ? ` · by ${longDate(m.targetDate)}, ${daysBetween(today, m.targetDate) >= 0 ? `${countdown(daysBetween(today, m.targetDate))} to go` : 'past the date'}` : ''}
                </span>
              </p>
              <span className="flex gap-1">
                {m.reachedOn ? (
                  <Button variant="ghost" icon={RotateCcw} onClick={() => void api.setReached(m, null)}>
                    Reopen
                  </Button>
                ) : (
                  <Button variant="secondary" icon={Check} onClick={() => void api.setReached(m, today)}>
                    Mark reached
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setDialog({ milestone: m })}>
                  Edit
                </Button>
              </span>
            </div>
            <Inputs m={m} today={today} checkIns={checkIns} goals={goals} moves={moves} />
          </li>
        ))}
      </ul>
      {dialog && <MilestoneForm milestone={dialog.milestone} goals={goals} api={api} onClose={() => setDialog(null)} />}
    </section>
  );
}
