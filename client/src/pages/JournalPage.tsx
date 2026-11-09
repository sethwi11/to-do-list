import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { LocalDateSchema } from '@todo/shared';
import { useApp } from '../app/AppContext';
import { PageHeader } from '../app/PageHeader';
import { journalHooks } from '../data/useJournal';
import { JournalCalendar } from '../features/journal/JournalCalendar';
import { JournalEditor } from '../features/journal/JournalEditor';
import { fullDate } from '../lib/dates';
import { SkeletonRows } from '../ui/states';

/** The journal: write about a day and score it, and click any day on the calendar to read what you wrote. */
export default function JournalPage() {
  const { today } = useApp();
  const [params, setParams] = useSearchParams();
  const asked = params.get('date');
  // A day that hasn't happened yet can't be written about.
  const date = asked && LocalDateSchema.safeParse(asked).success && asked <= today ? asked : today;
  const list = journalHooks.useList();
  const entries = useMemo(() => new Map((list.data ?? []).map((e) => [e.date, e])), [list.data]);
  const [month, setMonth] = useState({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) });
  // Picking a day in another month (or following a link to one) shows that month.
  useEffect(() => setMonth({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) }), [date]);

  return (
    <div className="max-w-[1000px]">
      <PageHeader title="Journal" subtitle="How the day went" />
      {list.isPending ? (
        <SkeletonRows count={6} />
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section aria-label="The day">
            <h2 className="mb-3 font-display text-section">{date === today ? 'Today' : fullDate(date)}{date === today && <span className="ml-3 font-body text-meta text-ink-muted">{fullDate(date)}</span>}</h2>
            {/* Keyed by day, so each day starts from what it has saved and saves what's pending when you leave it. */}
            <JournalEditor key={date} date={date} entry={entries.get(date)} />
          </section>
          <JournalCalendar month={month} onMonth={setMonth} entries={entries} selected={date} today={today} onSelect={(d) => setParams(d === today ? {} : { date: d })} />
        </div>
      )}
    </div>
  );
}
