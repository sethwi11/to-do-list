import { describe, expect, it } from 'vitest';
import { expandOccurrences, type Event } from '../src';
import { importIcs } from '../src/extract';

const NOW = new Date(2026, 10, 6, 12, 0); // Fri Nov 6, 2026, noon (local)
const pad = (n: number) => String(n).padStart(2, '0');
const localOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const calendar = (...events: string[]) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', ...events, 'END:VCALENDAR'].join('\r\n');
const vevent = (...lines: string[]) => ['BEGIN:VEVENT', 'UID:' + (lines.find((l) => l.startsWith('UID:'))?.slice(4) ?? 'a@test'), ...lines.filter((l) => !l.startsWith('UID:')), 'END:VEVENT'].join('\r\n');
const run = (...events: string[]) => importIcs(calendar(...events), { now: NOW });

describe('importIcs: single events', () => {
  it('converts a UTC time to this computer\'s local time', () => {
    const { items } = run(vevent('DTSTART:20261110T190000Z', 'DTEND:20261110T200000Z', 'SUMMARY:Team sync', 'LOCATION:Room 4'));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: 'Team sync', location: 'Room 4', allDay: false, confidence: 1 });
    expect(items[0]!.start).toBe(localOf(new Date(Date.UTC(2026, 10, 10, 19, 0))));
    expect(items[0]!.end).toBe(localOf(new Date(Date.UTC(2026, 10, 10, 20, 0))));
  });

  it('reads a floating time as written', () => {
    const { items } = run(vevent('DTSTART:20261110T143000', 'DTEND:20261110T153000', 'SUMMARY:Lunch'));
    expect(items[0]).toMatchObject({ start: '2026-11-10T14:30', end: '2026-11-10T15:30' });
  });

  it('understands a named time zone using the zone rules in the file', () => {
    const tz = [
      'BEGIN:VTIMEZONE', 'TZID:America/New_York',
      'BEGIN:STANDARD', 'DTSTART:19701101T020000', 'TZOFFSETFROM:-0400', 'TZOFFSETTO:-0500', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD',
      'BEGIN:DAYLIGHT', 'DTSTART:19700308T020000', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0400', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
      'END:VTIMEZONE',
    ].join('\r\n');
    const { items } = importIcs(calendar(tz, vevent('DTSTART;TZID=America/New_York:20261110T140000', 'DTEND;TZID=America/New_York:20261110T150000', 'SUMMARY:Interview')), { now: NOW });
    // 2 PM Eastern (standard time in November) is 19:00 UTC.
    expect(items[0]!.start).toBe(localOf(new Date(Date.UTC(2026, 10, 10, 19, 0))));
  });

  it('keeps an all-day event all-day, ending the day after its last day', () => {
    const { items } = run(vevent('DTSTART;VALUE=DATE:20261120', 'DTEND;VALUE=DATE:20261122', 'SUMMARY:Retreat'));
    expect(items[0]).toMatchObject({ allDay: true, start: '2026-11-20T00:00', end: '2026-11-22T00:00' });
  });

  it('gives an event with no end a sensible one', () => {
    expect(run(vevent('DTSTART:20261110T143000', 'SUMMARY:Call')).items[0]).toMatchObject({ end: '2026-11-10T15:30' });
    expect(run(vevent('DTSTART;VALUE=DATE:20261120', 'SUMMARY:Holiday')).items[0]).toMatchObject({ end: '2026-11-21T00:00' });
  });

  it('takes the link from the location or description, and the description as notes', () => {
    const { items } = run(vevent('DTSTART:20261110T143000', 'DTEND:20261110T153000', 'SUMMARY:Standup', 'DESCRIPTION:Join https://acme.zoom.us/j/123 please'));
    expect(items[0]).toMatchObject({ link: 'https://acme.zoom.us/j/123', notes: 'Join https://acme.zoom.us/j/123 please' });
  });

  it('guesses a type from the title', () => {
    expect(run(vevent('DTSTART:20261110T143000', 'SUMMARY:Midterm exam')).items[0]!.typeName).toBe('Exam');
  });
});

