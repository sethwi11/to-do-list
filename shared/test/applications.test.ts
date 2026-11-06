import { describe, expect, it } from 'vitest';
import {
  ApplicationSchema,
  BUILT_IN_TEMPLATES,
  DEADLINE_REMINDER_MINUTES,
  appliedDate,
  applicationStats,
  dateAppliedAfterMove,
  daysInStatus,
  deadlineReminderTitle,
  filterApplications,
  followUpSuggestions,
  followUpTask,
  goalProgress,
  guessApplication,
  planApplicationMove,
  planDeadlineReminder,
  prepTasksForEvent,
  sortApplications,
  stageCounts,
  weeklyApplied,
  type Application,
  type ApplicationStatus,
  type Task,
} from '../src';

// Times are written at noon UTC so "the day it was on this computer's clock" is the same date in any timezone.
const at = (date: string) => `${date}T12:00:00.000Z`;
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

/** An application whose timeline is the given statuses, one per day starting at `from`. */
function app(over: Partial<Application> & { history?: [ApplicationStatus, string][] } = {}): Application {
  const { history, ...rest } = over;
  const timeline = history ?? [['Wishlist', '2026-10-01']];
  const status = rest.status ?? timeline.at(-1)![0];
  return {
    id: id(),
    company: 'Acme',
    role: 'SWE Intern',
    location: null,
    jobLink: null,
    status,
    dateApplied: null,
    deadline: null,
    contactName: null,
    contactEmail: null,
    notes: null,
    sortOrder: 1024,
    followUpHandledAt: null,
    statusHistory: timeline.map(([s, d]) => ({ status: s, date: at(d) })),
    createdAt: at(timeline[0]![1]),
    updatedAt: at(timeline.at(-1)![1]),
    ...rest,
  };
}

const task = (over: Partial<Task> = {}): Task => ({
  id: id(),
  title: 'Apply to Acme (SWE Intern)',
  notes: null,
  dueDate: '2026-11-20',
  dueTime: null,
  priority: 'high',
  calendarId: null,
  courseId: null,
  applicationId: null,
  reminders: [DEADLINE_REMINDER_MINUTES],
  status: 'todo',
  subtasks: [],
  recurrence: 'none',
  estimatedMinutes: null,
  source: 'application-deadline',
  sourceSnippet: null,
  sortOrder: 0,
  createdAt: at('2026-11-01'),
  updatedAt: at('2026-11-01'),
  completedAt: null,
  nextOccurrenceId: null,
  ...over,
});

describe('the application model', () => {
  it('loads an old backup entry that has no followUpHandledAt', () => {
    const { followUpHandledAt: _gone, ...old } = app();
    expect(ApplicationSchema.parse(old).followUpHandledAt).toBeNull();
  });
});

describe('stats: applied, responded, interviewed', () => {
  const sent = app({ history: [['Wishlist', '2026-10-01'], ['Applied', '2026-10-05']] });
  const answered = app({ history: [['Wishlist', '2026-10-01'], ['Applied', '2026-10-05'], ['Online Assessment', '2026-10-09']] });
  const interviewedThenRejected = app({ history: [['Applied', '2026-10-02'], ['Interviewing', '2026-10-10'], ['Rejected', '2026-10-20']] });
  const rejectedFast = app({ history: [['Applied', '2026-10-02'], ['Rejected', '2026-10-04']] });
  const neverSent = app({ history: [['Wishlist', '2026-10-01']] });
  const wishlistThenWithdrawn = app({ history: [['Wishlist', '2026-10-01'], ['Withdrawn', '2026-10-03']] });
  const offer = app({ history: [['Applied', '2026-09-20'], ['Interviewing', '2026-10-01'], ['Offer', '2026-10-25']] });
  const all = [sent, answered, interviewedThenRejected, rejectedFast, neverSent, wishlistThenWithdrawn, offer];

  it('counts what was sent, ignoring wishlist items that were never applied to', () => {
    const s = applicationStats(all, '2026-11-04');
    expect(s.total).toBe(7);
    expect(s.applied).toBe(5);
  });

  it('counts a rejection as a response, but withdrawing is not one', () => {
    const s = applicationStats(all, '2026-11-04');
    // answered, interviewedThenRejected, rejectedFast, offer; `sent` has no reply yet
    expect(s.responded).toBe(4);
    expect(s.responseRate).toBeCloseTo(4 / 5);
  });

  it('counts an interview even if it later ended in a rejection', () => {
    const s = applicationStats(all, '2026-11-04');
    expect(s.interviewed).toBe(2); // interviewedThenRejected and offer
    expect(s.interviewRate).toBeCloseTo(2 / 5);
    expect(s.offers).toBe(1);
  });

  it('has no rates until something is sent', () => {
    const s = applicationStats([neverSent], '2026-11-04');
    expect(s.responseRate).toBeNull();
    expect(s.interviewRate).toBeNull();
    expect(s.perWeek).toBe(0);
  });

  it('treats an application with an applied date as sent even if its history only says Rejected', () => {
    const imported = app({ history: [['Rejected', '2026-10-08']], dateApplied: '2026-10-01' });
    expect(applicationStats([imported], '2026-11-04').applied).toBe(1);
  });

  it('takes the applied date from the entry, else from the day it left the wishlist', () => {
    expect(appliedDate(app({ dateApplied: '2026-09-30', history: [['Applied', '2026-10-05']] }))).toBe('2026-09-30');
    expect(appliedDate(sent)).toBe('2026-10-05');
    expect(appliedDate(neverSent)).toBeNull();
  });

  it('counts stages', () => {
    const c = stageCounts(all);
    expect(c.Applied).toBe(1);
    expect(c['Online Assessment']).toBe(1);
    expect(c.Rejected).toBe(2);
    expect(c.Wishlist).toBe(1);
    expect(c.Withdrawn).toBe(1);
    expect(c.Offer).toBe(1);
  });
});

