import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { Columns3, Plus, Table2 } from 'lucide-react';
import { APPLICATION_STATUSES, filterApplications, followUpSuggestions, sortApplications, type ApplicationSortKey, type ApplicationStatus, type SortDirection } from '@todo/shared';
import { useApp } from '../app/AppContext';
import { PageHeader } from '../app/PageHeader';
import { ApplicationTable } from '../features/applications/ApplicationTable';
import { Board } from '../features/applications/Board';
import { FollowUps } from '../features/applications/FollowUps';
import { GoalPanel } from '../features/applications/GoalPanel';
import { useAppSettings } from '../data/useApplications';
import { cx } from '../lib/cx';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/fields';
import { EmptyState, SkeletonRows } from '../ui/states';

type View = 'board' | 'table';
const SORT_KEYS: readonly ApplicationSortKey[] = ['company', 'role', 'status', 'dateApplied', 'deadline', 'updated'];
/** The first click on a heading: names A to Z, but the newest and the soonest first for dates. */
const FIRST_DIRECTION: Record<ApplicationSortKey, SortDirection> = { company: 'asc', role: 'asc', status: 'asc', dateApplied: 'desc', deadline: 'asc', updated: 'desc' };

/** A phone shows the table (dragging a card through seven columns is not a phone gesture); everything else shows the board. */
const defaultView = (): View => (typeof matchMedia === 'function' && matchMedia('(max-width: 639px)').matches ? 'table' : 'board');

/** The internship tracker: your goal and numbers on top, anything that needs a follow-up, then every application as a board (drag between columns) or a table (sort and filter). */
export default function ApplicationsPage() {
  const app = useApp();
  const { applications, applicationsLoading, calendars, today, openDialog } = app;
  const { settings } = useAppSettings();
  const [params, setParams] = useSearchParams();

  const view: View = params.get('view') === 'table' ? 'table' : params.get('view') === 'board' ? 'board' : defaultView();
  const status = APPLICATION_STATUSES.find((s) => s === params.get('status')) ?? null;
  const query = params.get('q') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const sortParam = params.get('sort');
  const sort: ApplicationSortKey = SORT_KEYS.find((k) => k === sortParam) ?? 'updated';
  const direction: SortDirection = params.get('dir') === 'asc' ? 'asc' : params.get('dir') === 'desc' ? 'desc' : FIRST_DIRECTION[sort];
  const filtering = status !== null || query !== '' || from !== '' || to !== '';

  /** Change some of what's in the address (null removes it). Typing in a filter replaces the entry instead of piling up history. */
  const setView = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(patch)) {
          if (value === null || value === '') next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );

  const appsCalendar = calendars.find((c) => c.name.toLowerCase() === 'applications');
  const suggestions = useMemo(() => followUpSuggestions(applications, today), [applications, today]);
  const followUpIds = useMemo(() => new Set(suggestions.map((s) => s.application.id)), [suggestions]);
  const rows = useMemo(
    () => sortApplications(filterApplications(applications, { status, query, appliedFrom: from || undefined, appliedTo: to || undefined }), sort, direction),
    [applications, status, query, from, to, sort, direction],
  );

  const clickHeading = (key: ApplicationSortKey) => setView(key === sort ? { dir: direction === 'asc' ? 'desc' : 'asc' } : { sort: key, dir: FIRST_DIRECTION[key] });

  return (
    <div className="max-w-[1200px]">
      <PageHeader title="Applications" />

      {applicationsLoading ? (
        <SkeletonRows count={5} />
      ) : (
        <>
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <div role="group" aria-label="View" className="inline-flex overflow-hidden rounded-control border border-rule">
              {(
                [
                  ['board', 'Board', Columns3],
                  ['table', 'Table', Table2],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={view === id}
                  onClick={() => setView({ view: id })}
                  className={cx('inline-flex h-8 items-center gap-2 px-3 text-body transition-colors duration-150 ease-out', view === id ? 'bg-ink text-paper' : 'text-ink hover:bg-accent-soft')}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
            <Button variant="primary" icon={Plus} className="sm:ml-auto" onClick={() => openDialog({ kind: 'application', id: 'new' })}>
              New application
            </Button>
          </div>

          <GoalPanel applications={applications} goal={settings.offerGoal} targetDate={settings.offerTargetDate} today={today} onEditGoal={() => openDialog({ kind: 'settings' })} />
          <FollowUps suggestions={suggestions} onAnswer={(a, answer) => void app.answerFollowUp(a, answer)} />

          {applications.length === 0 ? (
            <EmptyState message="No applications yet. Add the first one you’re thinking about.">
              <Button variant="primary" icon={Plus} onClick={() => openDialog({ kind: 'application', id: 'new' })}>
                New application
              </Button>
            </EmptyState>
          ) : view === 'board' ? (
            <Board applications={applications} color={appsCalendar?.color ?? 'tomato'} calendarName={appsCalendar?.name} followUpIds={followUpIds} onMove={(a, s, before) => void app.moveApplication(a, s, before)} />
          ) : (
            <>
              <div role="search" aria-label="Filter applications" className="mb-4 flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="mb-1 block text-label text-ink-muted uppercase">Status</span>
                  <Select aria-label="Status" value={status ?? ''} onChange={(e) => setView({ status: e.target.value })} wrapperClassName="w-48">
                    <option value="">All statuses</option>
                    {APPLICATION_STATUSES.map((s: ApplicationStatus) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="block min-w-48 flex-1 sm:max-w-72">
                  <span className="mb-1 block text-label text-ink-muted uppercase">Company or role</span>
                  <Input type="search" value={query} placeholder="Search" onChange={(e) => setView({ q: e.target.value })} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-label text-ink-muted uppercase">Applied from</span>
                  <Input type="date" value={from} max={to || undefined} onChange={(e) => setView({ from: e.target.value })} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-label text-ink-muted uppercase">to</span>
                  <Input type="date" value={to} min={from || undefined} onChange={(e) => setView({ to: e.target.value })} />
                </label>
                {filtering && (
                  <Button variant="ghost" onClick={() => setView({ status: null, q: null, from: null, to: null })}>
                    Clear filters
                  </Button>
                )}
              </div>
              {filtering && (
                <p className="mb-2 text-meta text-ink-muted" aria-live="polite">
                  Showing {rows.length} of {applications.length}
                </p>
              )}
              <ApplicationTable
                applications={rows}
                today={today}
                sort={sort}
                direction={direction}
                onSort={clickHeading}
                onStatus={(a, s) => void app.moveApplication(a, s, null)}
                empty="Nothing matches those filters."
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
