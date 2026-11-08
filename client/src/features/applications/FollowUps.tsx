import { Link } from 'react-router';
import { FOLLOW_UP_AFTER_DAYS, type Application, type FollowUpSuggestion } from '@todo/shared';
import { Button } from '../../ui/Button';
import { SectionLabel } from '../../ui/fields';
import { ago } from './format';
import { shortDate } from '../../lib/dates';

interface FollowUpsProps {
  suggestions: FollowUpSuggestion[];
  onAnswer: (application: Application, answer: 'accept' | 'dismiss') => void;
}

/** Applications that have gone quiet: add a follow-up to-do, or dismiss the suggestion. Nothing is added until you say so. */
export function FollowUps({ suggestions, onAnswer }: FollowUpsProps) {
  if (suggestions.length === 0) return null;
  return (
    <section aria-label="Time to follow up" className="mb-8">
      <SectionLabel count={suggestions.length} className="mb-1">
        Time to follow up?
      </SectionLabel>
      <p className="mb-1 text-meta text-ink-muted">These have been in Applied for {FOLLOW_UP_AFTER_DAYS} days or more with no change.</p>
      <ul>
        {suggestions.map(({ application: a, days, since }) => (
          <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline py-3">
            <span className="min-w-0 flex-1 basis-56">
              <Link to={`/applications/${a.id}`} className="text-body font-medium hover:underline focus-visible:underline">
                {a.company}
              </Link>
              <span className="text-body text-ink-muted"> · {a.role}</span>
              <span className="block text-meta text-ink-muted">
                Applied {shortDate(since)} ({ago(days)}), no reply yet
              </span>
            </span>
            <span className="flex gap-1">
              <Button variant="secondary" onClick={() => onAnswer(a, 'accept')}>
                Add follow-up to-do
              </Button>
              <Button variant="ghost" onClick={() => onAnswer(a, 'dismiss')}>
                Dismiss
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
