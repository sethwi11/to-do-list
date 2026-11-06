import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  CLASS_SOURCE,
  classMeetingDates,
  findClassSeries,
  planCourseDelete,
  planCourseSchedule,
  planRestoreMeeting,
  planSemesterReschedule,
  type BatchPlan,
  type Course,
  type Event,
  type EventType,
  type Semester,
  type Task,
  type UpdateTaskInput,
} from '@todo/shared';
import { ApiError } from '../api/client';
import { attachmentsApi } from '../api/attachments';
import { coursesApi } from '../api/entities';
import { keys } from '../data/queryClient';
import { courseHooks, semesterHooks } from '../data/useCourses';
import type { useFileDeletionPrompt } from '../features/attachments/DeleteFilesDialog';
import type { Applied } from './useEventActions';

export type CourseFields = Omit<Course, 'id' | 'createdAt' | 'updatedAt'>;
export type SemesterFields = Omit<Semester, 'id' | 'createdAt'>;

export interface CourseActions {
  /** Create a semester, or change one (rebuilding its courses' classes if its dates or breaks changed). */
  saveSemester: (fields: SemesterFields, existing?: Semester) => Promise<Semester | null>;
  setSemesterArchived: (semester: Semester, archived: boolean) => Promise<void>;
  deleteSemester: (semester: Semester) => Promise<boolean>;
  /** Create a course, or change one, and (re)build its class meetings to match. */
  saveCourse: (fields: CourseFields, existing?: Course) => Promise<Course | null>;
  /** Regenerate a course's class meetings from its settings (keeps meetings you cancelled or moved). */
  rebuildCourse: (course: Course) => Promise<boolean>;
  deleteCourse: (course: Course) => Promise<boolean>;
  restoreMeeting: (course: Course, date: string) => Promise<boolean>;
}

