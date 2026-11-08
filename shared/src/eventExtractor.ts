import * as chrono from 'chrono-node';
import { addDays, dayOfWeek } from './dateMath';
import { addMinutes, combine } from './dateTime';
import { DEFAULT_EVENT_TYPES, type EventRecurrence } from './models/events';

// Finding events in text: an interview confirmation, a syllabus, a flyer. chrono-node finds the dates and times ("Tuesday at 2:30", "Nov 4 - Nov 6", "next Friday").

type EventTypeName = (typeof DEFAULT_EVENT_TYPES)[number];

/** Keywords that suggest an event type, in priority order: the first type with a match wins. Whole words, any case. */
export const TYPE_KEYWORDS: { type: EventTypeName; words: string[] }[] = [
  { type: 'Interview', words: ['interview', 'phone screen', 'screening call', 'onsite', 'on-site'] },
  { type: 'Exam', words: ['exam', 'midterm', 'final', 'quiz', 'test'] },
  { type: 'Assignment Deadline', words: ['due', 'deadline', 'submit', 'submission', 'assignment', 'homework', 'problem set', 'lab report', 'essay', 'paper', 'project'] },
  { type: 'Meeting', words: ['meeting', 'office hours', 'check-in', 'standup', 'sync', 'call'] },
  { type: 'School Event', words: ['info session', 'information session', 'career fair', 'orientation', 'open house', 'seminar', 'commencement'] },
  { type: 'Org Event', words: ['workshop', 'rsvp', 'mixer', 'social', 'general body', 'networking', 'panel', 'hackathon', 'tabling', 'volunteer'] },
  { type: 'Personal', words: ['birthday', 'dentist', 'doctor', 'appointment', 'dinner', 'flight'] },
];

/** Words that make a line a good title. A line containing one of these beats a plain line. */
export const TITLE_KEYWORDS = [
  'interview', 'exam', 'midterm', 'final', 'quiz', 'test', 'due', 'deadline', 'submit', 'meeting', 'info session', 'career fair',
  'workshop', 'rsvp', 'assignment', 'homework', 'project', 'paper', 'essay', 'presentation', 'lab', 'office hours', 'orientation',
  'seminar', 'panel', 'hackathon', 'networking', 'mixer', 'call', 'session',
];

/** Lines starting with one of these are details ABOUT an event, never its title ("Location: ..."). */
export const DETAIL_LABELS = ['location', 'where', 'venue', 'place', 'address', 'when', 'date', 'time', 'from', 'to', 'cc', 'sent', 'rsvp', 'link', 'url', 'phone', 'email', 'contact', 'join', 'meeting id', 'passcode', 'password'];

/** Links to these hosts are preferred over other links, and name the place if there is no other location. */
export const LINK_HOSTS: { host: string; place: string }[] = [
  { host: 'zoom.us', place: 'Zoom' },
  { host: 'teams.microsoft.com', place: 'Microsoft Teams' },
  { host: 'teams.live.com', place: 'Microsoft Teams' },
  { host: 'meet.google.com', place: 'Google Meet' },
  { host: 'webex.com', place: 'Webex' },
];

/** Below this, a candidate is flagged and left unchecked in the review. */
export const LOW_CONFIDENCE = 0.5;

/** A document with more dates than this is treated as a schedule (see extractEvents). */
export const SCHEDULE_DATES = 3;

/** How long an event with a start time but no end time is assumed to last. */
export const DEFAULT_MINUTES = 60;

// ---------------------------------------------------------------------------------------------

