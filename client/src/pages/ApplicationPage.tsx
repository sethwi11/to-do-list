import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { CalendarPlus, ChevronLeft, ExternalLink, ListPlus, Mail, MapPin, Pencil } from 'lucide-react';
import { addDays, APPLICATION_STATUSES, appliedDate, expandOccurrences, followUpSuggestions, INTERVIEW_EVENT_TYPE, localDateOf, type ApplicationStatus } from '@todo/shared';
import { useApp } from '../app/AppContext';
import { PageHeader } from '../app/PageHeader';
import { ago, hostOf, longDate } from '../features/applications/format';
import { StatusTimeline } from '../features/applications/StatusTimeline';
import { newEventSpan, toEventItem, type CalendarItem } from '../features/calendar/calendarModel';
import { formatWhen } from '../features/calendar/format';
import { ItemDetail } from '../features/calendar/ItemDetail';
import { AttachmentList } from '../features/files/AttachmentList';
import { CompletedSection, TaskList } from '../features/tasks/TaskList';
import { sortByCompletedDesc, sortTasks } from '../lib/filters';
import { Markdown } from '../lib/markdown';
import { Button } from '../ui/Button';
import { SectionLabel, Select } from '../ui/fields';
import { anchorOf, type PopoverAnchor } from '../ui/Popover';
import { EmptyState } from '../ui/states';

const PAST_EVENTS_SHOWN = 5;