describe('applications per week', () => {
  // 2026-11-04 is a Wednesday; weeks start on Sunday, so this week began 2026-11-01.
  const today = '2026-11-04';
  const sentOn = (d: string) => app({ dateApplied: d, history: [['Applied', d]] });

  it('buckets by calendar week, oldest first, ending with this week', () => {
    const weeks = weeklyApplied([sentOn('2026-11-02'), sentOn('2026-11-03'), sentOn('2026-10-28'), sentOn('2026-10-10')], today, 4);
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-10-11', '2026-10-18', '2026-10-25', '2026-11-01']);
    expect(weeks.map((w) => w.count)).toEqual([0, 0, 1, 2]); // the one on 10-10 is a week too old
  });

  it('averages the last four weeks and reports this week', () => {
    const s = applicationStats([sentOn('2026-11-02'), sentOn('2026-11-03'), sentOn('2026-10-28'), sentOn('2026-10-14')], today);
    expect(s.thisWeek).toBe(2);
    expect(s.perWeek).toBeCloseTo(4 / 4);
  });
});

describe('the offer goal', () => {
  const offer = app({ history: [['Applied', '2026-10-01'], ['Offer', '2026-10-20']] });
  const turnedDown = app({ history: [['Applied', '2026-10-01'], ['Offer', '2026-10-20'], ['Withdrawn', '2026-10-25']] });

  it('counts offers, including one you later turned down', () => {
    expect(goalProgress([offer, turnedDown, app()], 10, '2027-05-01', '2026-11-04').offers).toBe(2);
  });

  it('counts the days to the target date, negative once it has passed', () => {
    expect(goalProgress([], 10, '2026-11-14', '2026-11-04').daysLeft).toBe(10);
    expect(goalProgress([], 10, '2026-11-01', '2026-11-04').daysLeft).toBe(-3);
  });
});

