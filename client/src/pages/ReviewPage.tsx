import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { addDays, defaultReviewWeek, goalStandings, LocalDateSchema, openBumps, reviewSummary, scoreboard, weekRange, workloadByDay, type Task, type WeeklyReview } from '@todo/shared';
import { useApp } from '../app/AppContext';
import { PageHeader } from '../app/PageHeader';
import { useAppSettings } from '../data/useApplications';
import { checkInHooks } from '../data/useCheckIns';
import { keys } from '../data/queryClient';
import { expenseHooks, goalHooks, moneyMoveHooks } from '../data/useMoney';
import { milestoneHooks, weeklyReviewHooks } from '../data/usePath';
import { NextWeek } from '../features/review/NextWeek';
import { ScoreboardView } from '../features/review/ScoreboardView';
import { MissedList } from '../features/today/MissedList';
import { useNowText, usePlanSources } from '../features/today/useTodayPlan';
import { plainDate, shortDate, toLocalISODate } from '../lib/dates';
import { Button, IconButton } from '../ui/Button';
import { Input, SectionLabel, Textarea } from '../ui/fields';
import { SkeletonRows } from '../ui/states';

const SLOTS = [0, 1, 2] as const;

/** The week looked back on: the scoreboard, what slipped, what was learned, the week ahead, three priorities, and one block to paste into a chat with Claude. */
export default function ReviewPage() {
  const { today } = useApp();
  const asked = useSearchParams()[0].get('week');
  const reviews = weeklyReviewHooks.useList();
  const checkIns = checkInHooks.useList();
  // Opens on last week while this one has barely started; a week picked with the arrows (or in the address) is always honored.
  const weekStart = asked && LocalDateSchema.safeParse(asked).success ? weekRange(asked)[0] : defaultReviewWeek(today, checkIns.data ?? []);
  const expenses = expenseHooks.useList();
  const moves = moneyMoveHooks.useList();
  const { routine } = usePlanSources();
  if (reviews.isPending || checkIns.isPending || expenses.isPending || moves.isPending || routine.loading) return <SkeletonRows count={6} />;
  // Keyed by week so each week starts from its own saved priorities and notes.
  return <ReviewBody key={weekStart} weekStart={weekStart} review={reviews.data?.find((r) => r.weekStart === weekStart)} />;
}