/** One application: everything you know about it, where it's been, the interviews and to-dos tied to it, its files and notes. */
export default function ApplicationPage() {
  const { id } = useParams();
  const app = useApp();
  const { applications, applicationsLoading, events, eventTypes, tasks, calendars, calendarsById, today, openDialog } = app;
  const application = applications.find((a) => a.id === id);
  const [detail, setDetail] = useState<{ item: CalendarItem; anchor: PopoverAnchor } | null>(null);

  const appsCalendar = calendars.find((c) => c.name.toLowerCase() === 'applications');
  const interviewTypeId = eventTypes.find((t) => t.name.toLowerCase() === INTERVIEW_EVENT_TYPE.toLowerCase())?.id ?? null;

  const { upcoming, past } = useMemo(() => {
    const mine = events.filter((e) => e.applicationId === id);
    const all = expandOccurrences(mine, addDays(today, -730), addDays(today, 730));
    return {
      upcoming: all.filter((o) => o.end.slice(0, 10) >= today),
      past: all.filter((o) => o.end.slice(0, 10) < today).reverse().slice(0, PAST_EVENTS_SHOWN),
    };
  }, [events, id, today]);
  const { open, done } = useMemo(() => {
    const mine = tasks.filter((t) => t.applicationId === id);
    return { open: sortTasks(mine.filter((t) => t.status === 'todo'), 'due'), done: sortByCompletedDesc(mine.filter((t) => t.status === 'done')) };
  }, [tasks, id]);
  const suggestion = useMemo(() => (application ? followUpSuggestions([application], today)[0] : undefined), [application, today]);

  if (applicationsLoading) return null;
  if (!application) {
    return (
      <div className="max-w-[960px]">
        <h1 className="mb-6 font-display text-page">Application not found</h1>
        <EmptyState message="That application doesn’t exist (it may have been deleted).">
          <Link to="/applications" className="inline-flex h-8 items-center rounded-control px-3 text-body font-medium text-ink hover:bg-accent-soft">
            Back to Applications
          </Link>
        </EmptyState>
      </div>
    );
  }

  const applied = appliedDate(application);
  const addInterview = () =>
    openDialog({
      kind: 'event',
      mode: 'new',
      defaults: { ...newEventSpan(null, new Date()), title: `${application.company} interview`, typeId: interviewTypeId, applicationId: application.id, calendarId: appsCalendar?.id ?? null },
    });

  return (
    <div className="max-w-[960px]">
      <Link to="/applications" className="mb-3 inline-flex items-center gap-1 text-meta text-ink-muted hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden />
        Applications
      </Link>

      <PageHeader title={application.company} subtitle={application.role} quickAddDefaults={{ applicationId: application.id, calendarId: appsCalendar?.id ?? null }} />

      <div className="mb-8 flex flex-wrap items-center gap-2">
        <Select aria-label="Status" value={application.status} onChange={(e) => void app.moveApplication(application, e.target.value as ApplicationStatus, null)} wrapperClassName="w-48">
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Button variant="secondary" icon={Pencil} onClick={() => openDialog({ kind: 'application', id: application.id })}>
          Edit
        </Button>
        <Button variant="secondary" icon={CalendarPlus} onClick={addInterview}>
          Add interview
        </Button>
        <Button variant="secondary" icon={ListPlus} onClick={() => openDialog({ kind: 'task', mode: 'new', defaults: { applicationId: application.id, calendarId: appsCalendar?.id ?? null } })}>
          Add to-do
        </Button>
      </div>

      {suggestion && (
        <section aria-label="Time to follow up" className="mb-8 border-l-[3px] border-accent bg-accent-soft px-4 py-3">
          <p className="text-body font-medium">Time to follow up?</p>
          <p className="mb-2 text-body text-ink-muted">
            You applied {ago(suggestion.days)} and there’s been no change since.
          </p>
          <span className="flex gap-1">
            <Button variant="secondary" onClick={() => void app.answerFollowUp(application, 'accept')}>
              Add follow-up to-do
            </Button>
            <Button variant="ghost" onClick={() => void app.answerFollowUp(application, 'dismiss')}>
              Dismiss
            </Button>
          </span>
        </section>
      )}

      <section aria-label="Details" className="mb-10">
        <SectionLabel className="mb-3">Details</SectionLabel>
        <dl className="grid grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-2">
          <Detail label="Applied">{applied ? longDate(applied) : 'Not yet'}</Detail>
          <Detail label="Deadline">{application.deadline ? longDate(application.deadline) : '–'}</Detail>
          <Detail label="Location">
            {application.location ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4 text-ink-muted" aria-hidden />
                {application.location}
              </span>
            ) : (
              '–'
            )}
          </Detail>
          <Detail label="Job posting">
            {application.jobLink ? (
              <a href={application.jobLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-accent-ink underline underline-offset-2">
                <ExternalLink className="size-4" aria-hidden />
                {hostOf(application.jobLink)}
              </a>
            ) : (
              '–'
            )}
          </Detail>
          <Detail label="Contact">
            {application.contactName || application.contactEmail ? (
              <span className="inline-flex flex-wrap items-center gap-x-3">
                {application.contactName}
                {application.contactEmail && (
                  <a href={`mailto:${application.contactEmail}`} className="inline-flex items-center gap-1.5 text-accent-ink underline underline-offset-2">
                    <Mail className="size-4" aria-hidden />
                    {application.contactEmail}
                  </a>
                )}
              </span>
            ) : (
              '–'
            )}
          </Detail>
          <Detail label="Added">{longDate(localDateOf(application.createdAt))}</Detail>
        </dl>
      </section>

      <section aria-label="Status timeline" className="mb-10">
        <SectionLabel className="mb-3">Timeline</SectionLabel>
        <StatusTimeline application={application} today={today} />
      </section>

      <section aria-label="Interviews and dates" className="mb-10">
        <SectionLabel count={upcoming.length} className="mb-2">
          Interviews and dates
        </SectionLabel>
        {upcoming.length === 0 ? (
          <EmptyState message="Nothing scheduled." className="py-4">
            <Button variant="ghost" onClick={addInterview}>
              Add an interview
            </Button>
          </EmptyState>
        ) : (
          <EventList items={upcoming} onOpen={(item, anchor) => setDetail({ item: toEventItem(item, calendarsById), anchor })} />
        )}
        {past.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-1 text-label text-ink-muted uppercase">Earlier</h3>
            <EventList items={past} muted onOpen={(item, anchor) => setDetail({ item: toEventItem(item, calendarsById), anchor })} />
          </div>
        )}
      </section>

      <section aria-label="To-dos" className="mb-10">
        <SectionLabel count={open.length} className="mb-2">
          To-dos
        </SectionLabel>
        {open.length > 0 ? (
          <TaskList tasks={open} label={`To-dos for ${application.company}`} leaveOnComplete />
        ) : (
          <EmptyState message="Nothing to do for this application." className="py-4">
            <Button variant="ghost" onClick={() => openDialog({ kind: 'task', mode: 'new', defaults: { applicationId: application.id, calendarId: appsCalendar?.id ?? null } })}>
              Add a to-do
            </Button>
          </EmptyState>
        )}
        <CompletedSection tasks={done} />
      </section>

      <section aria-label="Files" className="mb-10">
        <SectionLabel className="mb-2">Files</SectionLabel>
        <p className="mb-2 text-meta text-ink-muted">The resume you sent, an offer letter, the job description.</p>
        <AttachmentList owner={{ ownerType: 'application', ownerId: application.id }} editable />
      </section>

      <section aria-label="Notes">
        <SectionLabel className="mb-2">Notes</SectionLabel>
        {application.notes ? (
          <Markdown source={application.notes} className="max-w-[68ch]" />
        ) : (
          <p className="text-body text-ink-muted">
            No notes yet.{' '}
            <button type="button" className="text-accent-ink underline underline-offset-2" onClick={() => openDialog({ kind: 'application', id: application.id })}>
              Add some
            </button>
            .
          </p>
        )}
      </section>

      {detail && <ItemDetail item={detail.item} anchor={detail.anchor} onClose={() => setDetail(null)} />}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-label text-ink-muted uppercase">{label}</dt>
      <dd className="text-body break-words">{children}</dd>
    </div>
  );
}

function EventList({ items, muted = false, onOpen }: { items: ReturnType<typeof expandOccurrences>; muted?: boolean; onOpen: (o: ReturnType<typeof expandOccurrences>[number], anchor: PopoverAnchor) => void }) {
  return (
    <ul>
      {items.map((o) => (
        <li key={o.key} className="border-b border-hairline">
          <button type="button" onClick={(e) => onOpen(o, anchorOf(e.currentTarget))} className="flex min-h-11 w-full items-center gap-4 py-2 text-left hover:bg-surface">
            <span className="w-60 shrink-0 font-mono text-meta text-ink-muted">{formatWhen(o.start, o.end, o.allDay)}</span>
            <span className={muted ? 'min-w-0 truncate text-body text-ink-muted' : 'min-w-0 truncate text-body'}>{o.event.title}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