export interface ExtractedItem {
  /** Stable within one extraction ("0", "1", ...). */
  id: string;
  title: string;
  /** Local datetime "YYYY-MM-DDTHH:mm". For an all-day item the time is 00:00 and `end` is exclusive. */
  start: string;
  end: string;
  allDay: boolean;
  typeName: EventTypeName | null;
  location: string | null;
  link: string | null;
  /** 0 to 1: how many of the useful fields were found. */
  confidence: number;
  /** `confidence` is below LOW_CONFIDENCE: the review flags it and leaves it unchecked. */
  lowConfidence: boolean;
  /** The lines around the date, shown under the card so you can see where it came from. */
  snippet: string;
  /** Where the date text is in the source (for highlighting). */
  charStart: number;
  charEnd: number;
  /** The type is a deadline ("due", "submit"): in syllabus mode these default to to-dos. */
  isDeadline: boolean;
  /** The date is before `now`. */
  past: boolean;
  /** Only for items from an .ics file: a repeat rule the planner can store. */
  recurrence?: EventRecurrence;
  /** Only for items from an .ics file: the description. */
  notes?: string | null;
}

export interface ExtractOptions {
  /** "Today", for relative dates ("next Friday") and for judging what is past. */
  now: Date;
  /** A syllabus lists dates already behind you ("Sep 3") as well as ahead, so a date with no year is read as the one in the current year, not the next one. */
  syllabus?: boolean;
}