describe('the follow-up suggestion', () => {
  const today = '2026-11-20';

  it('suggests a follow-up after 14 days in Applied, and not before', () => {
    const thirteen = app({ history: [['Applied', '2026-11-07']] });
    const fourteen = app({ history: [['Applied', '2026-11-06']] });
    const got = followUpSuggestions([thirteen, fourteen], today);
    expect(got.map((s) => s.application.id)).toEqual([fourteen.id]);
    expect(got[0]!.days).toBe(14);
  });

  it('only applies to Applied: other stages and the wishlist never get one', () => {
    const others = (['Wishlist', 'Online Assessment', 'Interviewing', 'Offer', 'Rejected', 'Withdrawn'] as const).map((s) => app({ history: [[s, '2026-10-01']] }));
    expect(followUpSuggestions(others, today)).toEqual([]);
  });

  it('counts from the date applied when you entered one', () => {
    const backdated = app({ dateApplied: '2026-10-25', history: [['Applied', '2026-11-18']] });
    expect(followUpSuggestions([backdated], today)[0]!.days).toBe(26);
  });

  it('stays away once handled, until the status changes again', () => {
    const handled = app({ history: [['Applied', '2026-10-20']], followUpHandledAt: at('2026-11-10') });
    expect(followUpSuggestions([handled], today)).toEqual([]);
    // it moved on (Applied -> Online Assessment) and back to Applied after the dismissal: judged afresh
    const movedAfter = app({ history: [['Applied', '2026-10-20'], ['Online Assessment', '2026-11-11'], ['Applied', '2026-11-12']], followUpHandledAt: at('2026-11-10') });
    expect(followUpSuggestions([movedAfter], '2026-11-30')).toHaveLength(1);
  });

  it('lists the longest wait first', () => {
    const a = app({ company: 'A', history: [['Applied', '2026-10-30']] });
    const b = app({ company: 'B', history: [['Applied', '2026-10-01']] });
    expect(followUpSuggestions([a, b], today).map((s) => s.application.company)).toEqual(['B', 'A']);
  });

  it('makes a to-do due today, linked to the application', () => {
    const a = app({ company: 'Globex', role: 'Data Intern', history: [['Applied', '2026-10-30']] });
    const [s] = followUpSuggestions([a], today);
    const t = followUpTask(s!, today, 'cal-1');
    expect(t).toMatchObject({ title: 'Follow up with Globex', dueDate: today, applicationId: a.id, calendarId: 'cal-1' });
    expect(t.notes).toContain('21 days');
  });

  it('measures days in the current status', () => {
    expect(daysInStatus(app({ history: [['Applied', '2026-11-10']] }), '2026-11-20')).toBe(10);
  });
});

describe('the wishlist-deadline reminder', () => {
  const today = '2026-11-04';
  const wishlist = app({ company: 'Stripe', role: 'Intern', deadline: '2026-11-20', jobLink: 'https://stripe.com/jobs/1', history: [['Wishlist', '2026-11-01']] });

  it('creates one to-do, due on the deadline, reminding three days before', () => {
    const plan = planDeadlineReminder(wishlist, [], today, 'cal-apps');
    expect(plan.create).toMatchObject({
      title: deadlineReminderTitle(wishlist),
      dueDate: '2026-11-20',
      reminders: [4320],
      applicationId: wishlist.id,
      calendarId: 'cal-apps',
      source: 'application-deadline',
    });
    expect(plan.update).toEqual([]);
  });

  it('makes nothing without a deadline, or for one that has already passed', () => {
    expect(planDeadlineReminder({ ...wishlist, deadline: null }, [], today, null)).toEqual({ create: null, update: [], complete: [], remove: [] });
    expect(planDeadlineReminder({ ...wishlist, deadline: '2026-11-01' }, [], today, null).create).toBeNull();
  });

  it('makes nothing for an application that is not on the wishlist', () => {
    expect(planDeadlineReminder({ ...wishlist, status: 'Applied' }, [], today, null).create).toBeNull();
  });

  it('does not make a second one, and follows a changed deadline or name', () => {
    const existing = task({ applicationId: wishlist.id, dueDate: '2026-11-20', title: deadlineReminderTitle(wishlist) });
    expect(planDeadlineReminder(wishlist, [existing], today, null)).toEqual({ create: null, update: [], complete: [], remove: [] });
    const moved = planDeadlineReminder({ ...wishlist, deadline: '2026-11-25' }, [existing], today, null);
    expect(moved.create).toBeNull();
    expect(moved.update).toEqual([{ id: existing.id, changes: { dueDate: '2026-11-25' } }]);
    const renamed = planDeadlineReminder({ ...wishlist, role: 'Software Intern' }, [existing], today, null);
    expect(renamed.update[0]!.changes.title).toBe('Apply to Stripe (Software Intern)');
  });

  it('ticks the to-do off when the application moves on', () => {
    const existing = task({ applicationId: wishlist.id });
    const plan = planDeadlineReminder({ ...wishlist, status: 'Applied' }, [existing], today, null);
    expect(plan.complete).toEqual([existing.id]);
  });

  it('removes the to-do when the deadline is cleared', () => {
    const existing = task({ applicationId: wishlist.id });
    expect(planDeadlineReminder({ ...wishlist, deadline: null }, [existing], today, null).remove).toEqual([existing.id]);
  });

  it('never recreates one you ticked off yourself, and ignores other to-dos', () => {
    const done = task({ applicationId: wishlist.id, status: 'done' });
    expect(planDeadlineReminder(wishlist, [done], today, null).create).toBeNull();
    const mine = task({ applicationId: wishlist.id, source: 'manual', title: 'Ask for a referral' });
    const other = task({ applicationId: 'someone-else' });
    const plan = planDeadlineReminder({ ...wishlist, status: 'Offer' }, [mine, other], today, null);
    expect(plan.complete).toEqual([]);
  });

  it('records today as the applied date only when it was empty and this means it was sent', () => {
    expect(dateAppliedAfterMove({ dateApplied: null }, 'Applied', today)).toBe(today);
    expect(dateAppliedAfterMove({ dateApplied: null }, 'Interviewing', today)).toBe(today);
    expect(dateAppliedAfterMove({ dateApplied: null }, 'Wishlist', today)).toBeUndefined();
    expect(dateAppliedAfterMove({ dateApplied: null }, 'Withdrawn', today)).toBeUndefined();
    expect(dateAppliedAfterMove({ dateApplied: '2026-10-01' }, 'Applied', today)).toBeUndefined();
  });
});

