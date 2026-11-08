import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Archive, ArchiveRestore, Pencil, Plus } from 'lucide-react';
import { addDays, classTitle, expandOccurrences, type Course } from '@todo/shared';
import { useApp } from '../app/AppContext';
import { PageHeader } from '../app/PageHeader';
import { currentSemester, describeMeetingDays } from '../features/courses/courseModel';
import { formatTimeRange } from '../features/calendar/format';
import { calendarVars } from '../lib/calendarColors';
import { formatDueDate, shortDate } from '../lib/dates';
import { Button, IconButton } from '../ui/Button';
import { Select } from '../ui/fields';
import { EmptyState, SkeletonRows } from '../ui/states';


/** Your classes, a semester at a time. */
export default function CoursesPage() {
  const app = useApp();
  const { courses, semesters, events, tasks, today, coursesLoading, openDialog } = app;
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const showArchived = params.get('archived') === '1';
  const choosable = semesters.filter((s) => showArchived || !s.archived);
  const semester = semesters.find((s) => s.id === params.get('semester')) ?? currentSemester(semesters, today) ?? choosable[0];
  const hasArchived = semesters.some((s) => s.archived);

  const inSemester = useMemo(() => courses.filter((c) => c.semesterId === semester?.id).sort((a, b) => a.name.localeCompare(b.name)), [courses, semester?.id]);

  /** The next meeting of each course (class events of archived semesters are hidden everywhere, so there's none to show then). */
  const nextMeeting = useMemo(() => {
    const out = new Map<string, string>();
    for (const o of expandOccurrences(events.filter((e) => e.courseId), today, addDays(today, 60))) {
      if (o.event.courseId && !out.has(o.event.courseId)) out.set(o.event.courseId, o.start);
    }
    return out;
  }, [events, today]);
  const openTodos = (c: Course) => tasks.filter((t) => t.courseId === c.id && t.status === 'todo').length;

  const go = (next: { semester?: string; archived?: boolean }) => {
    const q = new URLSearchParams();
    const id = next.semester ?? semester?.id;
    if (id) q.set('semester', id);
    if (next.archived ?? showArchived) q.set('archived', '1');
    navigate(`/courses?${q.toString()}`);
  };

  return (
    <div className="max-w-[960px]">
      <PageHeader title="Courses" />

      {coursesLoading ? (
        <SkeletonRows count={4} />
      ) : !semester ? (
        <EmptyState message={hasArchived ? 'All your semesters are archived.' : 'Set up a semester first, then add your classes to it.'}>
          <div className="flex flex-wrap gap-3">
            {hasArchived && (
              <Button variant="ghost" onClick={() => go({ archived: true, semester: semesters[0]?.id })}>
                Show archived
              </Button>
            )}
            <Button variant="primary" icon={Plus} onClick={() => openDialog({ kind: 'semester', id: 'new' })}>
              New semester
            </Button>
          </div>
        </EmptyState>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-3">
            <Select aria-label="Semester" value={semester.id} onChange={(e) => go({ semester: e.target.value })} wrapperClassName="w-56">
              {choosable.concat(choosable.some((s) => s.id === semester.id) ? [] : [semester]).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.archived ? ' (archived)' : ''}
                </option>
              ))}
            </Select>
            <IconButton icon={Pencil} label="Edit semester" onClick={() => openDialog({ kind: 'semester', id: semester.id })} />
            <Button
              variant="ghost"
              icon={semester.archived ? ArchiveRestore : Archive}
              onClick={() => {
                void app.setSemesterArchived(semester, !semester.archived);
                // Stay on the semester you just archived (with its "Restore" button) instead of dropping to an empty page.
                if (!semester.archived) go({ semester: semester.id, archived: true });
              }}
            >
              {semester.archived ? 'Restore semester' : 'Archive semester'}
            </Button>
            <Button variant="ghost" icon={Plus} onClick={() => openDialog({ kind: 'semester', id: 'new' })}>
              New semester
            </Button>
            {hasArchived && (
              <label className="flex cursor-pointer items-center gap-2 text-meta text-ink-muted">
                <input type="checkbox" checked={showArchived} onChange={(e) => go({ archived: e.target.checked })} className="accent-accent-ink" />
                Show archived
              </label>
            )}
            <Button variant="primary" icon={Plus} className="sm:ml-auto" onClick={() => openDialog({ kind: 'course', id: 'new', semesterId: semester.id })} disabled={semester.archived}>
              New course
            </Button>
          </div>

          <p className="mb-6 font-mono text-meta text-ink-muted">
            {shortDate(semester.startDate)} – {shortDate(semester.endDate)}
            {semester.excludedRanges.length > 0 && ` · breaks: ${semester.excludedRanges.map((r) => r.label || `${r.start.slice(5)}`).join(', ')}`}
          </p>

          {semester.archived && (
            <p className="mb-6 border-l-[3px] border-rule pl-3 text-body text-ink-muted">This semester is archived. Its classes are hidden from the calendar and Today, but nothing is deleted. Restore it to bring them back.</p>
          )}

          {inSemester.length === 0 ? (
            <EmptyState message={`No courses in ${semester.name} yet.`}>
              {!semester.archived && (
                <Button variant="ghost" onClick={() => openDialog({ kind: 'course', id: 'new', semesterId: semester.id })}>
                  Add a course
                </Button>
              )}
            </EmptyState>
          ) : (
            <ul>
              {inSemester.map((c) => {
                const next = nextMeeting.get(c.id);
                const todos = openTodos(c);
                return (
                  <li key={c.id} style={calendarVars(c.color)} className="group relative flex items-stretch border-b border-hairline">
                    <Link to={`/courses/${c.id}`} className="flex min-w-0 flex-1 gap-4 py-4 pl-1 transition-colors duration-150 ease-out hover:bg-surface">
                      <span aria-hidden className="mt-1.5 size-3 shrink-0 bg-(color:--c)" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-section break-words">{classTitle(c)}</span>
                        <span className="mt-0.5 block font-mono text-meta text-ink-muted">
                          {describeMeetingDays(c.meetingDays)} · {formatTimeRange(c.startTime, c.endTime)}
                        </span>
                        {(c.location || c.instructor) && <span className="block text-meta text-ink-muted">{[c.location, c.instructor].filter(Boolean).join(' · ')}</span>}
                      </span>
                      <span className="hidden shrink-0 text-right text-meta text-ink-muted sm:block">
                        {next && <span className="block">Next: {formatDueDate(next.slice(0, 10), today)}</span>}
                        <span className="block font-mono tabular-nums">{todos} open {todos === 1 ? 'to-do' : 'to-dos'}</span>
                      </span>
                    </Link>
                    <IconButton icon={Pencil} label={`Edit ${c.name}`} className="my-auto mr-1" onClick={() => openDialog({ kind: 'course', id: c.id })} />
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