describe('importIcs: repeating events', () => {
  const first = '20261102T100000'; // a Monday

  it('maps a weekly Mon/Wed/Fri rule with an end date to one repeating event', () => {
    const { items, notes } = run(vevent(`DTSTART:${first}`, `DTEND:20261102T111500`, 'SUMMARY:Class', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261211T235959'));
    expect(items).toHaveLength(1);
    expect(items[0]!.recurrence).toEqual({ freq: 'weekly', byWeekday: [1, 3, 5], until: '2026-12-11', exdates: [] });
    expect(notes).toEqual([]);
  });

  it('knows Monday to Friday as "weekdays", and a plain weekly rule as the start day', () => {
    expect(run(vevent(`DTSTART:${first}`, 'SUMMARY:A', 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')).items[0]!.recurrence).toMatchObject({ freq: 'weekdays' });
    expect(run(vevent(`DTSTART:${first}`, 'SUMMARY:B', 'RRULE:FREQ=WEEKLY')).items[0]!.recurrence).toMatchObject({ freq: 'weekly', byWeekday: null });
    expect(run(vevent(`DTSTART:${first}`, 'SUMMARY:C', 'RRULE:FREQ=DAILY')).items[0]!.recurrence).toMatchObject({ freq: 'daily' });
    expect(run(vevent(`DTSTART:${first}`, 'SUMMARY:D', 'RRULE:FREQ=MONTHLY')).items[0]!.recurrence).toMatchObject({ freq: 'monthly' });
  });

  it('turns a count into an end date', () => {
    expect(run(vevent(`DTSTART:${first}`, 'SUMMARY:E', 'RRULE:FREQ=WEEKLY;COUNT=4')).items[0]!.recurrence!.until).toBe('2026-11-23');
  });

  it('keeps excluded dates, and turns a changed occurrence into its own event', () => {
    const { items } = run(
      vevent('UID:class@test', `DTSTART:${first}`, 'DTEND:20261102T111500', 'SUMMARY:Class', 'RRULE:FREQ=WEEKLY;COUNT=6', 'EXDATE:20261109T100000'),
      vevent('UID:class@test', 'RECURRENCE-ID:20261116T100000', 'DTSTART:20261116T140000', 'DTEND:20261116T151500', 'SUMMARY:Class (moved)'),
    );
    const series = items.find((i) => i.recurrence)!;
    expect(series.recurrence!.exdates).toEqual(['2026-11-09', '2026-11-16']);
    expect(items.find((i) => i.title === 'Class (moved)')).toMatchObject({ start: '2026-11-16T14:00' });
    expect(items).toHaveLength(2);
  });

  it('gives the planner what it needs to rebuild the same dates', () => {
    const { items } = run(vevent(`DTSTART:${first}`, 'DTEND:20261102T111500', 'SUMMARY:Class', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261118T000000', 'EXDATE:20261109T100000'));
    const series = { ...items[0]!, id: 's', recurrence: items[0]!.recurrence! } as unknown as Event;
    const dates = expandOccurrences([series], '2026-11-01', '2026-12-01').map((o) => o.start.slice(0, 10));
    expect(dates).toEqual(['2026-11-02', '2026-11-04', '2026-11-11', '2026-11-16', '2026-11-18']);
  });

  it('writes out a repeat it cannot store as separate events, and says so', () => {
    const { items, notes } = run(vevent('DTSTART:20261110T100000', 'DTEND:20261110T110000', 'SUMMARY:Biweekly review', 'RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=4'));
    expect(items.map((i) => i.start.slice(0, 10))).toEqual(['2026-11-10', '2026-11-24', '2026-12-08', '2026-12-22']);
    expect(items.every((i) => !i.recurrence)).toBe(true);
    expect(notes[0]).toContain('Biweekly review');
  });
});

describe('importIcs: old and odd files', () => {
  it('leaves out events that are long over, and counts them', () => {
    const r = run(vevent('DTSTART:20250310T100000Z', 'DTEND:20250310T110000Z', 'SUMMARY:Old'), vevent('UID:b@test', 'DTSTART:20261110T100000Z', 'DTEND:20261110T110000Z', 'SUMMARY:New'));
    expect(r.items.map((i) => i.title)).toEqual(['New']);
    expect(r.skippedOld).toBe(1);
  });

  it('leaves out a repeat that ended long ago', () => {
    const r = run(vevent('DTSTART:20240102T100000', 'SUMMARY:Old class', 'RRULE:FREQ=WEEKLY;UNTIL=20240601T000000'));
    expect(r.items).toEqual([]);
    expect(r.skippedOld).toBe(1);
  });

  it('refuses a file that is not a calendar, with a message to show', () => {
    expect(() => importIcs('hello there', { now: NOW })).toThrow(/calendar \(.ics\) file/);
    expect(() => importIcs('BEGIN:VCARD\r\nEND:VCARD', { now: NOW })).toThrow(/calendar/);
  });

  it('sorts by start and numbers the results', () => {
    const r = run(vevent('UID:a@test', 'DTSTART:20261112T100000', 'SUMMARY:B'), vevent('UID:b@test', 'DTSTART:20261110T100000', 'SUMMARY:A'));
    expect(r.items.map((i) => `${i.id}:${i.title}`)).toEqual(['0:A', '1:B']);
  });
});
