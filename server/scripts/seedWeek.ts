import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { z } from 'zod';
import {
  addDays,
  CalendarColorSchema,
  dayOfWeek,
  ExcludedRangeSchema,
  LocalDateSchema,
  LocalTimeSchema,
  MeetingWindowSchema,
  planCourseSchedule,
  RoutineDaySchema,
  RoutinePrioritySchema,
  type RoutineBlock,
} from '@todo/shared';
import { openDatabase } from '../src/db/connection';
import { env } from '../src/env';
import { createRepositories } from '../src/repositories';

// Loads a week from a private JSON file (default .private/seed-week.json). Safe to run twice: it backs up first and skips what exists.

const Seed = z.object({
  categories: z.array(z.object({ name: z.string().min(1), color: CalendarColorSchema })),
  semester: z.object({ name: z.string().min(1), startDate: LocalDateSchema, endDate: LocalDateSchema, excludedRanges: z.array(ExcludedRangeSchema) }),
  courses: z.array(z.object({ code: z.string(), name: z.string(), category: z.string(), meetingDays: z.array(z.number().int().min(0).max(6)).min(1), startTime: LocalTimeSchema, endTime: LocalTimeSchema })),
  template: z.object({ name: z.string().min(1), effectiveFrom: LocalDateSchema, effectiveTo: LocalDateSchema.nullable(), days: z.array(RoutineDaySchema), meetingWindows: z.array(MeetingWindowSchema) }),
  blocks: z.array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      start: LocalTimeSchema,
      end: LocalTimeSchema,
      title: z.string().min(1),
      category: z.string().nullable(),
      priority: RoutinePrioritySchema.default('normal'),
      focus: z.boolean().default(false),
      soundtrack: z.string().nullable().default(null),
      schoolDaysOnly: z.boolean().default(false),
      alt: z.object({ title: z.string(), category: z.string() }).nullable().default(null),
      notes: z.string().nullable().default(null),
    }),
  ),
  reminders: z.array(z.object({ title: z.string().min(1), weekday: z.number().int().min(0).max(6), time: LocalTimeSchema, category: z.string(), message: z.string().nullable() })),
  assumed: z.array(z.string()),
});

const file = path.resolve(import.meta.dirname, '../..', process.env.SEED_FILE ?? '.private/seed-week.json');
const seed = Seed.parse(JSON.parse(fs.readFileSync(file, 'utf8')));

// A copy of the database before anything changes, next to the automatic migration backups.
if (fs.existsSync(env.DB_PATH)) {
  const dir = path.join(path.dirname(env.DB_PATH), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, `todo-seed-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
  const source = new Database(env.DB_PATH, { readonly: true });
  source.prepare('VACUUM INTO ?').run(target);
  source.close();
  console.log(`Backed up the database to ${target}`);
}

const db = openDatabase(env.DB_PATH);
const r = createRepositories(db);
const log = (s: string) => console.log(`  ${s}`);
const now = new Date().toISOString();
const today = now.slice(0, 10);

console.log('Categories');
const calendars = await r.calendars.list();
const calendarId = new Map<string, string>();
for (const c of seed.categories) {
  const found = calendars.find((x) => x.name.toLowerCase() === c.name.toLowerCase());
  if (!found) {
    calendarId.set(c.name, (await r.calendars.create({ name: c.name, color: c.color })).id);
    log(`added ${c.name}`);
  } else {
    calendarId.set(c.name, found.id);
    if (found.color !== c.color) {
      await r.calendars.update(found.id, { color: c.color });
      log(`recolored ${c.name}: ${found.color} -> ${c.color}`);
    }
  }
}
const cal = (name: string | null) => {
  if (name === null) return null;
  const id = calendarId.get(name);
  if (!id) throw new Error(`"${name}" is not in categories`);
  return id;
};

console.log('Semester and courses');
let semester = (await r.semesters.list()).find((s) => s.name === seed.semester.name);
if (!semester) {
  semester = await r.semesters.create(seed.semester);
  log(`added ${semester.name}`);
}
const classType = (await r.eventTypes.list()).find((t) => t.name === 'Class');
const existingCourses = await r.courses.list();
for (const c of seed.courses) {
  if (existingCourses.some((x) => x.semesterId === semester.id && x.code === c.code)) continue;
  const color = seed.categories.find((x) => x.name === c.category)!.color;
  const course = await r.courses.create({ semesterId: semester.id, code: c.code, name: c.name, color, calendarId: cal(c.category), meetingDays: c.meetingDays, startTime: c.startTime, endTime: c.endTime });
  const plan = planCourseSchedule({ course, semester, events: await r.events.list(), ctx: { typeId: classType?.id ?? null, now, newId: randomUUID } });
  await r.events.applyBatch(plan);
  log(`added ${c.code} and its classes`);
}

console.log('Week template');
if ((await r.weekTemplates.list()).some((t) => t.name === seed.template.name)) {
  log(`"${seed.template.name}" already exists, so its blocks were left alone`);
} else {
  const template = await r.weekTemplates.create(seed.template);
  const put: RoutineBlock[] = seed.blocks.map((b) => ({
    id: randomUUID(),
    templateId: template.id,
    weekday: b.weekday,
    start: b.start,
    end: b.end,
    title: b.title,
    calendarId: cal(b.category),
    altTitle: b.alt?.title ?? null,
    altCalendarId: b.alt ? cal(b.alt.category) : null,
    priority: b.priority,
    focus: b.focus,
    soundtrack: b.soundtrack,
    notify: true,
    schoolDaysOnly: b.schoolDaysOnly,
    notes: b.notes,
    createdAt: now,
    updatedAt: now,
  }));
  await r.routineBlocks.applyBatch({ put, remove: [] });
  log(`added "${template.name}" with ${put.length} blocks`);
}

console.log('Weekly reminders (to-dos)');
const tasks = await r.tasks.list();
for (const m of seed.reminders) {
  if (tasks.some((t) => t.title === m.title && t.recurrence === 'weekly' && t.dueTime === m.time && t.dueDate !== null && dayOfWeek(t.dueDate) === m.weekday)) continue;
  const dueDate = addDays(today, (m.weekday - dayOfWeek(today) + 7) % 7);
  await r.tasks.create({ title: m.title, notes: m.message, dueDate, dueTime: m.time, recurrence: 'weekly', calendarId: cal(m.category) });
  log(`added "${m.title}"`);
}

console.log('\nAssumed (please confirm or edit):');
for (const a of seed.assumed) log(`- ${a}`);
db.close();