function ReviewBody({ weekStart, review }: { weekStart: string; review: WeeklyReview | undefined }) {
  const { today, calendars, applications, events, timeBlocks, tasks, showToast } = useApp();
  const { src } = usePlanSources();
  const { settings } = useAppSettings();
  const now = useNowText();
  const qc = useQueryClient();
  const setParams = useSearchParams()[1];
  const checkIns = checkInHooks.useList().data ?? [];
  const expenses = expenseHooks.useList().data ?? [];
  const moves = moneyMoveHooks.useList().data ?? [];
  const goals = goalHooks.useList().data ?? [];
  const milestones = milestoneHooks.useList().data ?? [];
  const create = weeklyReviewHooks.useCreate();
  const update = weeklyReviewHooks.useUpdate();
  const [priorities, setPriorities] = useState<string[]>(SLOTS.map((i) => review?.priorities[i] ?? ''));
  const [notes, setNotes] = useState(review?.notes ?? '');

  const weekEnd = addDays(weekStart, 6);
  const thisWeek = weekRange(today)[0];
  const names = useMemo(() => new Map(calendars.map((c) => [c.id, c.name])), [calendars]);
  const score = useMemo(() => scoreboard({ src, checkIns, applications, calendars, expenses, moves, budget: settings.budget }, weekStart, today), [src, checkIns, applications, calendars, expenses, moves, settings.budget, weekStart, today]);
  const unmadeUp = useMemo(() => openBumps(src, weekStart, weekEnd < today ? weekEnd : today), [src, weekStart, weekEnd, today]);
  const learned = checkIns.filter((c) => c.learned && c.date >= weekStart && c.date <= weekEnd).sort((a, b) => a.date.localeCompare(b.date)).map((c) => ({ date: c.date, title: c.title, learned: c.learned! }));
  // Missed rolling to-dos are hidden from every list, so read them from the raw cache.
  const missed = (qc.getQueryData<Task[]>(keys.tasks) ?? []).filter((t) => t.missedAt && toLocalISODate(new Date(t.missedAt)) >= weekStart && toLocalISODate(new Date(t.missedAt)) <= weekEnd);
  const nextWeek = useMemo(() => [...workloadByDay(addDays(weekStart, 7), addDays(weekStart, 14), { events, blocks: timeBlocks, tasks }).values()], [weekStart, events, timeBlocks, tasks]);

  const chosen = priorities.map((p) => p.trim()).filter(Boolean);
  const standings = goalStandings({ applications, offerGoal: settings.offerGoal, offerTargetDate: settings.offerTargetDate, goals, moves, milestones, today });
  const summary = reviewSummary({ score, names, unmadeUp, missedTasks: missed.map((t) => t.title), learned, goals: standings, nextWeek, priorities: chosen, notes });

  /** Saves the priorities and notes; the review for the week is made the first time. */
  const save = (changes: { priorities?: string[]; notes?: string }) => {
    const done = review ? update.mutateAsync({ id: review.id, changes }) : create.mutateAsync({ weekStart, ...changes });
    done.catch(() => showToast('Couldn’t save that. Check that the server is running.'));
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary);
      showToast('Copied. Paste it into a chat with Claude.');
    } catch {
      showToast('Couldn’t copy. Open the preview below and copy the text from there.');
    }
  }

  const go = (week: string) => setParams({ week });

  return (
    <div className="max-w-[900px]">
      <PageHeader title="Sunday review" subtitle={`${shortDate(weekStart)} to ${shortDate(weekEnd)}`}>
        <div className="mt-3 flex items-center gap-1">
          <IconButton icon={ChevronLeft} label="Previous week" onClick={() => go(addDays(weekStart, -7))} />
          <Button variant="ghost" disabled={weekStart === thisWeek} onClick={() => go(thisWeek)}>
            This week
          </Button>
          <IconButton icon={ChevronRight} label="Next week" disabled={weekStart >= thisWeek} onClick={() => go(addDays(weekStart, 7))} />
        </div>
      </PageHeader>

      <div className="space-y-12">
        <ScoreboardView score={score} />

        <MissedList bumps={unmadeUp} src={src} now={now} />

        {missed.length > 0 && (
          <section aria-label="Missed to-dos">
            <SectionLabel count={missed.length} className="mb-2">Missed to-dos</SectionLabel>
            <ul className="space-y-1 text-body">
              {missed.map((t) => (
                <li key={t.id}>
                  {t.title} <span className="text-meta text-ink-muted">· rolled over to the next one</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-label="Learning log">
          <SectionLabel count={learned.length} className="mb-2">What I learned</SectionLabel>
          {learned.length === 0 ? (
            <p className="text-meta text-ink-muted">No lines in the check-ins this week.</p>
          ) : (
            <ul className="space-y-1.5 text-body">
              {learned.map((l, i) => (
                <li key={i}>
                  <span className="font-mono text-time text-ink-muted">{plainDate(l.date)}</span> · {l.title}: {l.learned}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Next week">
          <SectionLabel className="mb-2">Next week</SectionLabel>
          <NextWeek days={nextWeek} />
        </section>

        <section aria-label="Priorities">
          <SectionLabel className="mb-2">Three priorities for next week</SectionLabel>
          <ol className="space-y-2">
            {SLOTS.map((i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="w-4 font-mono text-meta text-ink-muted">{i + 1}</span>
                <Input
                  aria-label={`Priority ${i + 1}`}
                  maxLength={200}
                  value={priorities[i]}
                  onChange={(e) => setPriorities(priorities.map((p, j) => (j === i ? e.target.value : p)))}
                  onBlur={() => JSON.stringify(chosen) !== JSON.stringify(review?.priorities ?? []) && save({ priorities: chosen })}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                />
              </li>
            ))}
          </ol>
          <Textarea aria-label="Notes on the week" className="mt-4" placeholder="Anything else from the week (optional)" maxLength={20000} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (review?.notes ?? '') && save({ notes })} />
        </section>

        <section aria-label="Summary for Claude">
          <SectionLabel className="mb-2">For coaching</SectionLabel>
          <p className="mb-3 text-meta text-ink-muted">One block with the week above. Paste it into a chat with Claude and type your questions at the end.</p>
          <Button variant="primary" icon={Copy} onClick={() => void copy()}>
            Copy summary for Claude
          </Button>
          <details className="mt-3">
            <summary className="cursor-pointer text-meta text-ink-muted">Preview</summary>
            <pre className="mt-2 overflow-x-auto border border-hairline bg-surface p-3 font-mono text-time whitespace-pre-wrap">{summary}</pre>
          </details>
        </section>
      </div>
    </div>
  );
}
