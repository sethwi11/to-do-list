import { useEffect, useRef, useState } from 'react';
import { addMinutes, parseQuotes, popupsForDay, quotesToText, SoundtrackSchema, timePart, type Soundtrack } from '@todo/shared';
import { Plus, X } from 'lucide-react';
import { Download, Upload } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import { ApiError } from '../../api/client';
import { backupApi, type ImportSummary } from '../../api/backup';
import { useAppSettings } from '../../data/useApplications';
import { Button, IconButton } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Input, Textarea } from '../../ui/fields';
import { Dialog } from '../../ui/Panel';
import { ThemeToggle } from '../../app/ThemeToggle';
import { calendarVars } from '../../lib/calendarColors';
import { cx } from '../../lib/cx';
import { formatTime } from '../../lib/dates';
import { usePlanSources, useNowText } from '../today/useTodayPlan';
import { apiFetch } from '../../api/client';

const settingsTest = () => apiFetch<void>('/popups/test', { method: 'POST' });

/** "Imported 12 new items and updated 3." */
function describeImport(summary: ImportSummary): string {
  const totals = Object.values(summary).reduce((a, c) => ({ added: a.added + c.added, updated: a.updated + c.updated }), { added: 0, updated: 0 });
  return `Imported ${totals.added} new item${totals.added === 1 ? '' : 's'} and updated ${totals.updated}.`;
}

const row = 'flex items-center justify-between gap-6 border-b border-hairline py-4';

