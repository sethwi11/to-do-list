# Planner

A personal planner built from a to-do app: tasks, a calendar, courses, an internship tracker and time blocking today, with a weekly routine, reminders, focus mode, money tracking and a weekly review being added phase by phase (see the roadmap). **It runs entirely on your computer. No accounts, no API keys, no paid services.**

> Work in progress. The full README (every feature, supported file types, shortcuts, installing on your phone) arrives in the last phase.

## What works today

- **Calendar** with Month, Week, Day, and Agenda views: drag across empty time to add an event, drag an event to move it, drag its edge to resize it, click one for its details. Events can repeat (every day, weekday, week on chosen days, or month) and you choose whether a change applies to *this event*, *this and following*, or *all events*
- **To-dos on the calendar**: dashed, checkable, and draggable to a new day or time. Calendars can be hidden from the sidebar, and events, to-dos and time blocks can be switched off separately
- **Time blocking**: set time aside to work on a to-do. Drag a to-do from the list beside the Week or Day calendar onto a time (or use the schedule button on any to-do, which works from the keyboard and on a phone). Blocks are hatched, move and resize like events, and show up on Today. A to-do can have several, and its row shows the total time set aside
- **Workload map**: in Month view, turn on *Workload* to shade each day by how heavy it is (four shades, with a legend), and hover a day for "2 events, 4h scheduled, 3 tasks due"
- **Add events from files**: drop in (or paste, or pick) a screenshot, PDF, Word document, text file or calendar (.ics) file, review what was found, and add it. Pictures and scanned PDFs are read on your computer with OCR; nothing is uploaded until you press Add
- **Attachments**: the original file is kept and attached to everything made from it; you can attach files to any event or to-do yourself, and open them in a preview
- **Today** page: the day's schedule as a timeline (with a line for the current moment), an "Up next" card with a live countdown and join link, to-dos and overdue beside it, and a summary line ("5 events · 3 tasks · 2 overdue")
- **Conflict warnings**: if an event overlaps another, you're told when you pick the time, on the Today timeline, in an event's details, and after a drag. You are warned, never blocked
- **Courses**: set up a semester (dates and breaks such as Thanksgiving), add each class with its meeting days, times, room and instructor, and every meeting appears on the calendar. Cancel or move a single class, import a syllabus from the course's page, and archive a finished semester without deleting anything
- **Applications**: an internship tracker with a board (drag a card to change its status) and a sortable, filterable table, an offer goal with a progress bar, response and interview rates, a "time to follow up?" nudge after 14 days of silence, and a page for each application with its timeline, interviews, to-dos, files and notes. A new Interview event asks which application it belongs to and offers the prep checklist
- **Tasks** page with tabs (All, Upcoming, Overdue, Completed), search, filters, sorting, and drag-to-reorder
- Tasks with subtasks, priorities, due dates and times, recurrence, estimates, and notes
- **Calendars** (color-coded areas of life such as School, ACM, Personal): create, rename, recolor, delete, and filter the task list by one
- Quick-add on every page, a mini month in the sidebar (dots mark days with events or open tasks), and a New menu
- Undo for delete, complete, and every calendar change; keyboard shortcuts (press `?`); dark mode; JSON export and import
- Works on a phone-width screen: the sidebar becomes a drawer, the calendar opens on the Agenda, and a + button replaces the New menu
- Data foundation for everything coming next: templates, focus sessions, weekly reviews

## Roadmap

Built one phase at a time; each is reviewed before it's merged.

| Phase | What it adds |
| --- | --- |
| 10 | **Weekly routine and the Today agenda.** A week template of routine blocks (with wake and bed times, and dates it applies to), one function that plans each day from the routine, classes, events and time blocks, a color-coded Today agenda with a Now card, a morning view, and 12-hour times everywhere |
| 11 | **When plans change.** Events take over the routine blocks they overlap, by clear priority rules; bumped time is tracked and can be made up; one-day skip / move / replace; "find a time" |
| 12 | **Pop-ups and reminders.** Start and stop notifications for each block, and delivery of the reminders the app already stores (to-dos, events, application deadlines); the app keeps running in the background |
| 13 | **Focus mode, streaks and the daily check-in.** The Pomodoro focus timer, click-to-play soundtracks, streaks, and a one-minute end-of-day check-in |
| 14 | **Money.** A monthly spending budget, savings goals, and investments entered by hand (tracking only: no bank connection, no live prices, no advice) |
| 15 | **Goals and the weekly review.** Goals and milestones, badges earned from real data, a weekly scoreboard, and a weekly review that ends with a summary to copy |

