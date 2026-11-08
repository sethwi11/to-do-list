import { useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { CALENDAR_COLORS, classMeetingDates, type CalendarColor, type Course } from '@todo/shared';
import { useApp } from '../../app/AppContext';
import { cx } from '../../lib/cx';
import { shortDate } from '../../lib/dates';
import { Button } from '../../ui/Button';
import { ColorPicker } from '../../ui/ColorPicker';
import { Field, Input, Select, Textarea } from '../../ui/fields';
import { Dialog } from '../../ui/Panel';
import { describeMeetingDays } from './courseModel';

const WEEKDAY_INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Add a class, or change one. Saving builds (or rebuilds) all of its meetings for the semester. */
export function CourseDialog() {
  const { dialog, closeDialog, courses, deleteCourse } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const open = dialog?.kind === 'course';
  const editing = open && dialog.id !== 'new' ? (courses.find((c) => c.id === dialog.id) ?? null) : null;

  return (
    <Dialog
      open={open}
      onClose={() => closeDialog('course')}
      title={editing ? 'Edit course' : 'New course'}
      footer={
        <>
          {editing && (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              onClick={() => {
                // Asks about its files first, if it has any only it uses; closes only if the delete went through.
                void deleteCourse(editing).then((done) => {
                  if (!done) return;
                  closeDialog('course');
                  // Deleted from its own page: go back to the list, rather than leave you on "Course not found". (Undo brings it back there.)
                  if (location.pathname === `/courses/${editing.id}`) navigate(`/courses?semester=${editing.semesterId}`);
                });
              }}
            >
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={() => closeDialog('course')}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="course-form">
            {editing ? 'Save' : 'Add course'}
          </Button>
        </>
      }
    >
      {open && <CourseForm course={editing} semesterId={dialog.id === 'new' ? dialog.semesterId : undefined} />}
    </Dialog>
  );
}

function CourseForm({ course, semesterId }: { course: Course | null; semesterId?: string }) {
  const { semesters, courses, calendars, saveCourse, closeDialog } = useApp();
  // Archived semesters aren't offered for new courses (but a course already in one keeps it).
  const choices = semesters.filter((s) => !s.archived || s.id === course?.semesterId);
  const initialSemester = course?.semesterId ?? semesterId ?? choices[0]?.id ?? '';
  const defaultColor = (): CalendarColor => {
    const used = new Set(courses.filter((c) => c.semesterId === initialSemester).map((c) => c.color));
    return CALENDAR_COLORS.find((c) => !used.has(c)) ?? CALENDAR_COLORS[courses.length % CALENDAR_COLORS.length]!;
  };

  const [name, setName] = useState(course?.name ?? '');
  const [code, setCode] = useState(course?.code ?? '');
  const [sem, setSem] = useState(initialSemester);
  const [calendarId, setCalendarId] = useState(course ? (course.calendarId ?? '') : (calendars.find((c) => c.name.toLowerCase() === 'school')?.id ?? ''));
  const [color, setColor] = useState<CalendarColor>(course?.color ?? defaultColor());
  const [days, setDays] = useState<number[]>(course?.meetingDays ?? [1, 3, 5]);
  const [startTime, setStartTime] = useState(course?.startTime ?? '10:00');
  const [endTime, setEndTime] = useState(course?.endTime ?? '11:15');
  const [location, setLocation] = useState(course?.location ?? '');
  const [instructor, setInstructor] = useState(course?.instructor ?? '');
  const [notes, setNotes] = useState(course?.notes ?? '');
  const [errors, setErrors] = useState<{ name?: string; days?: string; time?: string }>({});

  const semester = semesters.find((s) => s.id === sem);
  // What saving will produce, shown before it does, so a wrong day or semester is noticed now.
  const summary = useMemo(() => {
    if (!semester || days.length === 0) return null;
    const meetings = classMeetingDates({ meetingDays: days }, semester);
    return { count: meetings.length, first: meetings[0], last: meetings.at(-1) };
  }, [semester, days]);

  function toggleDay(day: number) {
    setDays((d) => (d.includes(day) ? d.filter((x) => x !== day) : [...d, day]));
    setErrors((e) => ({ ...e, days: undefined }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Give the course a name.';
    if (days.length === 0) next.days = 'Choose at least one day it meets.';
    if (!startTime || !endTime || endTime <= startTime) next.time = 'Class must end after it starts.';
    if (next.name || next.days || next.time) return setErrors(next);
    if (!semester) return;
    const saved = await saveCourse(
      {
        semesterId: sem,
        name: name.trim(),
        code: code.trim() || null,
        color,
        calendarId: calendarId || null,
        meetingDays: [...days].sort((a, b) => a - b),
        startTime,
        endTime,
        location: location.trim() || null,
        instructor: instructor.trim() || null,
        notes: notes.trim() || null,
      },
      course ?? undefined,
    );
    if (saved) closeDialog('course');
  }

  const fmt = (d?: string) => (d ? shortDate(d) : '');

  return (
    <form id="course-form" onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-3">
        <Field label="Course name" error={errors.name}>
          {(p) => (
            <Input
              {...p}
              value={name}
              maxLength={100}
              data-autofocus
              placeholder="Algorithms"
              onChange={(e) => {
                setName(e.target.value);
                setErrors((x) => ({ ...x, name: undefined }));
              }}
            />
          )}
        </Field>
        <Field label="Code">{(p) => <Input {...p} value={code} maxLength={30} placeholder="COMP 365" onChange={(e) => setCode(e.target.value)} />}</Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Semester">
          {(p) => (
            <Select {...p} value={sem} onChange={(e) => setSem(e.target.value)}>
              {choices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Calendar">
          {(p) => (
            <Select {...p} value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
              <option value="">None</option>
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <ColorPicker name="course-color" value={color} onChange={setColor} />

      <fieldset aria-describedby={errors.days ? 'course-days-error' : undefined}>
        <legend className="mb-1.5 text-label text-ink-muted uppercase">Meets on</legend>
        <div className="flex gap-1">
          {WEEKDAY_INITIAL.map((initial, day) => {
            const on = days.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                aria-label={WEEKDAY_NAME[day]}
                onClick={() => toggleDay(day)}
                className={cx('grid size-9 place-items-center rounded-control border text-body transition-colors duration-150 ease-out', on ? 'border-ink bg-ink text-paper' : 'border-rule text-ink hover:border-ink-muted')}
              >
                {initial}
              </button>
            );
          })}
        </div>
        {errors.days && (
          <p id="course-days-error" role="alert" className="mt-1.5 text-meta text-danger">
            {errors.days}
          </p>
        )}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts" error={errors.time}>
          {(p) => <Input {...p} type="time" value={startTime} onChange={(e) => { setStartTime(e.target.value); setErrors((x) => ({ ...x, time: undefined })); }} />}
        </Field>
        <Field label="Ends">{(p) => <Input {...p} type="time" value={endTime} onChange={(e) => { setEndTime(e.target.value); setErrors((x) => ({ ...x, time: undefined })); }} />}</Field>
      </div>

      {summary && semester && (
        <p className="border-l-[3px] border-rule pl-3 text-meta text-ink-muted" aria-live="polite">
          {describeMeetingDays(days)} · {summary.count} {summary.count === 1 ? 'class' : 'classes'} in {semester.name}
          {summary.count > 0 && ` (${fmt(summary.first)} to ${fmt(summary.last)})`}
          {semester.excludedRanges.length > 0 && `, skipping ${semester.excludedRanges.length} ${semester.excludedRanges.length === 1 ? 'break' : 'breaks'}`}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Location">{(p) => <Input {...p} value={location} maxLength={200} onChange={(e) => setLocation(e.target.value)} />}</Field>
        <Field label="Instructor">{(p) => <Input {...p} value={instructor} maxLength={100} onChange={(e) => setInstructor(e.target.value)} />}</Field>
      </div>
      <Field label="Notes (section, office hours…)">{(p) => <Textarea {...p} value={notes} maxLength={5000} onChange={(e) => setNotes(e.target.value)} />}</Field>

      {course && <p className="text-meta text-ink-muted">Saving updates every class meeting. Meetings you cancelled or moved stay that way.</p>}
    </form>
  );
}
