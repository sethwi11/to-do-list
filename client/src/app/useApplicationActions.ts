import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  dateAppliedAfterMove,
  followUpSuggestions,
  followUpTask,
  planApplicationMove,
  planDeadlineReminder,
  prepTasksForEvent,
  type Application,
  type ApplicationStatus,
  type BatchPlan,
  type Calendar,
  type CreateTaskInput,
  type Event,
  type Task,
  type Template,
  type UpdateTaskInput,
} from '@todo/shared';
import { ApiError } from '../api/client';
import { keys } from '../data/queryClient';
import { applicationHooks } from '../data/useApplications';
import type { useFileDeletionPrompt } from '../features/attachments/DeleteFilesDialog';
import { formatDueDate } from '../lib/dates';
import type { Applied } from './useEventActions';

/** What the application form edits. (The board position, timeline and follow-up memory are managed by the app.) */
export type ApplicationFields = Pick<Application, 'company' | 'role' | 'location' | 'jobLink' | 'status' | 'dateApplied' | 'deadline' | 'contactName' | 'contactEmail' | 'notes'>;

export interface InterviewLink {
  eventId: string;
  /** An existing application, or null for none. */
  applicationId: string | null;
  /** Instead of an existing one: make a new application (in Interviewing) for this interview. */
  newApplication?: { company: string; role: string };
  /** Move the application to Interviewing, if it is earlier in the pipeline. */
  markInterviewing: boolean;
  /** Add the Interview prep checklist as to-dos. */
  template: Template | null;
}

export interface ApplicationActions {
  /** Create an application, or change one. Keeps the wishlist-deadline reminder in step. */
  saveApplication: (fields: ApplicationFields, existing?: Application) => Promise<Application | null>;
  /** Move a card to a status, just before the card `beforeId` (or to the end of that column). Logs the status change on the server. */
  moveApplication: (app: Application, status: ApplicationStatus, beforeId?: string | null) => Promise<boolean>;
  /** Delete for good (it asks first about files only it uses). Its to-dos and events stay, no longer linked. */
  deleteApplication: (app: Application) => Promise<boolean>;
  /** Answer a "time to follow up?" suggestion: add the to-do, or dismiss it. */
  answerFollowUp: (app: Application, answer: 'accept' | 'dismiss') => Promise<boolean>;
  /** Tie a new interview event to an application and (optionally) add its prep to-dos. */
  linkInterview: (link: InterviewLink) => Promise<boolean>;
}

const messageOf = (err: unknown) => (err instanceof ApiError ? err.message : 'Unexpected error');
const EARLY: readonly ApplicationStatus[] = ['Wishlist', 'Applied', 'Online Assessment'];
const fieldsOf = (a: Application): ApplicationFields => ({
  company: a.company,
  role: a.role,
  location: a.location,
  jobLink: a.jobLink,
  status: a.status,
  dateApplied: a.dateApplied,
  deadline: a.deadline,
  contactName: a.contactName,
  contactEmail: a.contactEmail,
  notes: a.notes,
});

interface Deps {
  showToast: (message: string, onUndo?: () => void, onCommit?: () => void) => void;
  confirmFiles: ReturnType<typeof useFileDeletionPrompt>['confirmFiles'];
  applyEventPlan: (plan: BatchPlan) => Promise<Applied | null>;
  calendars: Calendar[];
  today: string;
  addTasks: (inputs: CreateTaskInput[]) => Promise<{ ids: string[]; undo: () => Promise<void> }>;
  updateTask: (id: string, changes: UpdateTaskInput) => Promise<Task | null>;
  deleteTask: (id: string) => Promise<boolean>;
  restoreTask: (id: string) => Promise<void>;
}

/**
 * Everything that changes applications. An application is saved first; the to-dos that follow from it (the "Apply to ..."
 * reminder, a follow-up, interview prep) are made second. Every action with an Undo toast takes those with it.
 */