**Later:** voice quick-add, a command palette and the full set of keyboard shortcuts; phone access as an installable app (with a login first, since the API has none); `.ics` export; a templates screen; a real estate deal calculator; live prices, if a free source with no key exists.

## Setup

Requires Node 20.19+ (Node 22 recommended).

> Keep the project **out of iCloud-synced folders** (Desktop, Documents). iCloud evicts `node_modules` files to the cloud, and the dev servers then hang.

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. The API runs on port 3001 and Vite proxies `/api` to it. A `.env` file is optional; see `.env.example` for the two settings it can change.

| Command | What it does |
| --- | --- |
| `npm run dev` | API server + web app with hot reload |
| `npm test` | All unit and API tests (Vitest) |
| `npm run typecheck` | Type-checks every package |

## Adding events from files

Drag a file onto any page, paste a screenshot (Ctrl/Cmd+V), use **New > Import file**, or the **Import from file** button on the calendar. Several files at once are fine, up to 15 MB each.

| File | How it's read |
| --- | --- |
| PNG, JPG, WEBP pictures, pasted screenshots | OCR (text recognition) with tesseract.js, in your browser |
| PDF | the text is read directly; a page with almost no text is treated as a scan, drawn, and OCR'd |
| .docx | mammoth |
| .txt | read as is |
| .ics (Google Calendar, Outlook, Canvas...) | read with ical.js: exact, no guessing; a repeat the planner can store becomes one repeating event, one it can't ("every 2 weeks") is written out as separate events and you're told |
| HEIC | works in browsers that can open them (Safari); otherwise you're asked to convert to JPG or PNG |
| .doc, .pages, anything else | refused, with a message to save as PDF or .docx |

**Nothing is added until you say so.** The Review shows the file beside everything found in it. Each card has every field editable, a checkbox, an Event / To-do choice, and the words it came from. Doubtful cards are flagged and start unchecked: low confidence, already past, or like something already on your calendar (or already found in this import). "This is a syllabus" turns deadlines into to-dos with reminders 3 days and 1 day before, and a course can be chosen once courses exist.

- **No outside services.** The OCR worker, engine and English data are served from the app itself (`/ocr/`, set up in `client/vite.config.ts`), so nothing about a picture leaves the computer. The first picture takes a few seconds longer while the 3 MB of language data loads; it is remembered afterwards. Small pictures are enlarged before reading, since OCR struggles with small text.
- **Tuning the guessing.** `shared/src/eventExtractor.ts` starts with the word lists (event types, title words, detail labels, meeting links) and the confidence threshold. Add a word, run `npm test`, and the sample documents in `shared/test/samples/` show what changed.
- **The guesses are heuristics.** Titles come from nearby lines, preferring ones with words like *interview*, *exam* or *due*; dates come from chrono-node. A date with no year is read as the next one coming, except in a document with several dates (a schedule), where it means this year's.

### Where files live

Uploaded originals are stored in `server/data/uploads/`, next to the database (change with `UPLOADS_DIR`). They are renamed to a generated id; the type is decided from the extension and the file's first bytes (never from what the browser says), and files are served with headers that stop a browser from running anything in them. **Export JSON does not include the files**, only their records: to back up everything, also copy `server/data/uploads/`.

Deleting an event or to-do whose files nothing else uses asks whether to delete the files too. If you say yes, the files are removed only after the Undo window has passed, so Undo still brings everything back.

## Your data

Everything lives in one SQLite file, `server/data/todo.db`. It is not in git and is never touched by code changes.

- **Automatic backups.** Before the server changes the database's structure (an upgrade), it saves a full copy to `server/data/backups/todo-v{version}-{timestamp}.db`. The newest 10 are kept.
- **Manual backup.** Settings → Export JSON saves everything to a file; Import JSON merges one back in. Import only adds and updates, never deletes, and importing the same file twice changes nothing. Files from the original to-do app (version 1) can still be imported.
- **Restoring a database backup.** Stop the server, copy the backup file over `server/data/todo.db`, and delete `todo.db-wal` and `todo.db-shm` next to it.

