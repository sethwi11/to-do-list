import { describe, expect, it } from 'vitest';
import { extractEvents, LOW_CONFIDENCE } from '../src/extract';
import emailText from './samples/interview-email.txt?raw';
import flyerText from './samples/flyer.txt?raw';
import noDatesText from './samples/no-dates.txt?raw';
import syllabusText from './samples/syllabus.txt?raw';

// "Today" for every test: Friday, Nov 6, 2026, noon.
const NOW = new Date(2026, 10, 6, 12, 0);
const samples: Record<string, string> = { 'interview-email.txt': emailText, 'syllabus.txt': syllabusText, 'flyer.txt': flyerText, 'no-dates.txt': noDatesText };
const sample = (name: string) => samples[name]!;
const run = (text: string, syllabus = false) => extractEvents(text, { now: NOW, syllabus });
const byTitle = (items: ReturnType<typeof run>, part: string) => items.find((i) => i.title.toLowerCase().includes(part.toLowerCase()));

describe('an interview confirmation email', () => {
  const items = run(sample('interview-email.txt'));

  it('finds the one interview, and ignores the email header date', () => {
    expect(items).toHaveLength(1);
  });

  it('gets the title from the subject line, not the long sentence', () => {
    expect(items[0]!.title).toBe('Interview Confirmation – Acme Corp');
  });

  it('reads the date and time, and assumes an hour when no end is given', () => {
    expect(items[0]).toMatchObject({ start: '2026-11-10T14:30', end: '2026-11-10T15:30', allDay: false });
  });

  it('guesses the type, takes the Zoom link, and names the place after it', () => {
    expect(items[0]).toMatchObject({ typeName: 'Interview', link: 'https://acmecorp.zoom.us/j/98765432100?pwd=abc123', location: 'Zoom' });
  });

  it('is confident about it', () => {
    expect(items[0]!.confidence).toBeGreaterThanOrEqual(0.8);
    expect(items[0]!.past).toBe(false);
  });
});

describe('a syllabus', () => {
  const items = run(sample('syllabus.txt'), true);

  it('finds the dated rows, each with the title from its own row', () => {
    expect(byTitle(items, 'Quiz 1')).toMatchObject({ start: '2026-10-06T00:00', allDay: true, typeName: 'Exam' });
    expect(byTitle(items, 'Homework 4')).toMatchObject({ start: '2026-10-27T00:00', isDeadline: true });
    expect(byTitle(items, 'Midterm')).toMatchObject({ start: '2026-11-03T00:00', typeName: 'Exam' });
    expect(byTitle(items, 'Project proposal')).toMatchObject({ start: '2026-11-24T00:00', isDeadline: true });
  });

  it('reads a time and a room from the row that has them', () => {
    expect(byTitle(items, 'Final exam')).toMatchObject({ start: '2026-12-08T08:00', end: '2026-12-08T09:00', allDay: false, location: 'Room 120' });
  });

  it('finds a due date written in a sentence, with its time', () => {
    const ps = byTitle(items, 'Problem Set');
    expect(ps).toMatchObject({ start: '2026-11-13T23:59', isDeadline: true });
  });

  it('keeps dates already behind you in the current year, and says they are past', () => {
    expect(byTitle(items, 'Quiz 1')!.start.startsWith('2026-10-06')).toBe(true);
    expect(byTitle(items, 'Quiz 1')!.past).toBe(true);
    expect(byTitle(items, 'Project proposal')!.past).toBe(false);
  });

  it('reads the years the same way even if "syllabus" was not ticked, because a list of dates is a schedule', () => {
    const items = run(sample('syllabus.txt'), false);
    expect(byTitle(items, 'Quiz 1')!.start).toBe('2026-10-06T00:00');
    expect(byTitle(items, 'Homework 4')!.start).toBe('2026-10-27T00:00');
    expect(byTitle(items, 'Final exam')!.start).toBe('2026-12-08T08:00');
  });

  it('is unsure about a row with nothing but a date and a plain title', () => {
    const intro = byTitle(items, 'Introduction');
    expect(intro).toBeDefined();
    expect(intro!.confidence).toBeLessThan(LOW_CONFIDENCE);
  });

  it('is more sure about rows with an exam or deadline word', () => {
    expect(byTitle(items, 'Midterm')!.confidence).toBeGreaterThanOrEqual(LOW_CONFIDENCE);
  });
});

