import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { JournalEntry } from '@todo/shared';
import { journalApi } from '../../api/entities';
import { journalHooks } from '../../data/useJournal';
import { cx } from '../../lib/cx';
import { Button } from '../../ui/Button';
import { Textarea } from '../../ui/fields';

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Write about the day and score it 1 to 10. Everything saves by itself shortly after you stop typing, when you leave the box, and when you leave the page; if a save fails, your writing stays on screen and you're told. */
export function JournalEditor({ date, entry }: { date: string; entry: JournalEntry | undefined }) {
  const qc = useQueryClient();
  const [text, setText] = useState(entry?.text ?? '');
  const [rating, setRating] = useState<number | null>(entry?.rating ?? null);
  const [status, setStatus] = useState<'saved' | 'saving' | 'failed'>('saved');
  const draft = useRef({ text, rating });
  draft.current = { text, rating };
  // What the server has, so we only send real changes.
  const stored = useRef({ text: entry?.text ?? '', rating: entry?.rating ?? null });
  // Saves run one after another, so the first save of a day (which creates it) always finishes before the next one looks for it.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const save = useCallback(() => {
    queue.current = queue.current.then(async () => {
      const { text, rating } = draft.current;
      if (text === stored.current.text && rating === stored.current.rating) return;
      setStatus('saving');
      try {
        const existing = qc.getQueryData<JournalEntry[]>(journalHooks.key)?.find((e) => e.date === date);
        const row = existing ? await journalApi.update(existing.id, { text, rating }) : await journalApi.create({ id: crypto.randomUUID(), date, text, rating });
        stored.current = { text, rating };
        qc.setQueryData<JournalEntry[]>(journalHooks.key, (prev = []) => (prev.some((e) => e.id === row.id) ? prev.map((e) => (e.id === row.id ? row : e)) : [...prev, row]));
        setStatus(text === draft.current.text && rating === draft.current.rating ? 'saved' : 'saving');
      } catch {
        setStatus('failed');
      }
    });
    return queue.current;
  }, [date, qc]);

  const dirty = text !== stored.current.text || rating !== stored.current.rating;
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => void save(), 800);
    return () => window.clearTimeout(timer);
  }, [text, rating, dirty, save]);
  // Leaving the page (another day, another screen) saves what's pending.
  useEffect(() => () => void save(), [save]);
  // Closing the tab with something unsaved asks first.
  useEffect(() => {
    if (!dirty && status !== 'failed') return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, status]);

  return (
    <div>
      <Textarea
        aria-label="How was your day?"
        placeholder="How was your day? Write a few paragraphs, or just a line."
        className="min-h-72 leading-relaxed"
        maxLength={20000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => void save()}
      />
      <div className="mt-4">
        <span id="score-label" className="mb-1.5 block text-label text-ink-muted uppercase">How did the day go? 1 is rough, 10 is great</span>
        <div role="radiogroup" aria-labelledby="score-label" className="grid grid-cols-5 gap-px overflow-hidden rounded-control border border-rule bg-rule sm:inline-flex sm:gap-0 sm:bg-transparent">
          {SCORES.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              // Tapping the chosen score again clears it.
              onClick={() => setRating(rating === n ? null : n)}
              className={cx('h-9 min-w-10 px-2 font-mono text-body transition-colors duration-150 sm:border-l sm:border-rule sm:first:border-l-0', rating === n ? 'bg-ink text-paper' : 'bg-surface text-ink hover:bg-accent-soft')}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <p role="status" className={cx('mt-3 flex items-center gap-3 text-meta', status === 'failed' ? 'text-danger' : 'text-ink-muted')}>
        {status === 'saved' && !dirty && (text || rating !== null ? 'Saved' : 'Nothing written yet')}
        {(status === 'saving' || (dirty && status !== 'failed')) && 'Saving…'}
        {status === 'failed' && (
          <>
            Couldn’t save. Your writing is still here.
            <Button variant="secondary" onClick={() => void save()}>
              Try again
            </Button>
          </>
        )}
      </p>
    </div>
  );
}