## Architecture

```
shared/   zod schemas + TypeScript types used by both sides; date and recurrence math
server/   Express API; data-access layer (repository interfaces + SQLite); versioned migrations
client/   React + Vite + Tailwind UI; TanStack Query for server data
```

- **One source of truth for the data model.** Every model is a zod schema in `shared/`. The server validates every request with it, and the client gets its TypeScript types from it, so the two can't drift apart.
- **Repository pattern.** Routes depend on interfaces, not SQLite. `SqliteCrud` is a small generic class holding the row-to-object plumbing shared by every table; most tables are configuration on top of it. Swapping the database later means writing one function (`createRepositories`).
- **Dates are local.** A due date is a plain `YYYY-MM-DD` string and an event time is a local `YYYY-MM-DDTHH:mm` with no timezone, so "class at 10:00" stays at 10:00 through daylight saving changes.
- **Versioned migrations** (`PRAGMA user_version`): new schema changes are appended, never edited, so an existing database upgrades in place.
- **TanStack Query** caches server data in the browser and does optimistic updates: the screen changes immediately and rolls back if the server refuses.

## The calendar

- **Repeating events are stored once.** A "series" holds the first start, the length, and a rule (daily, weekdays, weekly on chosen days, monthly, an optional end date, and a list of removed dates). The dates you see are worked out for whatever range is on screen (`expandOccurrences` in `shared/src/eventSeries.ts`). A semester of classes is one row, and "move every class an hour later" is one edit.
- **Exceptions.** Removing a date adds it to the series' removed-dates list. Changing one date creates a small "override" event that points at its series and remembers which date it replaced; the series skips that date.
- **Which events?** `planEventEdit` and `planEventDelete` (also in `shared/`) turn "this", "this and following", or "all" into a list of rows to write. "This and following" ends the old series the day before and starts a new one, and carries the later exceptions over.
- **All-or-nothing saves, and undo.** Each change is sent as one batch (`POST /api/events/batch`), which the server applies in a single transaction. Undo is the same request with the old rows (`invertPlan`).
- **Times are floating local times** (`2026-11-04T10:00`, no timezone), so "class at 10:00" stays at 10:00 when the clocks change. An all-day event ends at midnight *after* its last day (the same convention as FullCalendar and `.ics` files); the form shows the last day itself.
- **FullCalendar** (MIT) draws Month, Week and Day: layout of overlapping events, dragging, resizing. It is restyled with the design tokens (`styles/calendar.css`) and our own blocks, and its code loads only when you open the calendar. Agenda is our own list.
- **Keyboard and screen readers.** Dragging is a mouse and touch gesture; everything it does can also be done from the edit form (click an event, then Edit).

### Today, and conflicts

