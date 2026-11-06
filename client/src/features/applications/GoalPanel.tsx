import { Link } from 'react-router';
import { APPLICATION_STATUSES, applicationStats, goalProgress, stageCounts, weeklyApplied, type Application, type ApplicationStatus } from '@todo/shared';
import { Button } from '../../ui/Button';
import { ProgressBar } from '../../ui/kanban';
import { SectionLabel } from '../../ui/fields';
import { longDate, percent, shortDate } from './format';

interface GoalPanelProps {
  applications: Application[];
  goal: number;
  targetDate: string;
  today: string;
  /** Opens the place the goal is edited. */
  onEditGoal: () => void;
}

/**
 * The top of the tracker: offers so far against your goal (with the target date), the number of applications in each stage,
 * and the three numbers worth watching: how many you're sending, how many companies answer, how many get you to an interview.
 */
export function GoalPanel({ applications, goal, targetDate, today, onEditGoal }: GoalPanelProps) {
  const progress = goalProgress(applications, goal, targetDate, today);
  const stats = applicationStats(applications, today);
  const counts = stageCounts(applications);
  const weeks = weeklyApplied(applications, today, 8);
  const most = Math.max(1, ...weeks.map((w) => w.count));

  const timeLeft =
    progress.daysLeft > 0 ? `${progress.daysLeft} day${progress.daysLeft === 1 ? '' : 's'} left` : progress.daysLeft === 0 ? 'the target date is today' : `${-progress.daysLeft} day${progress.daysLeft === -1 ? '' : 's'} past the target date`;

  return (
    <section aria-label="Goal and stats" className="mb-8">
      <div className="grid gap-x-12 gap-y-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div>
          <SectionLabel className="mb-3">Offer goal</SectionLabel>
          <ProgressBar value={Math.min(progress.offers, progress.goal)} max={progress.goal} label={progress.offers > progress.goal ? `offers (${progress.offers} so far)` : 'offers'} />
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-meta text-ink-muted">
            <span>
              by {longDate(targetDate)} · {timeLeft}
            </span>
            <Button variant="ghost" className="-ml-2 h-7 px-2" onClick={onEditGoal}>
              Change goal
            </Button>
          </p>
        </div>

        <div>
          <SectionLabel className="mb-3">How it’s going</SectionLabel>
          <dl className="grid grid-cols-3 gap-4">
            <Stat label="Applied" value={String(stats.applied)} note={`${stats.perWeek.toFixed(1)} a week lately`} />
            <Stat label="Heard back" value={percent(stats.responseRate)} note={`${stats.responded} of ${stats.applied}`} />
            <Stat label="Interviews" value={percent(stats.interviewRate)} note={`${stats.interviewed} of ${stats.applied}`} />
          </dl>
          <figure className="mt-3">
            <div className="flex h-8 items-end gap-1" role="img" aria-label={`Applications per week, last 8 weeks: ${weeks.map((w) => w.count).join(', ')}`}>
              {weeks.map((w, i) => (
                <div
                  key={w.weekStart}
                  title={`Week of ${shortDate(w.weekStart)}: ${w.count}`}
                  className={i === weeks.length - 1 ? 'w-full bg-accent' : 'w-full bg-ink-muted/40'}
                  style={{ height: `${Math.max(w.count === 0 ? 0 : 12, (w.count / most) * 100)}%`, minHeight: w.count === 0 ? 2 : undefined }}
                />
              ))}
            </div>
            <figcaption className="mt-1 text-meta text-ink-muted">Sent per week, last 8 weeks (this week is the red bar)</figcaption>
          </figure>
        </div>
      </div>

      <ul aria-label="Applications in each stage" className="mt-6 flex flex-wrap gap-x-5 gap-y-1 border-t border-hairline pt-3 text-meta text-ink-muted">
        {APPLICATION_STATUSES.map((s: ApplicationStatus) => (
          <li key={s}>
            <Link to={`/applications?view=table&status=${encodeURIComponent(s)}`} className="hover:text-ink hover:underline focus-visible:underline">
              {s} <span className="font-mono tabular-nums">{counts[s]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <dt className="text-label text-ink-muted uppercase">{label}</dt>
      <dd className="font-display text-section tabular-nums">{value}</dd>
      <dd className="text-meta text-ink-muted">{note}</dd>
    </div>
  );
}
