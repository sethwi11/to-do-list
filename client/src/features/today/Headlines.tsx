import { useState } from 'react';
import { ExternalLink, Newspaper, RefreshCw } from 'lucide-react';
import { NEWS_SOURCES, type Headline, type NewsSource } from '@todo/shared';
import { ApiError, apiFetch } from '../../api/client';
import { formatTime } from '../../lib/dates';
import { Button } from '../../ui/Button';
import { SectionLabel } from '../../ui/fields';
import { Segmented } from '../../ui/Segmented';

interface Feed {
  source: NewsSource['id'];
  name: string;
  fetchedAt: string;
  items: Headline[];
}

// The last result for each source is kept for the day (this device only), so reopening the page shows it without asking the network again.
const KEY = 'planner.headlines';
type Saved = { source?: NewsSource['id']; feeds?: Partial<Record<NewsSource['id'], { day: string; feed: Feed }>> };
const load = (): Saved => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Saved;
  } catch {
    return {};
  }
};
const save = (saved: Saved) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Private mode: it just won't be remembered.
  }
};
const cached = (source: NewsSource['id'], day: string): Feed | null => {
  const hit = load().feeds?.[source];
  return hit && hit.day === day ? hit.feed : null;
};

/** The day's headlines, from a free public feed, fetched only when you press the button. */
export function Headlines({ today }: { today: string }) {
  const [source, setSource] = useState<NewsSource['id']>(() => load().source ?? 'npr');
  const [feed, setFeed] = useState<Feed | null>(() => cached(source, today));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const info = NEWS_SOURCES.find((s) => s.id === source)!;

  function choose(id: NewsSource['id']) {
    setSource(id);
    setFeed(cached(id, today));
    setError(null);
    save({ ...load(), source: id });
  }
  async function get() {
    setBusy(true);
    setError(null);
    try {
      const fresh = await apiFetch<Feed>(`/headlines?source=${source}`);
      setFeed(fresh);
      const saved = load();
      save({ ...saved, source, feeds: { ...saved.feeds, [source]: { day: today, feed: fresh } } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t get the headlines.');
    } finally {
      setBusy(false);
    }
  }
  const at = feed ? new Date(feed.fetchedAt) : null;

  return (
    <section aria-label="Headlines">
      <SectionLabel className="mb-3">Headlines</SectionLabel>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="News source" value={source} onChange={choose} options={NEWS_SOURCES.map((s) => ({ value: s.id, label: s.id === 'ap' ? 'AP' : s.id === 'pbs' ? 'PBS' : s.name }))} />
        <Button variant={feed ? 'ghost' : 'secondary'} icon={feed ? RefreshCw : Newspaper} disabled={busy} onClick={() => void get()}>
          {busy ? 'Getting them…' : feed ? 'Refresh' : 'Get today’s headlines'}
        </Button>
        {at && feed && (
          <span className="text-meta text-ink-muted">
            {feed.name} · as of {formatTime(`${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`)}
          </span>
        )}
      </div>
      {!feed && !error && (
        <p className="mt-2 text-meta text-ink-muted">
          Nothing is fetched until you press the button.{info.note ? ` ${info.note}.` : ' Each story comes with the publisher’s own one-line summary.'}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-meta text-danger">
          {error}
        </p>
      )}
      {feed && (
        <ul className="mt-4 divide-y divide-hairline border-y border-hairline">
          {feed.items.map((h) => (
            <li key={h.link} className="py-2.5">
              {/* noopener: the page we open must not get a handle back to this one. */}
              <a href={h.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1.5 text-body font-medium text-ink hover:underline hover:underline-offset-4">
                {h.title}
                <ExternalLink className="mt-1 size-3.5 shrink-0 text-ink-muted" aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
              {h.summary && <p className="mt-0.5 text-meta text-ink-muted">{h.summary}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