describe('prep to-dos for an interview', () => {
  const template = BUILT_IN_TEMPLATES.find((t) => t.name === 'Interview prep')!;
  const items = template.items.map((i, k) => ({ ...i, id: `item-${k}` }));
  const link = { applicationId: 'app-1', calendarId: 'cal-1' };

  it('dates each item relative to the interview', () => {
    const plan = prepTasksForEvent({ items }, { title: 'Stripe interview', start: '2026-11-20T10:00' }, '2026-11-04', link);
    const byTitle = Object.fromEntries(plan.tasks.map((t) => [t.title, t.dueDate]));
    expect(byTitle['Research the company']).toBe('2026-11-17');
    expect(byTitle['Prep 3 STAR stories']).toBe('2026-11-18');
    expect(byTitle['Test camera and mic']).toBe('2026-11-19');
    expect(byTitle['Send thank-you note']).toBe('2026-11-21');
    expect(plan.movedToToday).toBe(0);
    expect(plan.tasks.every((t) => t.applicationId === 'app-1' && t.calendarId === 'cal-1')).toBe(true);
    expect(plan.tasks[0]!.notes).toBe('Prep for “Stripe interview”');
  });

  it('puts items whose day has passed on today instead of overdue, and says how many', () => {
    // interview is tomorrow: the "3 days before" and "2 days before" items would be in the past
    const plan = prepTasksForEvent({ items }, { title: 'Stripe interview', start: '2026-11-05T10:00' }, '2026-11-04', link);
    expect(plan.tasks.every((t) => t.dueDate! >= '2026-11-04')).toBe(true);
    expect(plan.movedToToday).toBe(5);
  });

  it('lists them in the order they are due', () => {
    const plan = prepTasksForEvent({ items }, { title: 'x', start: '2026-11-20T10:00' }, '2026-11-04', link);
    const dates = plan.tasks.map((t) => t.dueDate!);
    expect([...dates].sort()).toEqual(dates);
  });

  it('works without an application', () => {
    const plan = prepTasksForEvent({ items }, { title: 'x', start: '2026-11-20T10:00' }, '2026-11-04', { applicationId: null, calendarId: null });
    expect(plan.tasks[0]!.applicationId).toBeNull();
  });
});

describe('the table: filter and sort', () => {
  const stripe = app({ company: 'Stripe', role: 'SWE Intern', location: 'Remote', deadline: '2026-12-01', dateApplied: '2026-10-10', history: [['Applied', '2026-10-10']], updatedAt: at('2026-10-11') });
  const acme = app({ company: 'acme', role: 'Data Intern', contactName: 'Sam Lee', dateApplied: '2026-09-15', history: [['Wishlist', '2026-09-01'], ['Interviewing', '2026-10-20']], updatedAt: at('2026-10-20') });
  const zed = app({ company: 'Zed', role: 'PM Intern', history: [['Wishlist', '2026-10-30']], updatedAt: at('2026-10-30') });
  const all = [stripe, acme, zed];

  it('filters by status, text (company, role, location, contact) and applied date', () => {
    expect(filterApplications(all, { status: 'Interviewing' })).toEqual([acme]);
    expect(filterApplications(all, { query: 'REMOTE' })).toEqual([stripe]);
    expect(filterApplications(all, { query: 'sam' })).toEqual([acme]);
    expect(filterApplications(all, { query: 'intern' })).toHaveLength(3);
    expect(filterApplications(all, { appliedFrom: '2026-10-01' })).toEqual([stripe]); // zed has no applied date
    expect(filterApplications(all, { appliedFrom: '2026-09-01', appliedTo: '2026-09-30' })).toEqual([acme]);
  });

  it('sorts by company ignoring case, in either direction', () => {
    expect(sortApplications(all, 'company', 'asc').map((a) => a.company)).toEqual(['acme', 'Stripe', 'Zed']);
    expect(sortApplications(all, 'company', 'desc').map((a) => a.company)).toEqual(['Zed', 'Stripe', 'acme']);
  });

  it('sorts by status in pipeline order', () => {
    expect(sortApplications(all, 'status', 'asc').map((a) => a.status)).toEqual(['Wishlist', 'Applied', 'Interviewing']);
  });

  it('always puts a missing date last', () => {
    expect(sortApplications(all, 'dateApplied', 'asc').map((a) => a.company)).toEqual(['acme', 'Stripe', 'Zed']);
    expect(sortApplications(all, 'dateApplied', 'desc').map((a) => a.company)).toEqual(['Stripe', 'acme', 'Zed']);
    expect(sortApplications(all, 'deadline', 'asc').map((a) => a.company)).toEqual(['Stripe', 'acme', 'Zed']);
  });

  it('does not change the list it was given', () => {
    const copy = [...all];
    sortApplications(all, 'company', 'desc');
    expect(all).toEqual(copy);
  });
});

