import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_TEMPLATES,
  CreateApplicationInputSchema,
  CreateCourseInputSchema,
  CreateEventInputSchema,
  CreateTimeBlockInputSchema,
  DEFAULT_CALENDARS,
  CALENDAR_COLORS,
  mergeSettings,
  DEFAULT_SETTINGS,
  toPaletteColor,
  UpdateEventInputSchema,
  UpdateSettingsInputSchema,
} from '../src';

const event = { title: 'Interview with Acme', start: '2026-11-10T14:00', end: '2026-11-10T15:00', allDay: false };

describe('events', () => {
  it('accepts a minimal event and rejects bad times', () => {
    expect(CreateEventInputSchema.safeParse(event).success).toBe(true);
    expect(CreateEventInputSchema.safeParse({ ...event, end: '2026-11-10T14:00' }).success).toBe(false); // zero length
    expect(CreateEventInputSchema.safeParse({ ...event, end: '2026-11-10T13:00' }).success).toBe(false);
    expect(CreateEventInputSchema.safeParse({ ...event, start: '2026-02-30T10:00' }).success).toBe(false); // not a real date
    expect(CreateEventInputSchema.safeParse({ ...event, start: '2026-11-10 14:00' }).success).toBe(false);
  });

  it('only allows http(s) links, since anything else could run code when clicked', () => {
    expect(CreateEventInputSchema.safeParse({ ...event, link: 'https://zoom.us/j/123' }).success).toBe(true);
    expect(CreateEventInputSchema.safeParse({ ...event, link: 'javascript:alert(1)' }).success).toBe(false);
    expect(CreateEventInputSchema.safeParse({ ...event, link: 'data:text/html,hi' }).success).toBe(false);
  });

  it('validates a recurrence rule', () => {
    const rule = { freq: 'weekly', byWeekday: [1, 3], until: '2026-12-11', exdates: ['2026-11-26'] };
    expect(CreateEventInputSchema.safeParse({ ...event, recurrence: rule }).success).toBe(true);
    expect(CreateEventInputSchema.safeParse({ ...event, recurrence: { ...rule, byWeekday: [7] } }).success).toBe(false);
    expect(CreateEventInputSchema.safeParse({ ...event, recurrence: { ...rule, freq: 'yearly' } }).success).toBe(false);
  });

  it('PATCH keeps partial updates partial (no defaults sneak in) and rejects an empty body', () => {
    expect(UpdateEventInputSchema.parse({ title: 'New title' })).toEqual({ title: 'New title' });
    expect(UpdateEventInputSchema.parse({ location: null })).toEqual({ location: null });
    expect(UpdateEventInputSchema.safeParse({}).success).toBe(false);
  });

  it('time blocks need a task and a positive length', () => {
    const block = { taskId: '00000000-0000-4000-8000-000000000001', start: '2026-11-10T09:00', end: '2026-11-10T10:00' };
    expect(CreateTimeBlockInputSchema.safeParse(block).success).toBe(true);
    expect(CreateTimeBlockInputSchema.safeParse({ ...block, end: '2026-11-10T09:00' }).success).toBe(false);
  });
});

describe('courses and applications', () => {
  it('a course needs meeting days and a class that ends after it starts', () => {
    const course = { semesterId: '00000000-0000-4000-8000-000000000001', name: 'COMP 365', meetingDays: [2, 4], startTime: '10:00', endTime: '11:15' };
    expect(CreateCourseInputSchema.safeParse(course).success).toBe(true);
    expect(CreateCourseInputSchema.safeParse({ ...course, meetingDays: [] }).success).toBe(false);
    expect(CreateCourseInputSchema.safeParse({ ...course, endTime: '09:00' }).success).toBe(false);
  });

  it('an application needs only a company and role, and a valid status/email', () => {
    expect(CreateApplicationInputSchema.safeParse({ company: 'Acme', role: 'SWE Intern' }).success).toBe(true);
    expect(CreateApplicationInputSchema.safeParse({ company: 'Acme', role: 'x', status: 'Ghosted' }).success).toBe(false);
    expect(CreateApplicationInputSchema.safeParse({ company: 'Acme', role: 'x', contactEmail: 'nope' }).success).toBe(false);
  });
});

describe('palette, templates, settings', () => {
  it('the default calendars all use palette colors', () => {
    expect(DEFAULT_CALENDARS.map((c) => c.name)).toEqual(['School', 'Work', 'Applications', 'ACM', 'Kappa Alpha Psi', 'Personal']);
    for (const c of DEFAULT_CALENDARS) expect(CALENDAR_COLORS).toContain(c.color);
  });

  it('translates old color names and survives unknown ones', () => {
    expect(toPaletteColor('amber')).toBe('ochre');
    expect(toPaletteColor('blue')).toBe('dusty-blue');
    expect(toPaletteColor('tomato')).toBe('tomato');
    expect(toPaletteColor('chartreuse')).toBe('slate');
  });

  it('built-in templates are the three requested checklists', () => {
    expect(BUILT_IN_TEMPLATES.map((t) => t.name)).toEqual(['Interview prep', 'Exam prep', 'Org event planning']);
    const thankYou = BUILT_IN_TEMPLATES[0]!.items.find((i) => i.title === 'Send thank-you note');
    expect(thankYou?.offsetDays).toBe(1); // 1 day after
  });

  it('settings merge one level deep, so changing one timer value keeps the rest', () => {
    const patch = UpdateSettingsInputSchema.parse({ focus: { focusMinutes: 50 }, offerGoal: 12 });
    const merged = mergeSettings(DEFAULT_SETTINGS, patch);
    expect(merged.focus).toEqual({ ...DEFAULT_SETTINGS.focus, focusMinutes: 50 });
    expect(merged.offerGoal).toBe(12);
    expect(merged.offerTargetDate).toBe('2027-05-01');
  });
});