export function useApplicationActions({ showToast, confirmFiles, applyEventPlan, calendars, today, addTasks, updateTask, deleteTask, restoreTask }: Deps): ApplicationActions {
  const qc = useQueryClient();
  const createApp = applicationHooks.useCreate();
  const updateApp = applicationHooks.useUpdate();
  const removeApp = applicationHooks.useDelete();

  const currentApps = useCallback(() => qc.getQueryData<Application[]>(applicationHooks.key) ?? [], [qc]);
  const currentTasks = useCallback(() => qc.getQueryData<Task[]>(keys.tasks) ?? [], [qc]);
  const currentEvents = useCallback(() => qc.getQueryData<Event[]>(keys.events) ?? [], [qc]);
  /** Tasks the tracker makes go on the "Applications" calendar (found by name; if it was renamed they have none). */
  const appsCalendarId = useMemo(() => calendars.find((c) => c.name.toLowerCase() === 'applications')?.id ?? null, [calendars]);

  /**
   * Bring the "Apply to ..." to-do in line with this application (see planDeadlineReminder).
   * Resolves to what was said about it (for the toast) and how to take it all back.
   */
  const syncReminder = useCallback(
    async (app: Application): Promise<{ note: string; undo: () => Promise<void> }> => {
      const plan = planDeadlineReminder(app, currentTasks(), today, appsCalendarId);
      const undos: (() => Promise<void>)[] = [];
      let note = '';
      if (plan.create) {
        const added = await addTasks([plan.create]);
        undos.push(added.undo);
        note = `. Added a reminder to apply by ${formatDueDate(app.deadline!, today)}`;
      }
      for (const { id, changes } of plan.update) {
        const before = currentTasks().find((t) => t.id === id);
        if (!(await updateTask(id, changes)) || !before) continue;
        const revert: UpdateTaskInput = { title: before.title, dueDate: before.dueDate };
        undos.push(async () => void (await updateTask(id, revert)));
        note = '. Moved its reminder to the new deadline';
      }
      for (const id of plan.complete) {
        if (!(await updateTask(id, { status: 'done' }))) continue;
        undos.push(async () => void (await updateTask(id, { status: 'todo' })));
        note = '. Ticked off its “Apply to” reminder';
      }
      for (const id of plan.remove) {
        if (!(await deleteTask(id))) continue;
        undos.push(() => restoreTask(id));
        note = '. Removed its reminder';
      }
      return { note, undo: async () => { for (const undo of undos.reverse()) await undo(); } };
    },
    [currentTasks, today, appsCalendarId, addTasks, updateTask, deleteTask, restoreTask],
  );

  const saveApplication = useCallback<ApplicationActions['saveApplication']>(
    async (fields, existing) => {
      // Moving into a "sent" stage with no date records today, so the stats and the 14-day wait have something to count from.
      const statusChanged = !existing || existing.status !== fields.status;
      const auto = statusChanged ? dateAppliedAfterMove({ dateApplied: fields.dateApplied }, fields.status, today) : undefined;
      const next = auto ? { ...fields, dateApplied: auto } : fields;

      let saved: Application;
      try {
        saved = existing ? await updateApp.mutateAsync({ id: existing.id, changes: next }) : await createApp.mutateAsync({ ...next, id: crypto.randomUUID() });
      } catch (err) {
        showToast(`Couldn’t save the application: ${messageOf(err)}`);
        return null;
      }
      // The reminder depends on the status, deadline and name. If none of those changed, leave it alone: someone who deleted the
      // reminder on purpose shouldn't see it come back every time they fix a typo in the notes.
      const affectsReminder = !existing || existing.status !== saved.status || existing.deadline !== saved.deadline || existing.company !== saved.company || existing.role !== saved.role;
      const reminder = affectsReminder ? await syncReminder(saved) : { note: '', undo: async () => undefined };
      showToast(
        `${existing ? 'Saved' : 'Added'} “${saved.company}”${reminder.note}`,
        () => {
          void (async () => {
            await reminder.undo();
            if (existing) await updateApp.mutateAsync({ id: existing.id, changes: fieldsOf(existing) });
            else await removeApp.mutateAsync(saved.id);
          })().catch((err: unknown) => showToast(`Couldn’t undo that: ${messageOf(err)}`));
        },
      );
      return saved;
    },
    [today, updateApp, createApp, removeApp, syncReminder, showToast],
  );

  const moveApplication = useCallback<ApplicationActions['moveApplication']>(
    async (app, status, beforeId = null) => {
      const plan = planApplicationMove(currentApps(), app.id, status, beforeId);
      const statusChanged = status !== app.status;
      if (!statusChanged && plan.sortOrder === app.sortOrder) return true;
      const dateApplied = statusChanged ? dateAppliedAfterMove(app, status, today) : undefined;
      const previous = { status: app.status, sortOrder: app.sortOrder, dateApplied: app.dateApplied };

      let saved: Application;
      try {
        for (const r of plan.renumber ?? []) if (r.id !== app.id) await updateApp.mutateAsync({ id: r.id, changes: { sortOrder: r.sortOrder } });
        saved = await updateApp.mutateAsync({ id: app.id, changes: { status, sortOrder: plan.sortOrder, ...(dateApplied ? { dateApplied } : {}) } });
      } catch (err) {
        showToast(`Couldn’t move that: ${messageOf(err)}`);
        return false;
      }
      if (!statusChanged) return true; // putting a card in a different spot in its column needs no toast, like reordering to-dos
      const reminder = await syncReminder(saved);
      showToast(`Moved “${app.company}” to ${status}${reminder.note}`, () => {
        void (async () => {
          await reminder.undo();
          // Reversed this quickly, the server erases the slip from the timeline instead of logging the fix after it.
          await updateApp.mutateAsync({ id: app.id, changes: previous });
        })().catch((err: unknown) => showToast(`Couldn’t undo that: ${messageOf(err)}`));
      });
      return true;
    },
    [currentApps, today, updateApp, syncReminder, showToast],
  );

  const deleteApplication = useCallback<ApplicationActions['deleteApplication']>(
    async (app) => {
      // Files only this application uses (a resume version, an offer letter) can go too, if the person says so.
      const files = await confirmFiles([{ ownerType: 'application', ownerId: app.id }], `${app.company} (${app.role})`);
      if (!files.proceed) return false;
      // Its "Apply to ..." reminder means nothing without it. Other to-dos and events stay, just no longer linked (the database does that).
      const reminders = currentTasks().filter((t) => t.applicationId === app.id && t.source === 'application-deadline' && t.status === 'todo');
      const removed: string[] = [];
      for (const t of reminders) if (await deleteTask(t.id)) removed.push(t.id);
      try {
        await removeApp.mutateAsync(app.id);
      } catch (err) {
        for (const id of removed) await restoreTask(id);
        showToast(`Couldn’t delete the application: ${messageOf(err)}`);
        return false;
      }
      files.commit?.(); // there's no Undo for this, so what the person agreed to delete goes now
      await Promise.all([qc.invalidateQueries({ queryKey: keys.events }), qc.invalidateQueries({ queryKey: keys.tasks })]);
      showToast(`Deleted “${app.company}”`);
      return true;
    },
    [confirmFiles, currentTasks, deleteTask, restoreTask, removeApp, qc, showToast],
  );

  const answerFollowUp = useCallback<ApplicationActions['answerFollowUp']>(
    async (app, answer) => {
      let undoTask: (() => Promise<void>) | null = null;
      if (answer === 'accept') {
        const suggestion = followUpSuggestions([app], today)[0];
        if (!suggestion) return false;
        const added = await addTasks([followUpTask(suggestion, today, appsCalendarId)]);
        if (added.ids.length === 0) return false;
        undoTask = added.undo;
      }
      try {
        await updateApp.mutateAsync({ id: app.id, changes: { followUpHandledAt: new Date().toISOString() } });
      } catch (err) {
        await undoTask?.();
        showToast(`Couldn’t save that: ${messageOf(err)}`);
        return false;
      }
      showToast(answer === 'accept' ? `Added a follow-up to-do for ${app.company}` : `Dismissed the follow-up for ${app.company}`, () => {
        void (async () => {
          await undoTask?.();
          await updateApp.mutateAsync({ id: app.id, changes: { followUpHandledAt: app.followUpHandledAt } });
        })().catch((err: unknown) => showToast(`Couldn’t undo that: ${messageOf(err)}`));
      });
      return true;
    },
    [today, appsCalendarId, addTasks, updateApp, showToast],
  );

  const linkInterview = useCallback<ApplicationActions['linkInterview']>(
    async ({ eventId, applicationId, newApplication, markInterviewing, template }) => {
      const event = currentEvents().find((e) => e.id === eventId);
      if (!event) {
        showToast('That event no longer exists.');
        return false;
      }
      const undos: (() => Promise<void>)[] = [];
      const said: string[] = [];
      let target: Application | null = applicationId ? (currentApps().find((a) => a.id === applicationId) ?? null) : null;

      try {
        if (newApplication) {
          const created = await createApp.mutateAsync({ ...newApplication, status: 'Interviewing', dateApplied: today, id: crypto.randomUUID() });
          undos.push(async () => void (await removeApp.mutateAsync(created.id)));
          target = created;
          said.push(`added ${created.company} to Interviewing`);
        } else if (target && markInterviewing && EARLY.includes(target.status)) {
          const before = target;
          const saved = await updateApp.mutateAsync({
            id: before.id,
            changes: { status: 'Interviewing', ...(dateAppliedAfterMove(before, 'Interviewing', today) ? { dateApplied: today } : {}) },
          });
          const reminder = await syncReminder(saved);
          undos.push(async () => {
            await reminder.undo();
            await updateApp.mutateAsync({ id: before.id, changes: { status: before.status, dateApplied: before.dateApplied } });
          });
          target = saved;
          said.push(`moved ${saved.company} to Interviewing`);
        }

        if (target && event.applicationId !== target.id) {
          // An interview with no calendar of its own goes on Applications, so it shares the color of everything else for that application.
          const calendarId = event.calendarId ?? appsCalendarId;
          const applied = await applyEventPlan({ put: [{ ...event, applicationId: target.id, calendarId, updatedAt: new Date().toISOString() }], remove: [] });
          if (applied) {
            undos.push(applied.undo);
            if (said.length === 0) said.push(`linked to ${target.company}`);
          }
        }

        if (template) {
          const prep = prepTasksForEvent(template, { title: event.title, start: event.start }, today, { applicationId: target?.id ?? null, calendarId: event.calendarId ?? appsCalendarId });
          const added = await addTasks(prep.tasks);
          if (added.ids.length > 0) {
            undos.push(added.undo);
            said.push(`added ${added.ids.length} prep to-dos`);
          }
        }
      } catch (err) {
        showToast(`Couldn’t finish that: ${messageOf(err)}`);
        return false;
      }

      if (said.length > 0) {
        const message = said.join(', ');
        showToast(message.charAt(0).toUpperCase() + message.slice(1), () => {
          void (async () => {
            for (const undo of [...undos].reverse()) await undo();
          })().catch((err: unknown) => showToast(`Couldn’t undo that: ${messageOf(err)}`));
        });
      }
      return true;
    },
    [currentEvents, currentApps, createApp, updateApp, removeApp, today, syncReminder, applyEventPlan, addTasks, appsCalendarId, showToast],
  );

  return { saveApplication, moveApplication, deleteApplication, answerFollowUp, linkInterview };
}
