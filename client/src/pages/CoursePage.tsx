import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ChevronLeft, FileUp, MapPin, Pencil, RotateCw, UserRound } from 'lucide-react';
import { addDays, CLASS_SOURCE, cancelledMeetings, classTitle, expandOccurrences, findClassSeries, timePart, type EventOccurrence } from '@todo/shared';
import { useApp } from '../app/AppContext';
import { PageHeader } from '../app/PageHeader';
import { toEventItem, type CalendarItem } from '../features/calendar/calendarModel';
import { formatTimeRange, formatWhen } from '../features/calendar/format';
import { ItemDetail } from '../features/calendar/ItemDetail';
import { describeMeetingDays } from '../features/courses/courseModel';
import { AttachmentList } from '../features/attachments/AttachmentList';
import { CompletedSection, TaskList } from '../features/tasks/TaskList';
import { calendarVars } from '../lib/calendarColors';
import { plainDate } from '../lib/dates';
import { sortByCompletedDesc, sortTasks } from '../lib/filters';
import { Button } from '../ui/Button';
import { SectionLabel } from '../ui/fields';
import type { PopoverAnchor } from '../ui/Popover';
import { anchorOf } from '../ui/Popover';
import { EmptyState } from '../ui/states';

const UPCOMING_MEETINGS = 6;


