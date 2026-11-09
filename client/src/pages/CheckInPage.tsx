import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { addDays, LocalDateSchema, minutesBetween, planDay, planningDate, timePart, CHECK_IN_STATUSES, type CheckIn, type CheckInStatus, type PlanItem, type Task } from '@todo/shared';
import { useApp } from '../app/AppContext';
import { checkInsApi } from '../api/entities';
import { checkInHooks } from '../data/useCheckIns';
import { keys } from '../data/queryClient';
import { formatTimeRange } from '../features/calendar/format';
import { useNowText, usePlanSources } from '../features/today/useTodayPlan';
import { cx } from '../lib/cx';
import { formatTime, fullDate, toLocalISODate } from '../lib/dates';
import { Button } from '../ui/Button';
import { Input, SectionLabel } from '../ui/fields';
import { SkeletonRows } from '../ui/states';

const LABEL: Record<CheckInStatus, string> = { done: 'Done', part: 'Part', skipped: 'Skipped' };

/** One row per planned thing (a block cut into pieces counts once). */
interface Row {
  key: string;
  item: PlanItem;
  minutes: number;
}

/** Close the day: Done, Part or Skipped for each planned item, which one happened when there was a choice, a line for the learning log, missed to-dos, and tomorrow's start. Every tap saves. */
export default function CheckInPage() {
  const { calendarsById, showToast } = useApp();
  const { src, routine } = usePlanSources();
  const now = useNowText();
  const asked = useSearchParams()[0].get('date');
  const date = asked && LocalDateSchema.safeParse(asked).success ? asked : planningDate(src.templates, now);
  const checkIns = checkInHooks.useList();
  const create = checkInHooks.useCreate();
  const update = checkInHooks.useUpdate();
  const remove = checkInHooks.useDelete();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const item of planDay(src, date).items.filter((i) => i.kind !== 'open')) {
      const key = item.key.replace(/#\d+$/, '');
      const same = out.find((r) => r.key === key);
      if (same) same.minutes += minutesBetween(item.start, item.end);
      else out.push({ key, item, minutes: minutesBetween(item.start, item.end) });
    }
    return out;
  }, [src, date]);
  const tomorrow = useMemo(() => planDay(src, addDays(date, 1)).items.filter((i) => i.kind !== 'open').slice(0, 3), [src, date]);
  // Missed rolling to-dos are hidden from every list, so read them from the raw cache.
  const missed = (qc.getQueryData<Task[]>(keys.tasks) ?? []).filter((t) => t.missedAt && toLocalISODate(new Date(t.missedAt)) > addDays(date, -7) && toLocalISODate(new Date(t.missedAt)) <= date);

  const mine = (key: string): CheckIn | undefined => checkIns.data?.find((c) => c.date === date && c.itemKey === key);
  const fail = () => showToast('Couldn’t save that. Check that the server is running.');

  function mark(row: Row, status: CheckInStatus) {
    const existing = mine(row.key);
    // Tapping the chosen answer again clears it: unmarked counts as unknown, not skipped.
    if (existing?.status === status) return remove.mutate(existing.id, { onError: fail });
    if (existing) return update.mutate({ id: existing.id, changes: { status } }, { onError: fail });
    create.mutate({ date, itemKey: row.key, title: row.item.title, calendarId: row.item.calendarId, minutes: row.minutes, status, usedAlt: false, learned: null }, { onError: fail });
  }
  const change = (row: Row, changes: { usedAlt?: boolean; learned?: string | null }) => {
    const existing = mine(row.key);
    if (existing) update.mutate({ id: existing.id, changes }, { onError: fail });
    else create.mutate({ date, itemKey: row.key, title: row.item.title, calendarId: row.item.calendarId, minutes: row.minutes, status: 'done', usedAlt: false, learned: null, ...changes }, { onError: fail });
  };

  /** The fast path: everything not marked yet becomes Done in one tap (then fix the exceptions); Undo takes them back. */
  async function markRestDone() {
    const rest = rows.filter((r) => !mine(r.key));
    try {
      const made = await Promise.all(rest.map((r) => checkInsApi.create({ id: crypto.randomUUID(), date, itemKey: r.key, title: r.item.title, calendarId: r.item.calendarId, minutes: r.minutes, status: 'done', usedAlt: false, learned: null })));
      await qc.invalidateQueries({ queryKey: checkInHooks.key });
      showToast(`Marked ${made.length} done`, () => void Promise.all(made.map((c) => checkInsApi.remove(c.id))).then(() => qc.invalidateQueries({ queryKey: checkInHooks.key })));
    } catch {
      fail();
    }
  }

  if (checkIns.isPending || routine.loading) return <SkeletonRows count={6} />;
  const marked = rows.filter((r) => mine(r.key)).length;

  return (
    <div className="max-w-[760px]">
      <h1 className="font-display text-page">Close the day</h1>
      <p className="mb-6 font-display text-section text-ink-muted">{fullDate(date)}</p>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-meta text-ink-muted">
          <span className="font-mono text-ink">{marked}</span> of <span className="font-mono">{rows.length}</span> marked. Tap again to clear; anything unmarked stays unknown.
        </p>
        {marked < rows.length && (
          <Button variant="secondary" onClick={() => void markRestDone()}>
            Mark the rest done
          </Button>
        )}
      </div>

      <ul className="divide-y divide-hairline border-y border-hairline">
        {rows.map((row) => {
          const c = mine(row.key);
          const category = row.item.calendarId ? calendarsById.get(row.item.calendarId)?.name : null;
          return (
            <li key={row.key} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <p className="min-w-0 text-body">
                  <span className="font-medium">{row.item.title}</span>
                  <span className="text-meta text-ink-muted">
                    {' '}· <span className="font-mono">{formatTimeRange(timePart(row.item.start), timePart(row.item.end))}</span>
                    {category && ` · ${category}`}
                  </span>
                </p>
                <div role="radiogroup" aria-label={`How did ${row.item.title} go?`} className="inline-flex h-8 overflow-hidden rounded-control border border-rule">
                  {CHECK_IN_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={c?.status === s}
                      onClick={() => mark(row, s)}
                      className={cx('min-w-16 border-l border-rule px-2.5 text-body font-medium transition-colors duration-150 first:border-l-0', c?.status === s ? 'bg-ink text-paper' : 'text-ink hover:bg-accent-soft')}
                    >
                      {LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>
              {row.item.altTitle && c && c.status !== 'skipped' && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-meta">
                  <span className="text-ink-muted">Which one?</span>
                  {[false, true].map((alt) => (
                    <button key={String(alt)} type="button" aria-pressed={c.usedAlt === alt} onClick={() => change(row, { usedAlt: alt })} className={cx('h-7 rounded-control border px-2', c.usedAlt === alt ? 'border-ink bg-ink text-paper' : 'border-rule text-ink')}>
                      {alt ? row.item.altTitle : row.item.title}
                    </button>
                  ))}
                </div>
              )}
              {row.item.focus && c && c.status !== 'skipped' && (
                <Input
                  aria-label={`What I learned in ${row.item.title}`}
                  placeholder="What I learned (optional, one line)"
                  defaultValue={c.learned ?? ''}
                  maxLength={300}
                  className="mt-2"
                  onBlur={(e) => {
                    const learned = e.target.value.trim() || null;
                    if (learned !== c.learned) change(row, { learned });
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                />
              )}
            </li>
          );
        })}
      </ul>

      {missed.length > 0 && (
        <section className="mt-8">
          <SectionLabel count={missed.length} className="mb-2">
            Missed this week
          </SectionLabel>
          <ul className="space-y-1 text-body">
            {missed.map((t) => (
              <li key={t.id}>
                {t.title} <span className="text-meta text-ink-muted">· rolled over to the next one</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <SectionLabel className="mb-2">Tomorrow starts with</SectionLabel>
        <ol className="space-y-1 text-body">
          {tomorrow.map((i) => (
            <li key={i.key}>
              <span className="font-mono text-meta text-ink-muted">{formatTime(timePart(i.start))}</span> {i.title}
            </li>
          ))}
          {tomorrow.length === 0 && <li className="text-ink-muted">Nothing planned yet.</li>}
        </ol>
      </section>

      <div className="mt-8">
        <Button variant="primary" onClick={() => navigate('/')}>
          Done for today
        </Button>
      </div>
    </div>
  );
}
