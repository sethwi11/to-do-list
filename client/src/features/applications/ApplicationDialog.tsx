import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { APPLICATION_STATUSES, CreateApplicationInputSchema, DEADLINE_REMINDER_DAYS, type Application, type ApplicationStatus } from '@todo/shared';
import { useApp } from '../../app/AppContext';
import type { ApplicationFields } from '../../actions/useApplicationActions';
import { Button } from '../../ui/Button';
import { Field, Input, Select, Textarea } from '../../ui/fields';
import { Dialog } from '../../ui/Panel';
import { normalizeLink } from '../events/eventForm';

type Errors = Partial<Record<'company' | 'role' | 'jobLink' | 'contactEmail' | 'dateApplied' | 'deadline', string>>;

const MESSAGE: Errors = {
  company: 'Enter the company.',
  role: 'Enter the role.',
  jobLink: 'Enter a web link, like https://company.com/jobs/123.',
  contactEmail: 'Enter an email address, like name@company.com.',
  dateApplied: 'Enter a valid date.',
  deadline: 'Enter a valid date.',
};

/** Add an application, or change one (or delete it, after asking). */
export function ApplicationDialog() {
  const { dialog, closeDialog, applications, deleteApplication } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const open = dialog?.kind === 'application';
  const editing = open && dialog.id !== 'new' ? (applications.find((a) => a.id === dialog.id) ?? null) : null;
  const [confirming, setConfirming] = useState(false);

  const close = () => {
    setConfirming(false);
    closeDialog('application');
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={editing ? 'Edit application' : 'New application'}
      footer={
        confirming && editing ? (
          <>
            <p className="mr-auto max-w-72 self-center text-meta text-ink-muted">
              This deletes {editing.company}, its timeline and its notes for good. Its to-dos and events stay, no longer linked to it. To keep a record, move it to Withdrawn or Rejected instead.
            </p>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                void deleteApplication(editing).then((done) => {
                  if (!done) return;
                  close();
                  // Deleted from its own page: go back to the tracker rather than stay on "Application not found".
                  if (location.pathname === `/applications/${editing.id}`) navigate('/applications');
                });
              }}
            >
              Delete application
            </Button>
          </>
        ) : (
          <>
            {editing && (
              <Button variant="ghost" className="mr-auto text-danger" onClick={() => setConfirming(true)}>
                Delete
              </Button>
            )}
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="application-form">
              {editing ? 'Save' : 'Add application'}
            </Button>
          </>
        )
      }
    >
      {open && <ApplicationForm application={editing} onDone={close} />}
    </Dialog>
  );
}

function ApplicationForm({ application, onDone }: { application: Application | null; onDone: () => void }) {
  const { saveApplication } = useApp();
  const [company, setCompany] = useState(application?.company ?? '');
  const [role, setRole] = useState(application?.role ?? '');
  const [status, setStatus] = useState<ApplicationStatus>(application?.status ?? 'Wishlist');
  const [dateApplied, setDateApplied] = useState(application?.dateApplied ?? '');
  const [deadline, setDeadline] = useState(application?.deadline ?? '');
  const [location, setLocation] = useState(application?.location ?? '');
  const [jobLink, setJobLink] = useState(application?.jobLink ?? '');
  const [contactName, setContactName] = useState(application?.contactName ?? '');
  const [contactEmail, setContactEmail] = useState(application?.contactEmail ?? '');
  const [notes, setNotes] = useState(application?.notes ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const clear = (key: keyof Errors) => setErrors((e) => ({ ...e, [key]: undefined }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const [normalizedLink] = normalizeLink(jobLink);
    const fields: ApplicationFields = {
      company: company.trim(),
      role: role.trim(),
      location: location.trim() || null,
      jobLink: normalizedLink,
      status,
      dateApplied: dateApplied || null,
      deadline: deadline || null,
      contactName: contactName.trim() || null,
      contactEmail: contactEmail.trim() || null,
      notes: notes.trim() || null,
    };
    // The same schema the server checks with, so what's accepted here is accepted there.
    const checked = CreateApplicationInputSchema.safeParse(fields);
    const next: Errors = {};
    if (!checked.success) {
      for (const issue of checked.error.issues) {
        const key = issue.path[0] as keyof Errors;
        if (key in MESSAGE) next[key] ??= MESSAGE[key];
      }
    }
    if (jobLink.trim() && !normalizedLink) next.jobLink = MESSAGE.jobLink;
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    if (await saveApplication(fields, application ?? undefined)) onDone(); // on failure the dialog stays, so nothing typed is lost
  }

  // noValidate: the checks above show their messages in the app's own style, not the browser's bubbles.
  return (
    <form id="application-form" onSubmit={submit} noValidate className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Company" error={errors.company}>
          {(p) => <Input {...p} value={company} maxLength={100} data-autofocus placeholder="Stripe" onChange={(e) => { setCompany(e.target.value); clear('company'); }} />}
        </Field>
        <Field label="Role" error={errors.role}>
          {(p) => <Input {...p} value={role} maxLength={150} placeholder="Software Engineer Intern" onChange={(e) => { setRole(e.target.value); clear('role'); }} />}
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Status">
          {(p) => (
            <Select {...p} value={status} onChange={(e) => setStatus(e.target.value as ApplicationStatus)}>
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Date applied" error={errors.dateApplied}>
          {(p) => <Input {...p} type="date" value={dateApplied} onChange={(e) => { setDateApplied(e.target.value); clear('dateApplied'); }} />}
        </Field>
        <Field label="Deadline" error={errors.deadline}>
          {(p) => <Input {...p} type="date" value={deadline} onChange={(e) => { setDeadline(e.target.value); clear('deadline'); }} />}
        </Field>
      </div>
      <p className="-mt-2 text-meta text-ink-muted">
        {status === 'Wishlist'
          ? `A deadline on a wishlist application adds an “Apply to…” to-do, with a reminder ${DEADLINE_REMINDER_DAYS} days before.`
          : 'Moving to Applied (or later) with no date applied records today.'}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Location">{(p) => <Input {...p} value={location} maxLength={150} placeholder="Remote, or New York, NY" onChange={(e) => setLocation(e.target.value)} />}</Field>
        <Field label="Job link" error={errors.jobLink}>
          {(p) => <Input {...p} inputMode="url" value={jobLink} maxLength={2000} onChange={(e) => { setJobLink(e.target.value); clear('jobLink'); }} />}
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Contact name">{(p) => <Input {...p} value={contactName} maxLength={100} onChange={(e) => setContactName(e.target.value)} />}</Field>
        <Field label="Contact email" error={errors.contactEmail}>
          {(p) => <Input {...p} type="email" value={contactEmail} maxLength={200} onChange={(e) => { setContactEmail(e.target.value); clear('contactEmail'); }} />}
        </Field>
      </div>

      <Field label="Notes" hint="Markdown works: **bold**, - lists, [links](https://…).">
        {(p) => <Textarea {...p} value={notes} maxLength={20000} onChange={(e) => setNotes(e.target.value)} />}
      </Field>
    </form>
  );
}