- **Conflicts** (`shared/src/conflicts.ts`): two timed events conflict if they overlap by at least a minute. Touching ends don't count (10-11 and 11-12 are fine), all-day events never conflict (they mark a day rather than claim an hour), and an event never conflicts with its own series.
- **The Today model** (`features/today/todayModel.ts`) is plain functions of "now" (next event, what's under way, the timeline, the summary), so it is unit-tested without a browser. Up next looks two weeks ahead and skips all-day events.
- **The clock** (`hooks/useNow.ts`) wakes once a minute, exactly on the minute, so the countdown and the now-line stay right without ticking every second.
- Today shows every event, including calendars you've hidden from the calendar page: hiding is about the calendar view, not about your day.

### Time blocks and the workload map

- **A time block is a slot for working on a to-do, separate from the day it's due.** It's a small row of its own (a to-do, a start, an end), so a to-do can have several, and removing one never removes the to-do. Its length starts as the to-do's estimate, or an hour; a block that would run past midnight stops at midnight. Blocks take their calendar's color from the to-do and use the hatched fill from the style guide, so they read differently from events (solid stripe) and to-dos (dashed outline) at a glance. The checkbox on a block ticks the to-do itself.
- **Deleting a to-do hides its blocks, and undoing the delete brings them back** (a to-do is only soft-deleted, so its blocks stay in the database).
- **The list you drag from sits beside the calendar, not in the app's sidebar,** because that's where you're looking when you plan. It only appears on Week and Day on a wide screen; the to-dos without any time set aside come first. Without a mouse, the schedule button on each to-do (and "Set time aside" in its edit dialog) opens a plain form for the day, time and length. It's also how you change a block's time precisely: click the block, then Edit time.
- **Overlaps are warned about, never blocked,** and now count blocks as well as events: scheduling over a meeting (or over another block) says so, in the form and in the toast. (`findClashes` in `shared/src/conflicts.ts`.)
- **The workload score** (`shared/src/workload.ts`) is *hours of events + hours of time blocks + the open to-dos due that day, weighted by priority (high 3, medium 2, low 1)*. Everything that decides what counts as heavy is in one constant, `HEATMAP`: the weights, and where "moderate", "busy" and "packed" begin (a day with a class and a couple of to-dos is moderate; a full day of classes is busy; nine or more is packed). All-day events count as an event but add no hours, and an overnight event counts only the part inside each day. Ticking a to-do off lightens its day. The map counts everything, even calendars hidden from the view: hiding a calendar tidies the page, it doesn't free up your week.

## Courses

**Courses** in the sidebar lists a semester at a time (the one you're in is chosen for you; the address bar remembers which you picked). Start with **New semester**: a name, the first and last day of classes, and any breaks. Then **New course**: name, code, color, meeting days, start and end time, room, instructor, notes. The form tells you how many classes it will make before you save.

- **A course is one repeating event, not a few hundred.** Saving a course creates a single weekly event on its meeting days that runs until the last day of the semester, with the break dates taken out (`shared/src/classSchedule.ts`). It uses the same machinery as any repeating event, so editing the course edits one row, and cancelling or moving a single class works like it does for any other event. The events are marked `source: class-schedule` and linked to the course, so they're never confused with ones you made yourself.
- **Edit a course and the whole series follows**, including a changed time, room, color, or calendar. Classes you cancelled by hand stay cancelled, and a class you moved keeps its own time and room (but follows renames and recolors).
- **Breaks versus cancellations.** Both are "removed dates" on the series, so the app tells them apart by asking whether a removed date falls inside one of the semester's break ranges *as they were before the change*. Break dates are recomputed whenever the semester changes; the rest are your cancellations and are kept. The course page lists cancelled classes with a **Restore** button.
- **The course page** shows the upcoming classes (each with *Move* and *Cancel class*), the course's to-dos and deadlines, its exams and other dates, and its files. **Import syllabus** opens the file importer already in syllabus mode, with the course and its calendar chosen; the syllabus is attached to the course, and its deadlines become to-dos with reminders.
- **Archive semester** hides a finished semester's classes from the calendar, Today, and conflict warnings. Nothing is deleted: the courses, their to-dos, and their files are all still there (turn on *Show archived* on the Courses page), and Restore brings the classes back. Deleting a semester is separate, asks first, and removes its courses and classes.
- **Deleting a course** removes its classes. To-dos, exams and deadlines that were tied to it stay (just no longer tied to a course), and Undo puts everything back.
- No new database tables or packages: courses, semesters and the course links were part of the Phase 1 foundation.

## Applications

**Applications** in the sidebar is the internship tracker. **New application** (or New > Application) takes the company, role, status, dates, link, contact and notes. Everything is one page: your goal and numbers at the top, anything that needs a follow-up, then the **Board** (a column per status; drag a card to change its status, or grab its grip and use the keyboard) or the **Table** (click a heading to sort; filter by status, company or role, and the date applied). The table is the default on a phone, and every row has a plain status menu. Where you are (view, filters, sort) is in the address bar.

- **The timeline is written by the server.** Every status change adds an entry to the application's history in the same transaction as the change, so a client can't skip or forge one. One exception, on purpose: a change that is reversed within two minutes (a card dropped in the wrong column, then Undo) erases the slip from the timeline rather than logging the mistake and its fix. After two minutes both stay, because by then the first change really happened.
- **What the numbers mean** (`shared/src/applications.ts`, all tested). *Applied* means you sent it (it left the wishlist for a real stage, even if it later ended in a rejection). *Heard back* means a company answered: an assessment, an interview, an offer or a rejection (withdrawing is your decision, so it doesn't count). *Interviews* means it reached Interviewing. They're read from the whole timeline, so a rejection after an interview still counts as an interview. The offer goal counts an offer you later turned down, because you earned it. The goal and its date are in Settings.
- **Moving into a "sent" stage with no date applied records today**, so the stats and the follow-up wait have something to count from.
- **"Time to follow up?"** An application that has sat in Applied for 14 days with no change (counted from the date applied if you entered one) is suggested on the Applications page, on its own page, and as a count in the sidebar. *Add follow-up to-do* makes a to-do due today, linked to it; *Dismiss* hides the suggestion. Neither is automatic, and either can be undone. Your answer is saved with the application and judged against its latest status change, so the nudge stays away until the application moves and then sits for another 14 days.
- **A deadline on a wishlist application keeps an "Apply to ..." to-do in step with it**: due on the deadline, with a reminder three days before (the same way a syllabus deadline gets its reminders; reminders are delivered in a later phase). Change the deadline and the to-do moves. Move the application on and the to-do is ticked off. Clear the deadline and it's removed. A to-do you ticked off yourself isn't recreated, and one you deleted isn't brought back by editing something unrelated.
- **A new Interview event asks which application it's for**, however it was made (the form, a drag on the calendar, an imported file). The company named in the title is picked for you when exactly one matches. You can also move that application to Interviewing, and add the **Interview prep** checklist as to-dos dated around the interview (an item that would already be in the past is due today instead). The event gets linked and filed on the Applications calendar; one Undo takes it all back.
- **Notes are Markdown**, shown with a small renderer that builds screen elements directly (headings, lists, bold, italic, code, web links) and never injects HTML, so a note can't run anything.
- **Deleting an application asks first** and can't be undone: it removes the application, its timeline and its notes (and offers to delete files only it uses). Its to-dos and events stay, no longer linked to it. To keep a record, move it to Withdrawn or Rejected instead.
- **One small schema change** (version 4) adds the column that remembers your follow-up answer. As with every upgrade, the server saves a full backup of your database first.

## The app shell

- `client/src/app/`: the frame around every page. `Shell` (sidebar on desktop, drawer and + button on a phone), `AppProvider` (the tasks and calendars plus everything you can do to them, the dialogs, and the undo toast), `PageHeader`, `QuickAdd`, `MiniMonth`, `NewMenu`.
- `client/src/pages/`: one file per page (`TodayPage`, `TasksPage`). Routes are set in `main.tsx`; `/styleguide` sits outside the shell.
- `client/src/features/`: the parts a page is built from, grouped by subject (`tasks/`, `calendars/`, `settings/`).
- **The address bar is the state.** What the Tasks page shows (`/tasks?view=...&calendar=...&date=...`) lives in the URL, so a sidebar link, a mini-month day, and the browser's back button all just work.
- **One dialog at a time.** Task, calendar, settings and shortcuts dialogs are all driven by a single piece of state in `AppProvider`, so opening one from inside another can't stack them.

## Design system

The look ("a modern paper planner": warm paper, ink, one tomato accent) is defined once and reviewed on the style guide page, **`/styleguide`** (also linked from Settings). It shows every color in light and dark, the type scale, and every component, rendered from the real code.

- `client/src/styles/tokens.css`: every color, shadow, and motion value as a CSS variable, for both modes. Components never contain hex codes.
- `client/src/styles/theme.css`: maps those variables onto Tailwind (`bg-paper`, `text-ink-muted`, `rounded-control`, `font-display`...).
- `client/src/ui/`: the components (buttons, form controls, task row, event / to-do / time-block blocks, panel and dialog, toast, kanban card...).
- `client/src/styles/tokens.test.ts`: reads `tokens.css` and fails if any text color pair drops below 4.5:1 (or a meaningful mark below 3:1), apart from three documented exceptions.

## Troubleshooting

- **Dev servers hang with no output.** Check whether the project is inside an iCloud-synced folder (see above).
- **Port already in use.** Change `API_PORT` in `.env`.
