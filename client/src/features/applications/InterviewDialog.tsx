import { useMemo, useState, type FormEvent } from 'react';
import { guessApplication, INTERVIEW_PREP_TEMPLATE, isOpen, prepTasksForEvent, type Event, type Template } from '@todo/shared';
import { useApp } from '../../app/AppContext';
import { templateHooks } from '../../data/useApplications';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Field, Input, Select } from '../../ui/fields';
import { Dialog } from '../../ui/Panel';
import { formatWhen } from '../calendar/format';

const NEW = '__new';
const EARLY = ['Wishlist', 'Applied', 'Online Assessment'];

/**
 * Asked right after an Interview event is made (however it was made): which application is it for, and should the
 * "Interview prep" checklist be added as to-dos? Several interviews made at once (from one import) are asked one at a time.
 */
export function InterviewDialog() {
  const { dialog, openDialog, closeDialog, events } = useApp();
  // Loaded here, as soon as the app starts, so the checklist is already known when the question appears.
  const templates = templateHooks.useList().data;
  const template = useMemo(() => templates?.find((t) => t.name.toLowerCase() === INTERVIEW_PREP_TEMPLATE.toLowerCase()) ?? null, [templates]);
  const open = dialog?.kind === 'interview';
  const ids = open ? dialog.eventIds : [];
  const event = events.find((e) => e.id === ids[0]);

  /** Done with this one: ask about the next, or close. */
  const next = () => {
    if (ids.length > 1) openDialog({ kind: 'interview', eventIds: ids.slice(1) });
    else closeDialog('interview');
  };

  return (
    <Dialog
      open={open && !!event}
      onClose={() => closeDialog('interview')}
      title="Which application is this for?"
      footer={
        <>
          <Button variant="ghost" onClick={next}>
            Skip
          </Button>
          <Button variant="primary" type="submit" form="interview-form">
            Save
          </Button>
        </>
      }
    >
      {open && event && <InterviewForm key={event.id} event={event} template={template} remaining={ids.length - 1} onDone={next} />}
    </Dialog>
  );
}

function InterviewForm({ event, template, remaining, onDone }: { event: Event; template: Template | null; remaining: number; onDone: () => void }) {
  const { applications, linkInterview, today } = useApp();

  const choices = useMemo(() => applications.filter((a) => isOpen(a.status) || a.id === event.applicationId).sort((a, b) => a.company.localeCompare(b.company)), [applications, event.applicationId]);
  // Already tied to one (the interview was added from that application's page)? Start there. Otherwise a company named in the title.
  const [choice, setChoice] = useState(() => event.applicationId ?? guessApplication(event.title, applications)?.id ?? (applications.length === 0 ? NEW : ''));
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [markInterviewing, setMarkInterviewing] = useState(true);
  const [prep, setPrep] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const chosen = applications.find((a) => a.id === choice);
  const canMove = !!chosen && EARLY.includes(chosen.status);
  const preview = template ? prepTasksForEvent(template, { title: event.title, start: event.start }, today, { applicationId: null, calendarId: null }) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (choice === NEW && (!company.trim() || !role.trim())) {
      setError('Enter the company and the role, or choose “Not for an application”.');
      return;
    }
    const linked = choice !== '';
    await linkInterview({
      eventId: event.id,
      applicationId: choice && choice !== NEW ? choice : null,
      newApplication: choice === NEW ? { company: company.trim(), role: role.trim() } : undefined,
      markInterviewing: linked && markInterviewing,
      template: prep ? template : null,
    });
    onDone();
  }

  return (
    <form id="interview-form" onSubmit={submit} className="space-y-4">
      <p className="text-body">
        <span className="font-medium">{event.title}</span>
        <span className="block font-mono text-meta text-ink-muted">{formatWhen(event.start, event.end, event.allDay)}</span>
        {remaining > 0 && <span className="block text-meta text-ink-muted">{remaining} more interview{remaining === 1 ? '' : 's'} to go through after this.</span>}
      </p>

      <Field label="Application" error={error}>
        {(p) => (
          <Select {...p} value={choice} data-autofocus onChange={(e) => { setChoice(e.target.value); setError(undefined); }}>
            <option value="">Not for an application</option>
            {choices.map((a) => (
              <option key={a.id} value={a.id}>
                {a.company} — {a.role} ({a.status})
              </option>
            ))}
            <option value={NEW}>New application…</option>
          </Select>
        )}
      </Field>

      {choice === NEW && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Company">{(p) => <Input {...p} value={company} maxLength={100} onChange={(e) => { setCompany(e.target.value); setError(undefined); }} />}</Field>
          <Field label="Role">{(p) => <Input {...p} value={role} maxLength={150} onChange={(e) => { setRole(e.target.value); setError(undefined); }} />}</Field>
          <p className="text-meta text-ink-muted sm:col-span-2">It starts in Interviewing, dated today.</p>
        </div>
      )}

      {canMove && (
        <label className="flex w-fit cursor-pointer items-center gap-1 text-body">
          <Checkbox checked={markInterviewing} onChange={(e) => setMarkInterviewing(e.target.checked)} label={`Move ${chosen.company} to Interviewing`} />
          Move {chosen.company} to Interviewing
        </label>
      )}

      {template && preview && (
        <div>
          <label className="flex w-fit cursor-pointer items-center gap-1 text-body">
            <Checkbox checked={prep} onChange={(e) => setPrep(e.target.checked)} label="Add the interview prep to-dos" />
            Add the “{template.name}” to-dos
          </label>
          <p className="-mt-1 ml-9 text-meta text-ink-muted">
            {preview.tasks.length} to-dos, dated around the interview
            {preview.movedToToday > 0 && `. ${preview.movedToToday} would already be past, so they're due today`}.
          </p>
        </div>
      )}
    </form>
  );
}