describe('a flyer', () => {
  const items = run(sample('flyer.txt'));

  it('takes the heading as the title when the date line has no words of its own', () => {
    expect(items).toHaveLength(1);
    expect(items[0]!.title).toBe('ACM CAREER PANEL');
  });

  it('reads the time range, location, link and type', () => {
    expect(items[0]).toMatchObject({
      start: '2026-11-12T18:00',
      end: '2026-11-12T19:30',
      location: 'Science Hall 210',
      link: 'https://forms.example.com/acm-panel',
      typeName: 'Org Event',
    });
  });
});

describe('a text with no dates', () => {
  it('finds nothing', () => {
    expect(run(sample('no-dates.txt'))).toEqual([]);
    expect(run('')).toEqual([]);
  });
});

describe('details', () => {
  it('makes an all-day event when there is no time, and an hour when there is a start time only', () => {
    expect(run('Career fair on Nov 18')[0]).toMatchObject({ start: '2026-11-18T00:00', end: '2026-11-19T00:00', allDay: true });
    expect(run('Workshop on Nov 18 at 3pm')[0]).toMatchObject({ start: '2026-11-18T15:00', end: '2026-11-18T16:00', allDay: false });
  });

  it('turns a date range into one all-day item that ends the day after the last day', () => {
    expect(run('Hackathon: Nov 20 - Nov 22')[0]).toMatchObject({ start: '2026-11-20T00:00', end: '2026-11-23T00:00', allDay: true });
  });

  it('joins a date and a time given on separate lines', () => {
    const [item] = run('Info Session\nDate: November 17\nTime: 4:30 PM');
    expect(item).toMatchObject({ title: 'Info Session', start: '2026-11-17T16:30', allDay: false });
    expect(run('Info Session\nDate: November 17\nTime: 4:30 PM')).toHaveLength(1);
  });

  it('resolves relative dates against today', () => {
    expect(run('Team meeting tomorrow at 10am')[0]).toMatchObject({ start: '2026-11-07T10:00', title: 'Team meeting' });
    expect(run('Exam next Monday')[0]!.start).toBe('2026-11-09T00:00');
  });

  it('picks the year that makes a weekday match, when a flyer gives none', () => {
    // Jan 9 is a Friday in 2026 but a Saturday in 2027... which is the next Friday Jan 9? 2026-01-09 is behind us, 2032 is not near: so the nearest match.
    const [item] = run('Career Fair, Friday, Jan 8 at 5pm');
    expect(new Date(`${item!.start}:00`).getDay()).toBe(5);
  });

  it('still reads a single yearless date as the next one coming', () => {
    expect(run('Career Fair, Jan 8 at 5pm')[0]!.start.startsWith('2027-01-08')).toBe(true);
  });

  it('gives each date on one line its own title', () => {
    const items = run('Quiz Oct 3, Exam Oct 17', true);
    expect(items.map((i) => `${i.title}|${i.start.slice(0, 10)}`)).toEqual(['Quiz|2026-10-03', 'Exam|2026-10-17']);
  });

  it('counts the same thing mentioned twice once', () => {
    expect(run('Interview Nov 10 at 2pm.\n\nReminder: Interview Nov 10 at 2pm.')).toHaveLength(1);
  });

  it('does not mistake a bare number for an hour', () => {
    expect(run('We sold 14 tickets and 3 shirts.')).toEqual([]);
  });
});
