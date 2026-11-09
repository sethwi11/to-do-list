import { formatCents, formatMinutes, type Scoreboard } from '@todo/shared';
import { useApp } from '../../app/AppContext';
import { Bar, Money } from '../money/Money';
import { SectionLabel } from '../../ui/fields';

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-1.5 text-body last:border-b-0">
    <span>{label}</span>
    <span className="font-mono tabular-nums">{children}</span>
  </div>
);

/** The week's numbers: hours planned against done per category, the counts, the money, and what happened to bumped time. */
export function ScoreboardView({ score: s }: { score: Scoreboard }) {
  const { calendarsById } = useApp();
  const b = s.bumped;
  return (
    <div className="space-y-8">
      <section aria-label="Planned and done">
        <SectionLabel className="mb-2">Planned vs done</SectionLabel>
        {s.categories.length === 0 ? (
          <p className="text-meta text-ink-muted">Nothing was planned.</p>
        ) : (
          <ul className="space-y-2">
            {s.categories.map((c) => {
              const name = c.calendarId ? (calendarsById.get(c.calendarId)?.name ?? 'No category') : 'No category';
              return (
                <li key={c.calendarId ?? 'none'}>
                  <div className="flex items-baseline justify-between text-body">
                    <span>{name}</span>
                    <span className="font-mono tabular-nums">
                      {formatMinutes(c.doneMinutes)} <span className="text-meta text-ink-muted">of {formatMinutes(c.plannedMinutes)}</span>
                    </span>
                  </div>
                  <Bar share={c.plannedMinutes > 0 ? c.doneMinutes / c.plannedMinutes : 1} label={`${name}: hours done against hours planned`} />
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-meta text-ink-muted">Done counts in full, Part for half, Skipped for nothing.</p>
      </section>

      <div className="grid gap-x-12 gap-y-8 md:grid-cols-2">
        <section aria-label="Counts">
          <SectionLabel className="mb-1">The week in numbers</SectionLabel>
          <Row label="Gym days">{s.gymDays}</Row>
          <Row label="LeetCode sessions">{s.leetcodeSessions}</Row>
          <Row label="Applications sent">{s.applicationsSent}</Row>
          <Row label="Real estate">{formatMinutes(s.realEstateMinutes)}</Row>
          <Row label="Reading">{formatMinutes(s.readingMinutes)}</Row>
        </section>
        <section aria-label="Money">
          <SectionLabel className="mb-1">Money</SectionLabel>
          <Row label="Spent this week"><Money>{formatCents(s.spentCents)}</Money></Row>
          {s.budgetCents > 0 && (
            <Row label={`This ${s.budgetPeriod}, of the budget`}>
              <Money>{formatCents(s.periodSpentCents)}</Money> <span className="text-meta text-ink-muted">of {formatCents(s.budgetCents)}</span>
            </Row>
          )}
          <Row label="Saved"><Money>{formatCents(s.savedCents)}</Money></Row>
          <Row label="Invested"><Money>{formatCents(s.investedCents)}</Money></Row>
        </section>
      </div>

      <section aria-label="Bumped time">
        <SectionLabel className="mb-1">Bumped time</SectionLabel>
        <Row label="Made up">{formatMinutes(b.madeUpMinutes)}</Row>
        <Row label="Let go">{formatMinutes(b.letGoMinutes)}</Row>
        <Row label="Not made up">{formatMinutes(b.openMinutes)}</Row>
      </section>
    </div>
  );
}