describe('dropping a card on the board', () => {
  const card = (company: string, status: ApplicationStatus, sortOrder: number) => app({ company, status, sortOrder, history: [[status, '2026-10-01']] });
  const a = card('A', 'Applied', 1000);
  const b = card('B', 'Applied', 2000);
  const w = card('W', 'Wishlist', 5000);

  it('lands between its new neighbors', () => {
    const plan = planApplicationMove([a, b, w], w.id, 'Applied', b.id);
    expect(plan).toEqual({ status: 'Applied', sortOrder: 1500, renumber: null });
  });

  it('lands at the end of a column, or in an empty one', () => {
    expect(planApplicationMove([a, b, w], w.id, 'Applied', null).sortOrder).toBe(3024);
    expect(planApplicationMove([a, b, w], a.id, 'Interviewing', null).sortOrder).toBe(1024);
  });

  it('lands at the top of a column', () => {
    expect(planApplicationMove([a, b, w], w.id, 'Applied', a.id).sortOrder).toBe(1000 - 1024);
  });

  it('moves within a column without counting itself as a neighbor', () => {
    // drag A to just before B: its neighbors are nothing and B, so it goes above B (it was already there)
    expect(planApplicationMove([a, b], a.id, 'Applied', b.id).sortOrder).toBe(2000 - 1024);
    // drag A to the end
    expect(planApplicationMove([a, b], a.id, 'Applied', null).sortOrder).toBe(3024);
  });

  it('renumbers the column once the gaps have run out', () => {
    const x = card('X', 'Applied', 1);
    const y = card('Y', 'Applied', 1 + 1e-9);
    const plan = planApplicationMove([x, y, w], w.id, 'Applied', y.id);
    expect(plan.renumber?.map((r) => r.id)).toEqual([x.id, w.id, y.id]);
    expect(plan.renumber?.map((r) => r.sortOrder)).toEqual([1024, 2048, 3072]);
    expect(plan.sortOrder).toBe(2048);
  });

  it('treats an unknown neighbor as "the end"', () => {
    expect(planApplicationMove([a, b, w], w.id, 'Applied', 'nope').sortOrder).toBe(3024);
  });
});

describe('matching an interview to an application', () => {
  const stripe = app({ company: 'Stripe', history: [['Applied', '2026-10-01']] });
  const acme = app({ company: 'Acme Corp', history: [['Applied', '2026-10-01']] });
  const rejected = app({ company: 'Globex', history: [['Applied', '2026-10-01'], ['Rejected', '2026-10-10']] });
  const tiny = app({ company: 'AB', history: [['Applied', '2026-10-01']] });

  it('finds the one company named in the title, ignoring case', () => {
    expect(guessApplication('STRIPE phone screen', [stripe, acme])).toBe(stripe);
    expect(guessApplication('Interview with Acme Corp recruiter', [stripe, acme])).toBe(acme);
  });

  it('gives nothing when there is no match, or the match is ambiguous', () => {
    expect(guessApplication('Coffee with Sam', [stripe, acme])).toBeNull();
    const second = app({ company: 'Stripe', role: 'Data Intern', history: [['Applied', '2026-10-02']] });
    expect(guessApplication('Stripe interview', [stripe, second])).toBeNull();
  });

  it('skips closed applications and names too short to trust', () => {
    expect(guessApplication('Globex interview', [rejected])).toBeNull();
    expect(guessApplication('AB interview', [tiny])).toBeNull();
  });
});