/** One course: its next classes (each can be cancelled or moved), its to-dos and other dates, its files, and its notes. */
export default function CoursePage() {
  const { id } = useParams();
  const app = useApp();
  const { courses, semesters, events, tasks, calendarsById, today, coursesLoading, openDialog } = app;
  const course = courses.find((c) => c.id === id);
  const semester = semesters.find((s) => s.id === course?.semesterId);
  const [detail, setDetail] = useState<{ item: CalendarItem; anchor: PopoverAnchor } | null>(null);

  const classEvents = useMemo(() => events.filter((e) => e.courseId === id && e.source === CLASS_SOURCE), [events, id]);
  const series = useMemo(() => (id ? findClassSeries(classEvents, id) : undefined), [classEvents, id]);
  const meetings = useMemo(() => expandOccurrences(classEvents, today, addDays(today, 200)).slice(0, UPCOMING_MEETINGS), [classEvents, today]);
  const cancelled = useMemo(() => (series && semester ? cancelledMeetings(series, semester).filter((d) => d >= today) : []), [series, semester, today]);
  const otherDates = useMemo(
    () => expandOccurrences(events.filter((e) => e.courseId === id && e.source !== CLASS_SOURCE), today, addDays(today, 365)),
    [events, id, today],
  );
  const { open, done } = useMemo(() => {
    const mine = tasks.filter((t) => t.courseId === id);
    return { open: sortTasks(mine.filter((t) => t.status === 'todo'), 'due'), done: sortByCompletedDesc(mine.filter((t) => t.status === 'done')) };
  }, [tasks, id]);

  if (coursesLoading) return null;
  if (!course || !semester) {
    return (
      <div className="max-w-[960px]">
        <h1 className="mb-6 font-display text-page">Course not found</h1>
        <EmptyState message="That course doesn’t exist (it may have been deleted).">
          <Link to="/courses" className="inline-flex h-8 items-center rounded-control px-3 text-body font-medium text-ink hover:bg-accent-soft">
            Back to Courses
          </Link>
        </EmptyState>
      </div>
    );
  }

  const cancelMeeting = (o: EventOccurrence) =>
    void app.deleteEvent(o, { scope: 'this', message: `Cancelled the class on ${plainDate(o.start.slice(0, 10))}` });

  return (
    <div className="max-w-[960px]">
      <Link to={`/courses?semester=${semester.id}`} className="mb-3 inline-flex items-center gap-1 text-meta text-ink-muted hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden />
        {semester.name}
      </Link>

      <div style={calendarVars(course.color)}>
        <PageHeader title={classTitle(course)} />
        <p className="-mt-5 mb-6 flex flex-wrap items-center gap-x-5 gap-y-1 text-body text-ink-muted">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="size-3 bg-(color:--c)" />
            <span className="font-mono text-meta">
              {describeMeetingDays(course.meetingDays)} · {formatTimeRange(course.startTime, course.endTime)}
            </span>
          </span>
          {course.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden />
              {course.location}
            </span>
          )}
          {course.instructor && (
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="size-4" aria-hidden />
              {course.instructor}
            </span>
          )}
        </p>
      </div>

      <div className="mb-10 flex flex-wrap gap-2">
        <Button variant="secondary" icon={Pencil} onClick={() => openDialog({ kind: 'course', id: course.id })}>
          Edit course
        </Button>
        <Button variant="secondary" icon={FileUp} onClick={() => app.chooseFilesToImport({ syllabus: true, courseId: course.id })}>
          Import syllabus
        </Button>
        <Button variant="ghost" icon={RotateCw} onClick={() => void app.rebuildCourse(course)} title="Make the class meetings match this course and semester again">
          Rebuild classes
        </Button>
      </div>

      <section className="mb-10" aria-label="Upcoming classes">
        <SectionLabel className="mb-2">Upcoming classes</SectionLabel>
        {semester.archived ? (
          <p className="py-3 font-display text-title text-ink-muted italic">This semester is archived, so its classes are hidden. Restore it on the Courses page to see them.</p>
        ) : meetings.length === 0 ? (
          <EmptyState message={series ? 'No more classes this semester.' : 'No class meetings have been built for this course yet.'}>
            {!series && (
              <Button variant="secondary" onClick={() => void app.rebuildCourse(course)}>
                Build the classes
              </Button>
            )}
          </EmptyState>
        ) : (
          <ul>
            {meetings.map((o) => (
              <li key={o.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-hairline py-2.5">
                <span className="w-36 shrink-0 text-body">
                  {plainDate(o.start.slice(0, 10))}
                  {o.start.slice(0, 10) === today && <span className="ml-1.5 text-meta text-accent-ink">today</span>}
                </span>
                <span className="font-mono text-meta text-ink-muted">{formatTimeRange(timePart(o.start), timePart(o.end))}</span>
                {o.isOverride && <span className="text-meta text-accent-ink">changed</span>}
                {o.event.location && o.event.location !== course.location && <span className="text-meta text-ink-muted">{o.event.location}</span>}
                <span className="ml-auto flex gap-1">
                  <Button variant="ghost" onClick={() => openDialog({ kind: 'event', mode: 'edit', occurrence: o })}>
                    Move
                  </Button>
                  <Button variant="ghost" onClick={() => cancelMeeting(o)}>
                    Cancel class
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {cancelled.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-1 text-label text-ink-muted uppercase">Cancelled</h3>
            <ul>
              {cancelled.map((d) => (
                <li key={d} className="flex items-center gap-4 border-b border-hairline py-2 text-body text-ink-muted">
                  <span className="w-36 shrink-0 line-through">{plainDate(d)}</span>
                  <Button variant="ghost" className="ml-auto" onClick={() => void app.restoreMeeting(course, d)}>
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mb-10" aria-label="To-dos and deadlines">
        <SectionLabel count={open.length} className="mb-2">
          To-dos and deadlines
        </SectionLabel>
        {open.length > 0 ? (
          <TaskList tasks={open} label={`To-dos for ${course.name}`} leaveOnComplete />
        ) : (
          <EmptyState message="Nothing to do for this course." className="py-4">
            <Button variant="ghost" onClick={() => openDialog({ kind: 'task', mode: 'new', defaults: {} })}>
              Add a to-do
            </Button>
          </EmptyState>
        )}
        <CompletedSection tasks={done} />
      </section>

      {otherDates.length > 0 && (
        <section className="mb-10" aria-label="Other dates">
          <SectionLabel count={otherDates.length} className="mb-2">
            Exams and other dates
          </SectionLabel>
          <ul>
            {otherDates.map((o) => (
              <li key={o.key} className="border-b border-hairline">
                <button type="button" onClick={(e) => setDetail({ item: toEventItem(o, calendarsById), anchor: anchorOf(e.currentTarget) })} className="flex min-h-11 w-full items-center gap-4 py-2 text-left hover:bg-surface">
                  <span className="w-48 shrink-0 font-mono text-meta text-ink-muted">{formatWhen(o.start, o.end, o.allDay)}</span>
                  <span className="min-w-0 truncate text-body">{o.event.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-10" aria-label="Files">
        <SectionLabel className="mb-2">Files</SectionLabel>
        <p className="mb-2 text-meta text-ink-muted">Keep the syllabus here. “Import syllabus” also adds its deadlines and exams to your planner.</p>
        <AttachmentList owner={{ ownerType: 'course', ownerId: course.id }} editable />
      </section>

      {course.notes && (
        <section aria-label="Notes">
          <SectionLabel className="mb-2">Notes</SectionLabel>
          <p className="text-body whitespace-pre-wrap text-ink-muted">{course.notes}</p>
        </section>
      )}

      {detail && <ItemDetail item={detail.item} anchor={detail.anchor} onClose={() => setDetail(null)} />}
    </div>
  );
}