export function SettingsDialog() {
  const { dialog, closeDialog, openDialog, reload } = useApp();
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleExport() {
    try {
      const data = await backupApi.export();
      // Build the file in the browser and "click" a temporary download link.
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `voice-todo-${data.exportedAt.slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage(`Exported ${data.tasks.length} tasks, ${data.events.length} events, and ${data.calendars.length} calendars.`);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Export failed.');
    }
  }

  async function handleImport(file: File) {
    try {
      const data: unknown = JSON.parse(await file.text());
      setMessage(describeImport(await backupApi.import(data)));
      void reload();
    } catch (err) {
      setMessage(err instanceof SyntaxError ? "That file isn't valid JSON." : err instanceof ApiError ? `Import failed: ${err.message}` : 'Import failed.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <Dialog open={dialog?.kind === 'settings'} onClose={() => closeDialog('settings')} title="Settings">
      <div className="-my-4">
        <div className={row}>
          <span className="text-body">Theme</span>
          <ThemeToggle />
        </div>

        <Popups />

        <OfferGoal />

        <Quotes />

        <Soundtracks />

        <div className={`${row} flex-wrap`}>
          <span className="text-body">Your data</span>
          <span className="flex gap-2">
            <Button variant="secondary" icon={Download} onClick={() => void handleExport()}>
              Export JSON
            </Button>
            <Button variant="secondary" icon={Upload} onClick={() => fileInput.current?.click()}>
              Import JSON
            </Button>
          </span>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
          <p className="w-full text-meta text-ink-muted">Import merges: it adds and updates, and never deletes anything.</p>
        </div>

        {message && (
          <p role="status" className="border-b border-hairline py-3 text-body text-ink">
            {message}
          </p>
        )}

        <div className="flex gap-2 py-3">
          <Button variant="ghost" onClick={() => openDialog({ kind: 'shortcuts' })}>
            Keyboard shortcuts
          </Button>
          <a href="/styleguide" className="inline-flex h-8 items-center rounded-control px-3 text-body font-medium text-ink hover:bg-accent-soft">
            Style guide
          </a>
        </div>
      </div>
    </Dialog>
  );
}

/** The internship goal: how many offers, by when. It's saved as you change it (when you leave the field, or pick a date). */
function OfferGoal() {
  const { showToast } = useApp();
  const { settings, update: save } = useAppSettings();
  const update = (changes: Parameters<typeof save>[0]) =>
    save(changes).catch(() => {
      showToast('Couldn’t save the goal. Check that the server is running.');
      setGoal(String(settings.offerGoal));
      setDate(settings.offerTargetDate);
    });
  const [goal, setGoal] = useState(String(settings.offerGoal));
  const [date, setDate] = useState(settings.offerTargetDate);
  useEffect(() => {
    setGoal(String(settings.offerGoal));
    setDate(settings.offerTargetDate);
  }, [settings.offerGoal, settings.offerTargetDate]);

  const commitGoal = () => {
    const n = Number.parseInt(goal, 10);
    if (Number.isInteger(n) && n >= 1 && n <= 1000) {
      if (n !== settings.offerGoal) void update({ offerGoal: n });
    } else setGoal(String(settings.offerGoal)); // not a usable number: put the old one back
  };

  return (
    <div className={`${row} flex-wrap`}>
      <span>
        <span className="block text-body">Internship goal</span>
        <span className="block text-meta text-ink-muted">Shown as a progress bar on the Applications page.</span>
      </span>
      <span className="flex items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-label text-ink-muted uppercase">Offers</span>
          <Input type="number" inputMode="numeric" min={1} max={1000} value={goal} className="w-20" onChange={(e) => setGoal(e.target.value)} onBlur={commitGoal} onKeyDown={(e) => e.key === 'Enter' && commitGoal()} />
        </label>
        <label className="block">
          <span className="mb-1 block text-label text-ink-muted uppercase">By</span>
          <Input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              if (e.target.value && e.target.value !== settings.offerTargetDate) void update({ offerTargetDate: e.target.value });
            }}
          />
        </label>
      </span>
    </div>
  );
}

/** The morning quotes, one per line as "quote — who said it". Saved with Save; a line with no author is pointed out, never guessed. */
function Quotes() {
  const { showToast } = useApp();
  const { settings, update } = useAppSettings();
  const [text, setText] = useState(() => quotesToText(settings.quotes));
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => setText(quotesToText(settings.quotes)), [settings.quotes]);

  async function save() {
    const { quotes, problems } = parseQuotes(text);
    if (problems.length > 0) return setProblem(`Line ${problems.join(', ')} needs “ — ” and then who said it.`);
    const previous = settings.quotes;
    try {
      await update({ quotes });
      setProblem(null);
      showToast(`Saved ${quotes.length} quotes`, () => void update({ quotes: previous }));
    } catch {
      setProblem('Couldn’t save the quotes. Check that the server is running.');
    }
  }

  return (
    <div className={`${row} flex-col items-stretch gap-2`}>
      <span>
        <span className="block text-body">Morning quotes</span>
        <span className="block text-meta text-ink-muted">One a day on the morning view. One per line: the quote, then “ — ” and who said it.</span>
      </span>
      <Textarea aria-label="Morning quotes" aria-invalid={problem ? true : undefined} value={text} onChange={(e) => setText(e.target.value)} className="min-h-40 text-meta" />
      {problem && <p role="alert" className="text-meta text-danger">{problem}</p>}
      <span>
        <Button variant="secondary" onClick={() => void save()} disabled={text === quotesToText(settings.quotes)}>
          Save quotes
        </Button>
      </span>
    </div>
  );
}

/** Pop-ups (sent by the server as Mac notifications): on or off, the heads-up, which categories, a pause, a test, and today's count. */
function Popups() {
  const { showToast, calendars } = useApp();
  const { settings, update } = useAppSettings();
  const p = settings.popups;
  const now = useNowText();
  const { src } = usePlanSources();
  const [minutes, setMinutes] = useState(String(p.headsUpMinutes));
  useEffect(() => setMinutes(String(p.headsUpMinutes)), [p.headsUpMinutes]);
  const save = (changes: Partial<typeof p>, message?: string) =>
    update({ popups: changes })
      .then(() => message && showToast(message, () => void update({ popups: Object.fromEntries(Object.keys(changes).map((k) => [k, p[k as keyof typeof p]])) })))
      .catch(() => showToast('Couldn’t save that. Check that the server is running.'));
  const paused = p.pausedUntil !== null && p.pausedUntil > now;
  const left = popupsForDay(src, now.slice(0, 10), p).filter((x) => x.at >= now);

  async function test() {
    try {
      await settingsTest();
      showToast('Sent a test pop-up. If nothing appeared, allow notifications for “terminal-notifier” in System Settings → Notifications.');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Couldn’t send a test pop-up.');
    }
  }

  return (
    <div className={`${row} flex-col items-stretch gap-3`}>
      <label className="flex cursor-pointer items-center justify-between gap-6">
        <span>
          <span className="block text-body">Pop-ups</span>
          <span className="block text-meta text-ink-muted">Mac notifications when blocks start and end, before classes and events, at due times and at bedtime. Sent by the always-on app.</span>
        </span>
        <Checkbox checked={p.enabled} onChange={(e) => void save({ enabled: e.target.checked }, e.target.checked ? 'Pop-ups on' : 'Pop-ups off')} label="Pop-ups" />
      </label>
      {p.enabled && (
        <>
          <p className="text-meta text-ink-muted">
            {paused ? `Paused until ${formatTime(timePart(p.pausedUntil!))}. ` : ''}
            {left.length === 0 ? 'No more pop-ups today.' : `${left.length} more today; next at ${formatTime(timePart(left[0]!.at))}: “${left[0]!.title}”`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {paused ? (
              <Button variant="secondary" onClick={() => void save({ pausedUntil: null }, 'Pop-ups resumed')}>
                Resume
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => void save({ pausedUntil: addMinutes(now, 60) }, 'Pop-ups paused for an hour')}>
                Pause for 1 hour
              </Button>
            )}
            <Button variant="ghost" onClick={() => void test()}>
              Send a test pop-up
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-body">
              Heads-up
              <Input
                type="number"
                min={0}
                max={120}
                value={minutes}
                className="w-16"
                onChange={(e) => setMinutes(e.target.value)}
                onBlur={() => {
                  const n = Number.parseInt(minutes, 10);
                  if (Number.isInteger(n) && n >= 0 && n <= 120 && n !== p.headsUpMinutes) void save({ headsUpMinutes: n });
                  else setMinutes(String(p.headsUpMinutes));
                }}
              />
              min before classes and events
            </label>
            <label className="flex cursor-pointer items-center gap-1 text-body">
              <Checkbox checked={p.focusWarning} onChange={(e) => void save({ focusWarning: e.target.checked })} label="5 minutes left on focus blocks" />
              5 minutes left on focus blocks
            </label>
            <label className="flex cursor-pointer items-center gap-1 text-body">
              <Checkbox checked={p.bedtime} onChange={(e) => void save({ bedtime: e.target.checked })} label="Bedtime" />
              Bedtime
            </label>
          </div>
          <div>
            <span className="mb-1.5 block text-label text-ink-muted uppercase">Pop-ups for</span>
            <div className="flex flex-wrap gap-1.5">
              {calendars.map((c) => {
                const on = !p.mutedCalendarIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => void save({ mutedCalendarIds: on ? [...p.mutedCalendarIds, c.id] : p.mutedCalendarIds.filter((id) => id !== c.id) })}
                    style={calendarVars(c.color)}
                    className={cx('inline-flex h-7 items-center gap-1.5 rounded-control border px-2 text-meta transition-colors duration-150', on ? 'border-rule text-ink' : 'border-hairline text-ink-faint line-through')}
                  >
                    <span aria-hidden className="size-2 bg-(color:--c)" />
                    {c.name}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-meta text-ink-muted">Each block can also turn its own pop-ups off on the Week page.</p>
          </div>
        </>
      )}
    </div>
  );
}

/** Soundtracks for focus blocks: a name, a link (opens in a new tab) and/or a folder of audio files on this Mac. Nothing loads until you press play. */
function Soundtracks() {
  const { showToast } = useApp();
  const { settings, update } = useAppSettings();
  const [rows, setRows] = useState<Soundtrack[]>(settings.soundtracks);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => setRows(settings.soundtracks), [settings.soundtracks]);
  const set = (i: number, changes: Partial<Soundtrack>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...changes } : x)));

  async function save() {
    const clean = rows.map((r) => ({ name: r.name.trim(), link: r.link?.trim() || null, folder: r.folder?.trim() || null }));
    const bad = clean.findIndex((r) => !SoundtrackSchema.safeParse(r).success);
    if (bad >= 0) return setProblem(`Row ${bad + 1}: give it a name, and a link starting with http:// or https:// (or leave the link empty).`);
    const previous = settings.soundtracks;
    try {
      await update({ soundtracks: clean });
      setProblem(null);
      showToast('Saved the soundtracks', () => void update({ soundtracks: previous }));
    } catch {
      setProblem('Couldn’t save. Check that the server is running.');
    }
  }

  return (
    <div className={`${row} flex-col items-stretch gap-2`}>
      <span>
        <span className="block text-body">Soundtracks</span>
        <span className="block text-meta text-ink-muted">For focus blocks. A link opens in a new tab; a folder (like ~/Music/Lofi) plays right in the app. Nothing loads until you press play.</span>
      </span>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="grid grid-cols-[6rem_1fr_1fr_auto] gap-2 max-sm:grid-cols-[1fr_auto]">
            <Input aria-label="Name" value={r.name} maxLength={40} onChange={(e) => set(i, { name: e.target.value })} />
            <Input aria-label={`${r.name} link`} placeholder="Link (https://…)" value={r.link ?? ''} onChange={(e) => set(i, { link: e.target.value })} className="max-sm:col-span-2 max-sm:row-start-2" />
            <Input aria-label={`${r.name} folder`} placeholder="Folder (~/Music/Lofi)" value={r.folder ?? ''} onChange={(e) => set(i, { folder: e.target.value })} className="max-sm:col-span-2 max-sm:row-start-3" />
            <IconButton icon={X} label={`Remove ${r.name}`} onClick={() => setRows((x) => x.filter((_, j) => j !== i))} />
          </li>
        ))}
      </ul>
      {problem && <p role="alert" className="text-meta text-danger">{problem}</p>}
      <span className="flex gap-2">
        <Button variant="ghost" icon={Plus} onClick={() => setRows((x) => [...x, { name: 'new', link: null, folder: null }])}>
          Add one
        </Button>
        <Button variant="secondary" onClick={() => void save()} disabled={JSON.stringify(rows) === JSON.stringify(settings.soundtracks)}>
          Save soundtracks
        </Button>
      </span>
    </div>
  );
}