const messageOf = (err: unknown) => (err instanceof ApiError ? err.message : 'Unexpected error');
const fieldsOf = ({ id: _i, createdAt: _c, updatedAt: _u, ...fields }: Course): CourseFields => fields;
/** "Mon, Nov 9" (the friendly "Monday" is ambiguous in a message about a specific class). */
const plain = (date: string) => new Date(`${date}T12:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const sameRanges = (a: Semester['excludedRanges'], b: Semester['excludedRanges']) => JSON.stringify(a) === JSON.stringify(b);

interface Deps {
  showToast: (message: string, onUndo?: () => void, onCommit?: () => void) => void;
  confirmFiles: ReturnType<typeof useFileDeletionPrompt>['confirmFiles'];
  applyEventPlan: (plan: BatchPlan) => Promise<Applied | null>;
  eventTypes: EventType[];
  tasks: Task[];
  updateTask: (id: string, changes: UpdateTaskInput) => Promise<Task | null>;
}

/**
 * Everything that changes courses and semesters. A course is saved first and its class meetings generated
 * from it second (they need its id), as one batch of events. If that second step fails the course is still
 * there, and "Rebuild classes" on its page tries again.
 */
export function useCourseActions({ showToast, confirmFiles, applyEventPlan, eventTypes, tasks, updateTask }: Deps): CourseActions {
  const qc = useQueryClient();
  const createCourse = courseHooks.useCreate();
  const updateCourse = courseHooks.useUpdate();
  const removeCourse = courseHooks.useDelete();
  const createSemester = semesterHooks.useCreate();
  const updateSemester = semesterHooks.useUpdate();
  const removeSemester = semesterHooks.useDelete();

  const classTypeId = useMemo(() => eventTypes.find((t) => t.name === 'Class')?.id ?? null, [eventTypes]);
  const ctx = useCallback(() => ({ typeId: classTypeId, now: new Date().toISOString(), newId: () => crypto.randomUUID() }), [classTypeId]);
  const currentEvents = useCallback(() => qc.getQueryData<Event[]>(keys.events) ?? [], [qc]);
  const currentCourses = useCallback(() => qc.getQueryData<Course[]>(['courses']) ?? [], [qc]);
  const semesterOf = useCallback((id: string) => qc.getQueryData<Semester[]>(['semesters'])?.find((s) => s.id === id), [qc]);
  const refreshAll = useCallback(() => Promise.all([keys.events, keys.tasks, ['courses'], ['semesters']].map((queryKey) => qc.invalidateQueries({ queryKey }))), [qc]);

  const saveCourse = useCallback<CourseActions['saveCourse']>(
    async (fields, existing) => {
      const semester = semesterOf(fields.semesterId);
      if (!semester) {
        showToast('Choose a semester for this course first.');
        return null;
      }
      let course: Course;
      try {
        course = existing ? await updateCourse.mutateAsync({ id: existing.id, changes: fields }) : await createCourse.mutateAsync({ ...fields, id: crypto.randomUUID() });
      } catch (err) {
        showToast(`Couldn't save the course: ${messageOf(err)}`);
        return null;
      }
      const applied = await applyEventPlan(planCourseSchedule({ course, semester, previousSemester: existing ? semesterOf(existing.semesterId) : null, events: currentEvents(), ctx: ctx() }));
      if (!applied) {
        showToast('The course was saved, but its classes couldn’t be added. Open the course and choose “Rebuild classes”.');
        return course;
      }
      const meetings = classMeetingDates(course, semester).length;
      showToast(
        existing ? `Saved “${course.name}” and updated its ${meetings} classes` : `Added “${course.name}”: ${meetings} classes this semester`,
        () => {
          void (async () => {
            await applied.undo();
            if (existing) await updateCourse.mutateAsync({ id: existing.id, changes: fieldsOf(existing) });
            else await removeCourse.mutateAsync(course.id);
            await refreshAll();
          })();
        },
      );
      return course;
    },
    [semesterOf, updateCourse, createCourse, applyEventPlan, currentEvents, ctx, showToast, removeCourse, refreshAll],
  );

  const rebuildCourse = useCallback<CourseActions['rebuildCourse']>(
    async (course) => {
      const semester = semesterOf(course.semesterId);
      if (!semester) return false;
      const applied = await applyEventPlan(planCourseSchedule({ course, semester, events: currentEvents(), ctx: ctx() }));
      if (!applied) return false;
      showToast(`Rebuilt the classes for “${course.name}”`, () => void applied.undo());
      return true;
    },
    [semesterOf, applyEventPlan, currentEvents, ctx, showToast],
  );

  const deleteCourse = useCallback<CourseActions['deleteCourse']>(
    async (course) => {
      // Files only this course uses (its syllabus) can go too, if the person says so, once Undo is no longer possible.
      const files = await confirmFiles([{ ownerType: 'course', ownerId: course.id }], course.name);
      if (!files.proceed) return false;

      const events = currentEvents();
      const now = new Date().toISOString();
      // Its class meetings go. Anything else tied to it (an exam from the syllabus) stays, just no longer tied to a course.
      const plan: BatchPlan = {
        put: events.filter((e) => e.courseId === course.id && e.source !== CLASS_SOURCE).map((e) => ({ ...e, courseId: null, updatedAt: now })),
        remove: planCourseDelete(events, course.id).remove,
      };
      const tiedTasks = tasks.filter((t) => t.courseId === course.id).map((t) => t.id);
      const applied = plan.put.length + plan.remove.length > 0 ? await applyEventPlan(plan) : ({ undo: async () => undefined } as Applied);
      if (!applied) return false;
      try {
        await removeCourse.mutateAsync(course.id);
      } catch (err) {
        await applied.undo();
        showToast(`Couldn't delete the course: ${messageOf(err)}`);
        return false;
      }
      await refreshAll();
      showToast(
        `Deleted “${course.name}” and its classes`,
        () => {
          void (async () => {
            // Put it all back, in the order the database needs: the course first, then what refers to it.
            await coursesApi.create({ ...fieldsOf(course), id: course.id });
            await applied.undo();
            for (const id of tiedTasks) await updateTask(id, { courseId: course.id });
            await refreshAll();
          })().catch((err: unknown) => showToast(`Couldn't undo that: ${messageOf(err)}`));
        },
        files.commit,
      );
      return true;
    },
    [confirmFiles, currentEvents, tasks, applyEventPlan, removeCourse, refreshAll, showToast, updateTask],
  );

  const restoreMeeting = useCallback<CourseActions['restoreMeeting']>(
    async (course, date) => {
      const series = findClassSeries(currentEvents(), course.id);
      if (!series) return false;
      const applied = await applyEventPlan(planRestoreMeeting(series, date, new Date().toISOString()));
      if (!applied) return false;
      showToast(`Restored the class on ${plain(date)}`, () => void applied.undo());
      return true;
    },
    [currentEvents, applyEventPlan, showToast],
  );

  const saveSemester = useCallback<CourseActions['saveSemester']>(
    async (fields, existing) => {
      let saved: Semester;
      try {
        saved = existing ? await updateSemester.mutateAsync({ id: existing.id, changes: fields }) : await createSemester.mutateAsync({ ...fields, id: crypto.randomUUID() });
      } catch (err) {
        showToast(`Couldn't save the semester: ${messageOf(err)}`);
        return null;
      }
      const datesChanged = existing && (existing.startDate !== saved.startDate || existing.endDate !== saved.endDate || !sameRanges(existing.excludedRanges, saved.excludedRanges));
      if (existing && datesChanged) {
        const plan = planSemesterReschedule({ semester: saved, previousSemester: existing, courses: currentCourses(), events: currentEvents(), ctx: ctx() });
        const applied = plan.put.length > 0 ? await applyEventPlan(plan) : ({ undo: async () => undefined } as Applied);
        if (applied && plan.put.length > 0) {
          showToast(`Saved “${saved.name}” and rebuilt its classes`, () => {
            void (async () => {
              await applied.undo();
              await updateSemester.mutateAsync({ id: existing.id, changes: { startDate: existing.startDate, endDate: existing.endDate, excludedRanges: existing.excludedRanges } });
            })();
          });
        }
      }
      return saved;
    },
    [updateSemester, createSemester, showToast, currentCourses, currentEvents, ctx, applyEventPlan],
  );

  const setSemesterArchived = useCallback<CourseActions['setSemesterArchived']>(
    async (semester, archived) => {
      try {
        await updateSemester.mutateAsync({ id: semester.id, changes: { archived } });
      } catch (err) {
        showToast(`Couldn't ${archived ? 'archive' : 'restore'} it: ${messageOf(err)}`);
        return;
      }
      showToast(archived ? `Archived “${semester.name}”. Its courses and classes are hidden, not deleted.` : `Restored “${semester.name}”`, () => void updateSemester.mutateAsync({ id: semester.id, changes: { archived: !archived } }));
    },
    [updateSemester, showToast],
  );

  const deleteSemester = useCallback<CourseActions['deleteSemester']>(
    async (semester) => {
      const inSemester = currentCourses().filter((c) => c.semesterId === semester.id);
      const events = currentEvents();
      const now = new Date().toISOString();
      const ids = new Set(inSemester.map((c) => c.id));
      const plan: BatchPlan = {
        put: events.filter((e) => e.courseId && ids.has(e.courseId) && e.source !== CLASS_SOURCE).map((e) => ({ ...e, courseId: null, updatedAt: now })),
        remove: inSemester.flatMap((c) => planCourseDelete(events, c.id).remove),
      };
      if (plan.put.length + plan.remove.length > 0 && !(await applyEventPlan(plan))) return false;
      // Files only these courses used (their syllabuses) go with them; the person was told so.
      for (const c of inSemester) {
        const files = await attachmentsApi.forOwner({ ownerType: 'course', ownerId: c.id }).catch(() => []);
        await Promise.allSettled(files.filter((f) => f.linkCount === 1).map((f) => attachmentsApi.remove(f.id)));
      }
      try {
        await removeSemester.mutateAsync(semester.id);
      } catch (err) {
        showToast(`Couldn't delete the semester: ${messageOf(err)}`);
        return false;
      }
      await refreshAll();
      showToast(`Deleted “${semester.name}”${inSemester.length ? `, its ${inSemester.length} ${inSemester.length === 1 ? 'course' : 'courses'} and their classes` : ''}`);
      return true;
    },
    [currentCourses, currentEvents, applyEventPlan, removeSemester, refreshAll, showToast],
  );

  return { saveSemester, setSemesterArchived, deleteSemester, saveCourse, rebuildCourse, deleteCourse, restoreMeeting };
}