interface Line {
  text: string;
  start: number;
  end: number;
  paragraph: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const wordRe = (words: string[]) => new RegExp(`\\b(?:${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')).join('|')})\\b`, 'i');
const TYPE_RES = TYPE_KEYWORDS.map((t) => ({ type: t.type, re: wordRe(t.words) }));
const TITLE_RE = wordRe(TITLE_KEYWORDS);
const DETAIL_RE = new RegExp(`^(?:${DETAIL_LABELS.join('|').replace(/ /g, '\\s+')})\\s*[:\\-–]`, 'i');
const URL_RE = /\bhttps?:\/\/[^\s<>"')\]]+/gi;
const BARE_ZOOM_RE = /\b(?:[\w-]+\.)?(?:zoom\.us|teams\.microsoft\.com|meet\.google\.com)\/[^\s<>"')\]]+/gi;

function splitLines(text: string): Line[] {
  const lines: Line[] = [];
  let offset = 0;
  let paragraph = 0;
  let lastBlank = true;
  for (const raw of text.split('\n')) {
    const blank = raw.trim() === '';
    if (blank && !lastBlank) paragraph++;
    lines.push({ text: raw, start: offset, end: offset + raw.length, paragraph });
    offset += raw.length + 1;
    lastBlank = blank;
  }
  return lines;
}

// ---- dates ------------------------------------------------------------------------------------

interface Stamp {
  date: string;
  /** null if no time was stated */
  time: string | null;
}

function stamp(c: chrono.ParsedComponents, now: Date): Stamp {
  const year = c.get('year') ?? now.getFullYear();
  const date = `${year}-${pad(c.get('month') ?? 1)}-${pad(c.get('day') ?? 1)}`;
  return { date, time: c.isCertain('hour') ? `${pad(c.get('hour') ?? 0)}:${pad(c.get('minute') ?? 0)}` : null };
}

/** "Friday, Jan 9" with no year: the year is whichever makes Jan 9 a Friday (nearest to now). chrono picks a year without checking the weekday it was told, which is wrong whenever the two disagree. */
function fixYearByWeekday(c: chrono.ParsedComponents, date: string, now: Date): string {
  if (c.isCertain('year') || !c.isCertain('weekday') || !c.isCertain('day')) return date;
  const want = c.get('weekday');
  if (want === null || dayOfWeek(date) === want) return date;
  const base = Number(date.slice(0, 4));
  const candidates = [0, 1, -1, 2, -2, 3, -3].map((d) => `${base + d}${date.slice(4)}`).filter((d) => dayOfWeek(d) === want);
  const nowMs = now.getTime();
  return candidates.sort((a, b) => Math.abs(new Date(`${a}T12:00`).getTime() - nowMs) - Math.abs(new Date(`${b}T12:00`).getTime() - nowMs))[0] ?? date;
}

interface DateHit {
  result: chrono.ParsedResult;
  line: number;
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
}

/** "45 minutes", "about 2 hours", "an hour": how LONG something is, not when it is. */
const DURATION_RE = /^(?:(?:about|around|approximately|roughly|for|last|within|in|after|another|over|under|at least|at most)\s+)*(?:\d+(?:\.\d+)?|an?|one|two|three|half an?)\s*(?:minutes?|mins?|hours?|hrs?|seconds?|secs?)\b/i;

function isNoise(r: chrono.ParsedResult): boolean {
  const text = r.text.trim();
  if (text.length < 3 && !/[:@]/.test(text)) return true;
  if (/^\d{1,2}$/.test(text)) return true; // a bare number is a count, not an hour
  if (DURATION_RE.test(text)) return true;
  return false;
}

/** Labels like "Week 8" and "Chapter 3" before a date: chrono would read "8 Oct 27" as the 8th of October 2027. */
const NUMBERED_LABEL_RE = /\b(?:week|wk|lecture|lec|class|session|unit|module|chapter|ch|part|day|no|lab)\.?\s*#?\d+\b/gi;

function lineOf(lines: Line[], index: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lines[mid]!.start <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** chrono reports "Date: Nov 9" and "Time: 2:30 PM" on separate lines as two results. */
function joinDatesAndTimes(hits: DateHit[], lines: Line[]): DateHit[] {
  const isDated = (h: DateHit) => h.result.start.isCertain('day') || h.result.start.isCertain('weekday') || h.result.start.isCertain('month');
  const dated = hits.filter(isDated);
  for (const t of hits.filter((h) => !isDated(h) && h.startTime !== null)) {
    const para = lines[t.line]!.paragraph;
    const rank = (d: DateHit) => (d.line === t.line ? 0 : d.line < t.line ? 1 : 2) + Math.abs(d.line - t.line) * 10;
    const target = dated
      .filter((d) => d.startTime === null && lines[d.line]!.paragraph === para && Math.abs(d.line - t.line) <= 2)
      .sort((a, b) => rank(a) - rank(b))[0];
    if (!target) continue;
    target.startTime = t.startTime;
    target.endTime = target.endTime ?? t.endTime;
  }
  return dated;
}

// ---- text around a date -----------------------------------------------------------------------

function collapse(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Remove link text, then tidy: bullets, labels like "Subject:", stray prepositions, trailing punctuation. */
function cleanTitle(raw: string): string {
  let t = raw.replace(URL_RE, ' ').replace(BARE_ZOOM_RE, ' ');
  t = collapse(t);
  t = t.replace(/^(?:[-*•·–—>\d]+[.)]?\s+)+/, ''); // bullets and "1." numbering
  t = t.replace(/^(?:subject|re|fwd?)\s*:\s*/i, '');
  for (let i = 0; i < 3; i++) {
    t = t.replace(/^(?:on|at|by|from|until|before|for|the)\b[\s:,-]*(?=\S)/i, '');
    t = t.replace(/\b(?:on|at|by|from|until|before|due|for|is|are|will be|scheduled for|scheduled|to be held|@)\s*$/i, '');
    t = t.replace(/[\s:;,.\-–—|·•]+$/, '').replace(/^[\s:;,.\-–—|·•]+/, '');
  }
  t = t.replace(/^["“'‘](.*)["”'’]$/, '$1');
  // "Problem Set 5 is due via Gradescope" -> "Problem Set 5"; "Your interview is scheduled for" -> "Your interview"
  t = t.replace(/\s+(?:is|are|will be|will take place|takes place|will start|starts?|begins?|ends?|due)\b.*$/i, '');
  t = t.replace(/^(?:your|the|our|this|my|a|an)\s+(?=\S+\s*\S*)/i, '').replace(/[\s:;,.\-–—|·•]+$/, '');
  t = collapse(t).slice(0, 120);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** A table row like "Week 5 | Quiz 2 | Ch 3-4": pick the cell that looks most like a title. */
function bestSegment(text: string): string {
  const segments = text.split(/\t|\||\s{3,}/).map((s) => s.trim()).filter((s) => /[a-z]{3}/i.test(s));
  if (segments.length <= 1) return text;
  return segments.find((s) => TITLE_RE.test(s)) ?? segments.sort((a, b) => b.length - a.length)[0]!;
}

const hasLetters = (s: string) => (s.match(/[a-z]/gi) ?? []).length >= 3;

/** A long sentence is no title. Shrink it to its event word plus who it's with ("Interview with Acme Corp"). */
function proseTitle(sentence: string): string {
  const hit = sentence.match(TITLE_RE) ?? sentence.match(wordRe(TYPE_KEYWORDS.flatMap((t) => t.words)));
  if (!hit) return collapse(sentence).slice(0, 60);
  const word = hit[0].replace(/\s+/g, ' ');
  const org = sentence.slice((hit.index ?? 0) + hit[0].length).match(/^\s+(?:with|at|for|from)\s+((?:[A-Z][\w&.'-]*)(?:\s+(?:[A-Z][\w&.'-]*|&|of|and)){0,3})/);
  const title = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  return org ? `${title} with ${org[1]}`.replace(/\s+(?:and|of|&)$/i, '') : title;
}

interface TitleCandidate {
  text: string;
  score: number;
}

function scoreTitle(text: string, base: number): TitleCandidate | null {
  const t = cleanTitle(text);
  if (!hasLetters(t) || DETAIL_RE.test(t) || /^(?:dear|hi|hello|hey|thanks|thank you|best|regards|sincerely)\b/i.test(t)) return null;
  const title = t.length > 90 ? proseTitle(t) : t;
  let score = base;
  if (TITLE_RE.test(title)) score += 3;
  if (title.length <= 80) score += 1;
  if (t.length > 90) score -= 1.5; // prose that had to be shrunk is a worse title than a real heading
  return { text: title, score };
}

// ---- location and link ------------------------------------------------------------------------

const LOCATION_LABEL_RE = /^\s*(?:location|where|venue|place|address)\s*[:\-–]\s*(.+?)\s*$/i;
const PLACE_RE = /\b((?:[A-Z][\w&'.-]*\s+){0,3}(?:Hall|Building|Center|Centre|Library|Auditorium|Union|Theater|Theatre|Gym|Gymnasium|Lab|Room|Rm\.?|Suite)\s*#?\w*\d*)\b/;
const ADDRESS_RE = /\b\d{1,5}\s+(?:[A-Z][\w.]*\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)\b\.?/;

function findLocation(window: string[]): string | null {
  for (const line of window) {
    const m = line.match(LOCATION_LABEL_RE);
    if (m) return collapse(m[1]!.replace(URL_RE, ' ')).slice(0, 120) || null;
  }
  for (const line of window) {
    const room = line.match(/\b(?:Room|Rm\.?)\s*#?\s*[\w-]*\d[\w-]*/i);
    const place = line.replace(URL_RE, ' ').match(PLACE_RE);
    if (place && /\d|Hall|Library|Auditorium|Union|Theat|Gym/i.test(place[1]!)) return collapse(place[1]!);
    if (room) return collapse(room[0]);
    const address = line.match(ADDRESS_RE);
    if (address) return collapse(address[0]);
  }
  return null;
}

export function findLink(window: string[]): string | null {
  const found = window.flatMap((line) => [...(line.match(URL_RE) ?? []), ...(line.match(BARE_ZOOM_RE) ?? []).filter((u) => !/^https?:/i.test(u)).map((u) => `https://${u}`)]);
  const clean = found.map((u) => u.replace(/[.,;:!?]+$/, ''));
  return clean.find((u) => LINK_HOSTS.some((h) => u.includes(h.host))) ?? clean[0] ?? null;
}

function placeOfLink(link: string | null): string | null {
  return link ? (LINK_HOSTS.find((h) => link.includes(h.host))?.place ?? null) : null;
}

export function guessEventType(title: string, snippet: string): EventTypeName | null {
  for (const { type, re } of TYPE_RES) if (re.test(title)) return type;
  for (const { type, re } of TYPE_RES) if (re.test(snippet)) return type;
  return null;
}

// ---- the main function ------------------------------------------------------------------------

/** Find the events in `text`. */
export function extractEvents(rawText: string, { now, syllabus = false }: ExtractOptions): ExtractedItem[] {
  const text = rawText.replace(/\r\n?/g, '\n').replace(/[\u00a0\u2007\u202f]/g, ' ');
  const lines = splitLines(text);
  const nowText = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

  // An email's own header lines ("Sent: Wednesday, November 4...") have dates that are not events.
  const blank = (m: string) => ' '.repeat(m.length);
  const searchable = text.replace(/^[ \t]*(?:sent|received|from|to|cc|bcc)[ \t]*:.*$/gim, blank).replace(NUMBERED_LABEL_RE, blank);

  // A date with no year is read as the next one coming (right for a flyer: "Jan 9" in November means next January).
  const looksLikeASchedule = syllabus || chrono.parse(searchable, now, { forwardDate: false }).filter((r) => !isNoise(r)).length > SCHEDULE_DATES;

  const allHits: DateHit[] = chrono
    .parse(searchable, now, { forwardDate: !looksLikeASchedule })
    .filter((r) => !isNoise(r))
    .map((r) => {
      const s = stamp(r.start, now);
      const e = r.end ? stamp(r.end, now) : null;
      return {
        result: r,
        line: lineOf(lines, r.index),
        startDate: fixYearByWeekday(r.start, s.date, now),
        endDate: e ? e.date : null,
        startTime: s.time,
        endTime: e ? e.time : null,
      };
    });
  const hits = joinDatesAndTimes(allHits, lines);

  const dateLines = new Set(hits.map((h) => h.line));
  const items: ExtractedItem[] = [];

  hits.forEach((hit, n) => {
    const own = lines[hit.line]!;
    const para = own.paragraph;

    // The lines this date "owns": its paragraph, but not reaching past a neighbouring date's line (in a list of due dates, each row is its own).
    let first = hit.line;
    while (first > 0 && lines[first - 1]!.paragraph === para && !dateLines.has(first - 1)) first--;
    let last = hit.line;
    while (last < lines.length - 1 && lines[last + 1]!.paragraph === para && !dateLines.has(last + 1)) last++;

    // A link or a place is often in the paragraph just AFTER the date ("Join Zoom: ..."), so look a little further for those, still stopping at the next date.
    let reach = last;
    while (reach < lines.length - 1 && reach - hit.line < 8 && !dateLines.has(reach + 1)) reach++;
    const detailWindow = lines.slice(first, reach + 1).map((l) => l.text);

    // Title: the date's own line (minus the date and time), the lines above it, the line below, an email's subject, or the document's heading.
    const onLine = allHits.filter((h) => h.line === hit.line);
    const datedOnLine = hits.filter((h) => h.line === hit.line);
    const rel = (h: DateHit) => [h.result.index - own.start, h.result.index + h.result.text.length - own.start] as const;
    const strip = (from: number, to: number) => {
      let out = '';
      let at = from;
      for (const [a, b] of onLine.map(rel).sort((x, y) => x[0] - y[0])) {
        if (b <= from || a >= to) continue;
        out += own.text.slice(at, Math.max(a, from)) + ' ';
        at = Math.min(b, to);
      }
      return out + own.text.slice(at, to);
    };
    const withoutDate = (() => {
      if (datedOnLine.length === 1) {
        // Several sentences on one line: only the one with the date.
        const [a, b] = rel(hit);
        const before = own.text.slice(0, a).search(/[.!?]\s+(?=[^.!?]*$)/);
        const from = before === -1 ? 0 : before + 1;
        const after = own.text.slice(b).search(/[.!?](?:\s|$)/);
        const to = after === -1 ? own.text.length : b + after + 1;
        return strip(from, to);
      }
      // Several dates on one line ("Quiz Oct 3, Exam Oct 17"): each owns the words just before it (else just after it).
      const mine = datedOnLine.indexOf(hit);
      const [a, b] = rel(hit);
      const prevEnd = mine > 0 ? rel(datedOnLine[mine - 1]!)[1] : 0;
      const nextStart = mine < datedOnLine.length - 1 ? rel(datedOnLine[mine + 1]!)[0] : own.text.length;
      const ahead = strip(prevEnd, a);
      return hasLetters(ahead) ? ahead : strip(b, nextStart);
    })();

    const candidates: (TitleCandidate | null)[] = [scoreTitle(bestSegment(withoutDate), 1.5)];
    for (let i = hit.line - 1, d = 1; i >= first && d <= 3; i--, d++) candidates.push(scoreTitle(lines[i]!.text, 1 - 0.3 * (d - 1)));
    if (hit.line < last) candidates.push(scoreTitle(lines[hit.line + 1]!.text, 0.5));
    const subject = lines.slice(0, 12).find((l) => /^\s*subject\s*:/i.test(l.text));
    if (subject && subject !== own) candidates.push(scoreTitle(subject.text, 4)); // an email's subject is the best title there is
    const heading = lines.find((l) => l.text.trim() !== '');
    if (heading && heading !== own) candidates.push(scoreTitle(heading.text, hits.length <= 3 ? 1.2 : -0.5));
    const best = candidates.filter((c): c is TitleCandidate => c !== null).sort((a, b) => b.score - a.score)[0];
    const roughLocation = findLocation(detailWindow);
    const title = cleanTitle((best?.text ?? '').replace(roughLocation ? new RegExp(roughLocation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : /$^/, ' '));
    const titleHasKeyword = TITLE_RE.test(title);

    // When and how long.
    const allDay = hit.startTime === null;
    const startDate = hit.startDate;
    let start = combine(startDate, hit.startTime ?? '00:00');
    let end: string;
    if (allDay) {
      end = combine(addDays(hit.endDate && hit.endDate > startDate ? hit.endDate : startDate, 1));
    } else if (hit.endTime) {
      end = combine(hit.endDate ?? startDate, hit.endTime);
      if (end <= start) end = addMinutes(start, DEFAULT_MINUTES); // "10pm - 1am" read as one day: assume the default length
    } else {
      end = addMinutes(start, DEFAULT_MINUTES);
    }
    if (start >= end) start = end;

    const snippetLines = lines.slice(first, last + 1).map((l) => collapse(l.text)).filter(Boolean);
    const snippet = snippetLines.join(' · ').slice(0, 320);
    const link = findLink(detailWindow);
    const location = findLocation(detailWindow) ?? placeOfLink(link);
    const typeName = guessEventType(title, snippet);

    // Confidence: the date is a given; each useful thing found beside it adds some.
    let confidence = 0.25;
    if (hit.startTime) confidence += 0.2;
    if (titleHasKeyword) confidence += 0.25;
    else if (title) confidence += 0.1;
    if (location) confidence += 0.1;
    if (link) confidence += 0.1;
    if (typeName) confidence += 0.1;

    items.push({
      id: String(n),
      title: title || 'Untitled',
      start,
      end,
      allDay,
      typeName,
      location,
      link,
      confidence: Math.min(1, Math.round(confidence * 100) / 100),
      lowConfidence: Math.min(1, Math.round(confidence * 100) / 100) < LOW_CONFIDENCE,
      snippet,
      charStart: hit.result.index,
      charEnd: hit.result.index + hit.result.text.length,
      isDeadline: typeName === 'Assignment Deadline',
      past: start < nowText,
    });
  });

  // The same thing mentioned twice (a date repeated in the body and in a reminder) is one item: same start, one title containing the other.
  const kept: ExtractedItem[] = [];
  for (const it of items) {
    const a = it.title.toLowerCase();
    const twin = kept.findIndex((k) => k.start === it.start && (k.title.toLowerCase().includes(a) || a.includes(k.title.toLowerCase())));
    if (twin === -1) kept.push(it);
    else if (it.confidence > kept[twin]!.confidence) kept[twin] = it;
  }
  return kept.sort((a, b) => a.charStart - b.charStart).map((it, i) => ({ ...it, id: String(i) }));
}
