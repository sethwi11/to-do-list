import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircleAlert, CircleCheck, FileText, LoaderCircle } from 'lucide-react';
import { coursesApi } from '../../api/entities';
import { useApp } from '../../app/AppContext';
import { cx } from '../../lib/cx';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Select } from '../../ui/fields';
import { Dialog } from '../../ui/Panel';
import { CandidateCard } from './CandidateCard';
import { SourcePreview } from './SourcePreview';
import type { FileEntry, useImportSession } from './useImportSession';

type Importer = ReturnType<typeof useImportSession>;

/** While files are being read: each file, what step it's on, and how far along. */
function Reading({ entries, stage }: { entries: FileEntry[]; stage: string }) {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-xl py-6">
      <p className="mb-5 font-display text-section">{stage}</p>
      <ul className="space-y-4">
        {entries.map((e, i) => (
          <li key={`${e.file.name}:${i}`}>
            <div className="flex items-center gap-2 text-body">
              {e.status === 'done' ? <CircleCheck className="size-4 shrink-0" aria-hidden /> : e.status === 'failed' ? <CircleAlert className="size-4 shrink-0 text-danger" aria-hidden /> : e.status === 'reading' ? <LoaderCircle className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden /> : <FileText className="size-4 shrink-0 text-ink-muted" aria-hidden />}
              <span className="min-w-0 flex-1 truncate">{e.file.name}</span>
              <span className="shrink-0 font-mono text-meta text-ink-muted">{e.status === 'reading' && e.fraction !== null ? `${Math.round(e.fraction * 100)}%` : ''}</span>
            </div>
            <p className={cx('mt-0.5 pl-6 text-meta', e.status === 'failed' ? 'text-danger' : 'text-ink-muted')}>{e.status === 'failed' ? e.error : e.step}</p>
            {e.status === 'reading' && (
              <div className="mt-1.5 ml-6 h-1 bg-hairline" aria-hidden>
                <div className="h-full bg-ink transition-[width] duration-300 ease-out" style={{ width: `${Math.round((e.fraction ?? 0.04) * 100)}%` }} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-meta text-ink-muted">Everything is read on this computer. Nothing is uploaded or saved until you choose Add.</p>
    </div>
  );
}

/** The review: what was found in the files, on the right, each editable; the file itself on the left, jumping to wherever the card you're on came from. */
export function ImportReview({ importer, onManual }: { importer: Importer; onManual: (files: File[]) => void }) {
  const { calendars, eventTypes } = useApp();
  const { session, cancel, setSyllabus, setCourse, updateCard, setAllIncluded, save } = importer;
  const { data: courses = [] } = useQuery({ queryKey: ['courses'], queryFn: coursesApi.list, enabled: session !== null });

  const [viewIndex, setViewIndex] = useState(0);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showFile, setShowFile] = useState(false);
  useEffect(() => {
    if (!session) {
      setViewIndex(0);
      setFocusKey(null);
      setPage(1);
      setShowFile(false);
    }
  }, [session]);

  const focus = useMemo(() => session?.cards.find((c) => c.key === focusKey) ?? null, [session?.cards, focusKey]);
  if (!session) return <Dialog open={false} onClose={cancel} title="" children={null} size="full" />;

  const { entries, cards, phase } = session;
  const done = entries.filter((e) => e.status === 'done');
  const failed = entries.filter((e) => e.status === 'failed');
  const selected = cards.filter((c) => c.include).length;
  const saving = phase === 'saving';
  const viewing = entries[viewIndex] ?? entries[0]!;

  function onFocus(key: string, fileIndex: number, cardPage: number | null) {
    setFocusKey(key);
    setViewIndex(fileIndex);
    if (cardPage) setPage(cardPage);
  }

  const reading = phase === 'reading';
  const nothingFound = !reading && cards.length === 0;

  return (
    <Dialog
      open
      size="full"
      onClose={saving ? () => undefined : cancel}
      title="Add from files"
      footer={
        reading ? (
          <Button variant="ghost" onClick={cancel}>
            Cancel
          </Button>
        ) : nothingFound ? (
          <Button variant="ghost" onClick={cancel}>
            Close
          </Button>
        ) : (
          <>
            <span className="mr-auto self-center text-meta text-ink-muted">
              <span className="font-mono text-ink tabular-nums">{selected}</span> of <span className="font-mono tabular-nums">{cards.length}</span> checked
            </span>
            <Button variant="ghost" onClick={cancel} disabled={saving}>
              Discard
            </Button>
            <Button variant="secondary" onClick={() => void save('all')} disabled={saving}>
              Add all
            </Button>
            <Button variant="primary" onClick={() => void save('selected')} disabled={saving || selected === 0}>
              {saving ? 'Adding…' : `Add selected (${selected})`}
            </Button>
          </>
        )
      }
    >
      {reading ? (
        <div className="h-full overflow-y-auto">
          <Reading entries={entries} stage={session.stage} />
        </div>
      ) : nothingFound ? (
        <div className="mx-auto max-w-xl py-10">
          <p className="font-display text-section">{done.length === 0 ? 'None of those files could be used.' : 'No dates found.'}</p>
          {done.length > 0 && <p className="mt-2 text-body text-ink-muted">Nothing in {done.length === 1 ? 'this file' : 'these files'} looked like a date or a time{done.some((e) => e.usedOcr) ? '. The text was read from a picture, so if it has dates in it, they may not have been read clearly' : ''}.</p>}
          {failed.length > 0 && (
            <ul className="mt-4 space-y-1 text-meta text-danger">
              {failed.map((e) => (
                <li key={e.file.name}>{e.error}</li>
              ))}
            </ul>
          )}
          {done.length > 0 && (
            <Button className="mt-5" variant="secondary" onClick={() => onManual(done.map((e) => e.file))}>
              Add an event myself, with {done.length === 1 ? 'this file' : 'these files'} attached
            </Button>
          )}
        </div>
      ) : (
        <div className="grid h-full min-h-0 gap-x-8 gap-y-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <aside className={cx('min-h-0 flex-col', showFile ? 'flex max-lg:h-[45dvh]' : 'hidden lg:flex')}>
            {done.length > 1 && (
              <div role="tablist" aria-label="Files" className="mb-2 flex gap-1 overflow-x-auto">
                {entries.map((e, i) =>
                  e.status === 'done' ? (
                    <button key={i} type="button" role="tab" aria-selected={i === viewIndex} onClick={() => setViewIndex(i)} className={cx('max-w-44 shrink-0 truncate rounded-control border px-2 py-1 text-meta', i === viewIndex ? 'border-ink bg-ink text-paper' : 'border-rule text-ink hover:bg-accent-soft')}>
                      {e.file.name}
                    </button>
                  ) : null,
                )}
              </div>
            )}
            <div className="min-h-0 flex-1">
              <SourcePreview entry={viewing} focus={focus} page={page} onPage={setPage} />
            </div>
          </aside>

          <section className="flex min-h-0 flex-col">
            <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-hairline pb-3">
              <button type="button" onClick={() => setShowFile((v) => !v)} className="text-meta text-accent-ink underline underline-offset-2 lg:hidden">
                {showFile ? 'Hide the file' : 'Show the file'}
              </button>
              {entries.some((e) => e.kind !== 'ics' && e.status === 'done') && (
                <label className="flex cursor-pointer items-center gap-1 text-body">
                  <Checkbox checked={session.syllabus} onChange={(e) => setSyllabus(e.target.checked)} label="This is a syllabus" />
                  This is a syllabus
                </label>
              )}
              {session.syllabus && courses.length > 0 && (
                <Select aria-label="Course" value={session.courseId} onChange={(e) => setCourse(e.target.value)} wrapperClassName="w-48">
                  <option value="">No course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
              <span className="ml-auto flex gap-3 text-meta">
                <button type="button" onClick={() => setAllIncluded(true)} className="text-accent-ink underline underline-offset-2">
                  Check all
                </button>
                <button type="button" onClick={() => setAllIncluded(false)} className="text-accent-ink underline underline-offset-2">
                  Uncheck all
                </button>
              </span>
            </div>
            {session.syllabus && <p className="mb-2 text-meta text-ink-muted">Deadlines become to-dos with reminders 3 days and 1 day before. Switching this redoes the list below.</p>}
            {failed.map((e) => (
              <p key={e.file.name} role="alert" className="mb-2 border-l-[3px] border-danger pl-3 text-meta text-danger">
                {e.error}
              </p>
            ))}
            {session.notes.map((n) => (
              <p key={n} className="mb-2 border-l-[3px] border-warning pl-3 text-meta text-ink">
                {n}
              </p>
            ))}
            {done.some((e) => e.usedOcr) && <p className="mb-2 text-meta text-ink-muted">Some text was read from a picture, which can have mistakes. Check the titles and times.</p>}
            <ul aria-label="What was found" className="min-h-0 flex-1 overflow-y-auto pr-1">
              {cards.map((card) => (
                <CandidateCard
                  key={card.key}
                  card={card}
                  problem={session.errors[card.key]}
                  calendars={calendars}
                  eventTypes={eventTypes}
                  onChange={(patch) => updateCard(card.key, patch)}
                  onFocus={() => onFocus(card.key, card.fileIndex, card.page)}
                  focused={card.key === focusKey}
                />
              ))}
            </ul>
          </section>
        </div>
      )}
    </Dialog>
  );
}
