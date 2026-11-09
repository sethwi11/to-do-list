import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { countdown, daysBetween, isStageUnlocked, stageTwoDate, type PathSettings } from '@todo/shared';
import { ApiError } from '../../api/client';
import { useApp } from '../../app/AppContext';
import { useAppSettings } from '../../data/useApplications';
import { longDate } from '../../lib/dates';
import { SectionLabel, Textarea } from '../../ui/fields';

/** Stage 1 runs until the 20th birthday. Stage 2 stays locked until then: no opening it and no writing in it. */
export function Stages({ path, today }: { path: PathSettings; today: string }) {
  const { showToast } = useApp();
  const { update } = useAppSettings();
  const opens = stageTwoDate(path.birthday);
  const unlocked = isStageUnlocked(path.birthday, today);
  const [notes, setNotes] = useState(path.stage2Notes);
  useEffect(() => setNotes(path.stage2Notes), [path.stage2Notes]);

  const save = () => {
    if (notes !== path.stage2Notes) update({ path: { stage2Notes: notes } }).catch((err: unknown) => showToast(err instanceof ApiError ? err.message : 'Couldn’t save that. Check that the server is running.'));
  };

  return (
    <section aria-label="Stages">
      <SectionLabel className="mb-3">Stages</SectionLabel>
      <div className="grid gap-4 md:grid-cols-2">
        <article aria-labelledby="stage-1" className="border border-rule border-l-4 border-l-accent bg-surface p-4">
          <h3 id="stage-1" className="font-display text-title">Stage 1 · Foundation</h3>
          <p className="mt-1 text-body">
            {opens ? (
              <>
                {unlocked ? 'Finished' : 'Runs until'} <span className="font-mono">{longDate(opens)}</span>
                {!unlocked && <span className="text-ink-muted"> · {countdown(daysBetween(today, opens))} left</span>}
              </>
            ) : (
              <span className="text-ink-muted">Add your birthday to see when it ends.</span>
            )}
          </p>
          <p className="mt-1 text-meta text-ink-muted">The milestones below are its work.</p>
        </article>

        <article aria-labelledby="stage-2" className="border border-rule bg-surface p-4">
          <h3 id="stage-2" className="flex items-center gap-2 font-display text-title">
            {!unlocked && <Lock className="size-4 text-ink-muted" aria-hidden />}
            Stage 2
          </h3>
          {unlocked ? (
            <Textarea aria-label="What Stage 2 holds" className="mt-2 text-body" placeholder="What’s in this stage?" value={notes} maxLength={5000} onChange={(e) => setNotes(e.target.value)} onBlur={save} />
          ) : (
            <p className="mt-1 text-body text-ink-muted">
              {opens ? (
                <>
                  Locked until <span className="font-mono text-ink">{longDate(opens)}</span> · {countdown(daysBetween(today, opens))} to go
                </>
              ) : (
                'Locked until your 20th birthday. Add your birthday to see the date.'
              )}
            </p>
          )}
        </article>
      </div>
    </section>
  );
}
