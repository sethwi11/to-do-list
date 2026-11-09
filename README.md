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
- **Week**: your weekly routine as a grid, Monday first: drag blocks to move or stretch them (or use the form), copy a block or a whole day to other days, and duplicate the template for a new semester. Each block has a category, a priority (commitment, high, normal or free), an "or instead" alternative, and can be limited to school days
- **Today** page: a morning greeting with a daily quote and the shape of the day; the day as a color-coded agenda (routine, classes, events and time set aside, with Open time in the gaps); a Now card with the time left, what's next, the open to-dos in the current block's category ("During this block") and what you scheduled or have due right now; plus to-dos and overdue
- **Repeating to-dos never pile up as overdue**: one that isn't done by its next occurrence is marked missed and the next one takes its place (switchable per to-do). Weekly ones can repeat on chosen days
- **Full screen and a display view**: install the app as its own window, put it in full screen (Shift+F), and switch to a big display of the clock, the Now card and the agenda
- **12-hour times** everywhere the app writes a time
- **Conflict warnings**: if an event overlaps another, you're told when you pick the time, on the Today timeline, in an event's details, and after a drag. You are warned, never blocked
- **Courses**: set up a semester (dates and breaks such as Thanksgiving), add each class with its meeting days, times, room and instructor, and every meeting appears on the calendar. Cancel or move a single class, import a syllabus from the course's page, and archive a finished semester without deleting anything
- **Applications**: an internship tracker with a board (drag a card to change its status) and a sortable, filterable table, an offer goal with a progress bar, response and interview rates, a "time to follow up?" nudge after 14 days of silence, and a page for each application with its timeline, interviews, to-dos, files and notes. A new Interview event asks which application it belongs to and offers the prep checklist
- **Tasks** page with tabs (All, Upcoming, Overdue, Completed), search, filters, sorting, and drag-to-reorder
- Tasks with subtasks, priorities, due dates and times, recurrence, estimates, and notes
- **Calendars** (color-coded areas of life such as School, ACM, Personal): create, rename, recolor, delete, and filter the task list by one
- Quick-add on every page, a mini month in the sidebar (dots mark days with events or open tasks), and a New menu
- Undo for delete, complete, and every calendar change; keyboard shortcuts (press `?`); dark mode; JSON export and import
- Works on a phone-width screen: the sidebar becomes a drawer, the calendar opens on the Agenda, and a + button replaces the New menu
- **Money**: a spending budget (a month or a week), a quick way to log what you spend, where it went, the pace, last period's leftover to put to work, savings goals, and investments you update by hand (tracking only)
- **Headlines** on Today: press a button for the day's stories from NPR, BBC, PBS or AP (AP through Google News, so headlines only); nothing is fetched until you press it
- **Path**: your north star (each date worked out from your birthday), the stages on the way (Stage 2 stays locked until the 20th birthday), milestones that show the inputs feeding them, and a shelf of badges earned from real data
- **Sunday review**: the week's scoreboard, what slipped, what you learned, next week's workload, three priorities, and one block to copy into a chat with Claude
- Data foundation for later: templates

## Roadmap

Built one phase at a time; each is reviewed before it's merged. Phases 1–15 are built (the sections below describe them).

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
- **The Today model** (`features/today/todayModel.ts`) is plain functions of "now" (what's under way, what's next, which to-dos match the block, the agenda's lanes and hours, the summary), so it is unit-tested without a browser. After the day's last item, Next looks at tomorrow, then two weeks of events.
- **The clock** (`hooks/useNow.ts`) wakes once a minute, exactly on the minute, so the countdown and the now-line stay right without ticking every second.
- Today shows every event, including calendars you've hidden from the calendar page: hiding is about the calendar view, not about your day.

### Time blocks and the workload map

- **A time block is a slot for working on a to-do, separate from the day it's due.** It's a small row of its own (a to-do, a start, an end), so a to-do can have several, and removing one never removes the to-do. Its length starts as the to-do's estimate, or an hour; a block that would run past midnight stops at midnight. Blocks take their calendar's color from the to-do and use the hatched fill from the style guide, so they read differently from events (solid stripe) and to-dos (dashed outline) at a glance. The checkbox on a block ticks the to-do itself.
- **Deleting a to-do hides its blocks, and undoing the delete brings them back** (a to-do is only soft-deleted, so its blocks stay in the database).
- **The list you drag from sits beside the calendar, not in the app's sidebar,** because that's where you're looking when you plan. It only appears on Week and Day on a wide screen; the to-dos without any time set aside come first. Without a mouse, the schedule button on each to-do (and "Set time aside" in its edit dialog) opens a plain form for the day, time and length. It's also how you change a block's time precisely: click the block, then Edit time.
- **Overlaps are warned about, never blocked,** and now count blocks as well as events: scheduling over a meeting (or over another block) says so, in the form and in the toast. (`findClashes` in `shared/src/conflicts.ts`.)
- **The workload score** (`shared/src/workload.ts`) is *hours of events + hours of time blocks + the open to-dos due that day, weighted by priority (high 3, medium 2, low 1)*. Everything that decides what counts as heavy is in one constant, `HEATMAP`: the weights, and where "moderate", "busy" and "packed" begin (a day with a class and a couple of to-dos is moderate; a full day of classes is busy; nine or more is packed). All-day events count as an event but add no hours, and an overnight event counts only the part inside each day. Ticking a to-do off lightens its day. The map counts everything, even calendars hidden from the view: hiding a calendar tidies the page, it doesn't free up your week.

## My week and the Today agenda

- **The routine is a week template**: blocks for each weekday, a wake and bed time per day, and the dates the template applies to. When dates overlap, the template that started most recently wins, so next semester's copy can start before this one ends. A bed time earlier than the wake time means after midnight, and so does a block that ends at or before it starts (10:00 PM–2:00 AM).
- **One function plans a day** (`planDay` in `shared/src/planDay.ts`): the template's blocks for that weekday, plus classes, events and time blocks, with gaps of 15 minutes or more between wake and bed shown as Open. Today, the calendar's Routine layer, the Tasks page's "Now" tags and (later) pop-ups and the check-in all read from it, so they can't disagree.
- **Who keeps a slot.** One-day changes come first (skip, move, replace, make-up). Inside the template the stronger block keeps an overlap (commitment, then high, then normal, then free) and the covered part of the weaker one is hidden, not bumped. Classes and events always keep their time: over a commitment nothing is replaced and the agenda shows the clash so you choose; over any other block they cut out just the overlap, leftover pieces under 15 minutes are dropped, and a block taken completely isn't drawn (the event says "replaces Game"). Time set aside for a to-do never bumps the routine: doing homework in the Homework block is the point.
- **Missed this week** lists time that one-off events, skips and replacements took from blocks marked **Can be rescheduled** (study, homework, research, reading and the like; never meals, driving, gym, volleyball, office hours, meetings, church or free time, which just show as replaced that day). Each row has **Find a new time** (the 3 nearest Open slots of the same length in the next 7 days, never on classes, events, commitments, high or free blocks; or a time you pick when none fit) and **Skip this week** (counted for the Sunday review). Clicking a routine block anywhere offers Skip today, Move today, Replace with a to-do or a new event, or changing it every week. Each change is a small `routine_overrides` row, so Undo just removes it.
- **A class never cuts a block or makes it missed.** A class that overlaps a template block does so every week, so the two sit side by side, and it means the template doesn't match the class time: the Week page shows one notice per clash ("COMP 101 overlaps Lunch every Tuesday") with the class times from Courses and a button that fits the block around the class (trims it, or moves it right after or before the class, avoiding other classes).
- **How blocks sit on a grid** (Week, Today, Calendar): exactly at their times, with a 2px gap taken out of the top block. Text fits the length: an hour or more gets the title and then "category · time"; 30–59 minutes one line "title · time"; under 30 minutes the title alone, with everything in the tooltip. Times read "4:00–4:30 PM" (AM/PM once when shared). Inside the template the stronger block takes the full width and shows "+1 hidden: ACM work" (tap the name to edit it); only real overlaps sit side by side: an event over a commitment, or a class that shares time with a block (neither is cut, and nothing is drawn on top of anything else).
- **On the Calendar, a to-do with a time inside a routine block is drawn on top of that block** at its time (a small dashed chip you can tick or click), so it never splits the block's column. Elsewhere it stays its own chip.
- **Find a time** in the event form lists Open slots of the event's length, inside the template's meeting windows first.
- **After midnight, Today keeps showing the day that's still going** until its bed time (at 1:00 AM after a free night you still see that night), then switches. `?now=2026-11-11T06:00` in the address shows Today (or the display view) as of that moment.
- **School-days blocks** are hidden outside a semester's dates and during its breaks, using the breaks set in Courses.
- **Which block wins an overlap inside the template** is shown on the Week page: the stronger one (commitment, then high) keeps the time, and the covered one is faded with "under ...".
- **Shading**: classes, events and commitments are solid (45% of the category color, so ink text stays readable, tested in `tokens.test.ts`); other routine blocks are the soft tint; free and open time is a neutral hatch, so color is never the only signal.
- **To-dos come to you during their block**: while a routine block runs, every open to-do in its category or its "or instead" category is listed in the Now card (soonest due first, then priority; five shown, then a link), and highlighted with a "Now" tag in task lists. To-dos without a category never match.
- **Rolling repeating to-dos.** A repeating to-do rolls over by default: past its day it's still current ("Until Tuesday"), and once its next occurrence arrives it is marked missed and replaced, so it never shows in Overdue. The server does this whenever the app loads to-dos. Missed ones stay in the database (for the coming check-in and weekly review) but leave every list.
- **Seeding a week** from a private file: `npm run seed:week -w server` reads `.private/seed-week.json` (categories and colors, a semester and its courses, the template and its blocks, weekly reminder to-dos), backs the database up first, skips anything that already exists, and lists what was assumed.

## Pop-ups and the always-on app

- **One pure function** (`popupsForDay` in `shared/src/popups.ts`) turns a planned day into pop-ups, so they follow the day after its changes (a replaced game sends nothing). A start pop-up for each routine block and event ("Now: Real estate research until 10:20 AM · Next: Drive to campus · Put a new listing on Posh +1 more"; to-dos are named only for work blocks), a stop pop-up when nothing follows right away, one combined pop-up when one block ends as the next begins, "5 minutes left" on focus blocks, a heads-up before classes, events and commitments, bedtime, to-do due times (with the first line of the notes, so a reminder's message is right there) and reminders, and event reminders. Nothing pops up during a class. Same-minute pop-ups are combined.
- **The server sends them** as native Mac notifications (`node-notifier`, through terminal-notifier; clicking one opens the app). It checks every 20 seconds and sends each pop-up once. It's off unless the server starts with `POPUPS=on`, so development servers and tests stay quiet. The browser's own due-time notifications are gone, so nothing arrives twice.
- **Settings → Pop-ups**: on or off, the heads-up minutes, focus warnings, bedtime, which categories, Pause for 1 hour, Send a test pop-up, and how many are left today. Each block can turn its own pop-ups off on the Week page. The first pop-up may ask permission for "terminal-notifier"; allow it in System Settings → Notifications (and check Focus mode if nothing shows).
- **The always-on app** runs `main` against your real database at `http://127.0.0.1:3030` (this Mac only): the server serves the built app, sends pop-ups, starts at login and restarts if it stops. From the main folder on `main`:

```bash
npm run app:install
```

After merging new work, `npm run app:restart`; to remove it, `npm run app:uninstall`; to read its log, `npm run app:logs` (the log is in `~/Library/Logs/Planner/`). It refuses to install from another branch, since it uses your real data. `npm run dev` (3001/5173) still works beside it.

## Focus, soundtracks, the check-in and streaks

- **Focus**: on a focus block the Now card (and the display view) has Start focus: Pomodoro with your focus settings (25 on, 5 off, a long break every 4) until the block ends or you press Stop. Each focus interval is saved as a focus session (a stopped one too, if it ran a minute). A short chime marks each switch, made in the browser.
- **Soundtracks** (Settings): a name, a link and/or a folder of audio files on this Mac. A block's soundtrack shows on the Now card and in its start pop-up. Nothing loads before you press play: a link opens in a new tab; a folder plays in a small player (play/pause, next, the track name, level bars that hold still with reduced motion), read by the local server from that folder only (`/api/soundtracks/...`, nothing copied into the project).
- **Close the day** (`/checkin`): opened by the pop-up when the day's last non-free block ends, or the "Close the day" link on Today in the evening. Done, Part or Skipped for each planned item (tap again to clear; unmarked stays unknown), "which one?" for blocks with an alternative, an optional "what I learned" line on focus blocks (the learning log), missed rolling to-dos, and tomorrow's first three. "Mark the rest done" makes a normal day a few taps. Each check-in copies the item's title, category and minutes (`check_ins`), so later template edits never change history.
- **Streaks** (`shared/src/streaks.ts`): gym and LeetCode (check-ins on blocks with those names), focus (a focus session on a day with focus blocks) and nightly check-ins. A day with nothing planned for a streak doesn't break it, and today doesn't until it's over. They show on the morning view and the Now card; at 7, 14, 30, 50 and 100 days, then every 100, a few seconds of fireworks (a still picture with reduced motion), once per milestone.

## The Path and the Sunday review

- **The Path** (`/path`). The north star is a birthday and a few lines in your own words, each with an age ("… by 30"); every date is computed from the birthday (`shared/src/path.ts`; a Feb 29 birthday counts as Feb 28 in other years). The birthday and the lines are data, set from Path → Edit, never in the code. Stage 1 (Foundation) runs until the 20th birthday. Stage 2 is locked until that day: the page shows a countdown and nothing to open, and the server refuses to save its text before then, judged by the birthday already saved so one request can't unlock it. With no birthday it stays locked.
- **Milestones** have a title, an optional target date and optional inputs: categories (hours done this week and in the last four weeks, from check-ins), a savings goal (its progress from Money) and the offer goal (from Applications). Mark reached, Reopen, and Delete all have Undo.
- **Badges** (`shared/src/badges.ts`) come only from real data: a streak reaching 7, 14, 30, 50 or 100 days (then every 100), your first fully checked-in week (every planned item on all seven days has a check-in), every 25th LeetCode session, every 10th application sent, each quarter of a savings goal, each milestone marked reached, and Stage 2 unlocking. Each carries the day it was earned: the day of the thing that crossed the line, not the day the app noticed. A badge is saved once (`badges.key` is unique) and kept even if the data behind it changes later (a goal's target raised, a milestone reopened). The app files new ones when it has loaded everything they read (`BadgeAwards` in the shell: a half-loaded list could stamp a wrong date for good); old ones are filed quietly, and one earned today plays the fireworks.
- **The weekly scoreboard** (`shared/src/scoreboard.ts`, tested with made-up weeks) adds up the plan and the check-ins for Monday to Sunday: hours planned vs done per category (Done counts in full, Part for half because the check-in doesn't ask how much, Skipped for nothing; free time isn't counted; when a block's "or instead" happened, the time goes to that category), gym days, LeetCode sessions, applications sent (from each application's status history), real estate and reading hours (by category name), spent against the budget, saved (moved to goals or kept as cash) and invested, and bumped time made up, let go or still open. Days that haven't happened yet aren't counted, so a week still going isn't scored against hours not yet lived.
- **The Sunday review** (`/review`; switch the reminder on in Settings → Pop-ups for a pop-up at 8:30 PM on Sundays, after the check-in) shows the scoreboard, missed blocks (with Find a new time), missed rolling to-dos, the learning log, next week as the workload heatmap, three priorities and notes (saved in `weekly_reviews`), and steps back and forward by week. **Copy summary for Claude** puts it all in one Markdown block that ends with "Questions for Claude:". Sections with nothing in them are left out, a week still going is marked "so far, through …", and next week names only the days with something on them and how heavy each is.
- **Data**: `milestones` and `badges` tables, `weekly_reviews.priorities`, and the `path` setting, all in the JSON export and import (backup version 7; older files upgrade).

## Headlines

The one place the app reaches the internet, and only when you press the button (Today → Headlines). The local server fetches a fixed address for the source you chose (NPR, BBC and PBS NewsHour's own free feeds; AP through a Google News feed limited to apnews.com, which has no public feed of its own), so the page never makes a third-party request itself and nothing is fetched on load. The feeds' text is read as plain text only (`parseFeed` in `shared/src/headlines.ts`, tested with made-up feeds, including markup that must never survive), links must be `https` and open in a new tab. Each story comes with the publisher's own one-line summary where the feed has one: the app doesn't write summaries, since that would need an AI service and a key. The last result per source is kept for the day on that device. Nothing else about the app sends your data anywhere.

## Money

Tracking only. You type in what you spend and what things are worth; nothing connects to a bank, nothing is fetched, no account number or balance is stored, and none of it is advice. Every amount is whole cents (`shared/src/money.ts`, which holds all the math and is tested with made-up data).

- **The budget** is an amount and a period (a month from the 1st, or a week from Monday), in Settings. The app ships with none set; the starting amount for your own database comes from the private seed file, never from the code.
- **Spending**: *left* is the budget minus what's spent so far in the period; *pace* is spent divided by days gone, times days in the period ("at this rate: $645 by the end of the month"). The page also shows spending by category, wants and needs, this period against the last, your three biggest "want" categories as plain numbers, and recurring costs (expenses marked "repeats monthly": each at its latest amount, with an Add now button for this month's if it isn't entered yet; nothing is added for you).
- **Adding an expense** is a row on the Money page (also reached from New → Expense): type an amount and press Enter. "What" is optional (it becomes the category's name); the category, need or want and date stay for the next one; typing a "what" you've used before fills in its category and need or want; the row clears the moment you press Enter, so you can type the next one straight away.
- **Leftover to put to work**: what's left when a period ends counts as saved, and stays on the page as "Move it" until you've split it between your goals and holdings. Whatever you don't allocate is logged as "kept as cash", which settles it. One Undo takes the whole move back. A period only counts from your first expense on, and an overspent one never shows.
- **Savings goals** have a name and a target; progress is the money moved or added to them. **Investments** (stock, ETF, crypto, savings, real estate, other) have a value you update by hand with the date you did, a contributions log, and an optional monthly target ("$25 of $50 this month"). The totals are what you put in, what it's worth now, and the gain or loss in dollars and percent, with an allocation bar by type.
- **Data**: five tables (`expense_categories`, `expenses`, `savings_goals`, `holdings`, `money_moves`), all in the JSON export and import (the nine starting categories are matched by name, so an import doesn't duplicate them). Deleting an expense, goal or holding can be undone.

### Full screen and the installed window

The app can run as its own window with no tabs or address bar, kept in a full-screen space you swipe to:

1. Open the always-on app in Chrome (`http://127.0.0.1:3030`, after `npm run app:install`).
2. Chrome menu (⋮) → **Cast, save and share** → **Install page as app…** (on older versions, **Install Planner…**). It opens in its own window and gets a Dock icon.
3. In that window, press the green button (or Ctrl+⌘+F) for a macOS full-screen space; three-finger swipe moves between it and your other spaces.
4. Inside the app, the sidebar's full-screen button (or Shift+F) uses the browser's full screen instead, and the display button opens the big Now card, clock and agenda. If the app was in full screen when you closed it, it offers a one-click way back (browsers need a click to enter full screen).
5. To open the window at login too: System Settings → General → Login Items → + → choose **Planner** (Chrome keeps installed apps in `~/Applications/Chrome Apps`). The server is already running by then.

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

## Where things live (client)

| Folder | What's in it |
| --- | --- |
| `app/` | The frame around every page: `Shell`, `Sidebar`, `AppProvider` (shared data, dialogs, toast), `PageHeader`, `QuickAdd`, `MiniMonth`, `NewMenu` |
| `actions/` | Everything that changes data, with Undo: `useEventActions`, `useCourseActions`, `useApplicationActions`, `useTimeBlockActions`, `useRoutineActions` |
| `data/` | Server data (TanStack Query): one hook per kind of data, and the shared cache |
| `api/` | The fetch calls behind those hooks |
| `pages/` | One file per page; routes are in `main.tsx` (`/styleguide` and the `/display` view sit outside the shell) |
| `features/` | The parts pages are built from, by subject: `calendar/`, `tasks/`, `today/`, `week/`, `courses/`, `applications/`, `money/`, `path/`, `review/`, `import/`, `attachments/`, `events/`, `settings/` |
| `ui/` | Design-system components (buttons, fields, dialog, popover, blocks, task row...) |
| `lib/`, `hooks/`, `styles/` | Small helpers, React hooks, and the design tokens |

Pure logic and every data model live in `shared/` (models in `shared/src/models/`), so the server and the client share them and they're tested without a browser.

- **The address bar is the state.** What the Tasks page shows (`/tasks?view=...&calendar=...&date=...`) lives in the URL, so a sidebar link, a mini-month day, and the browser's back button all just work.
- **One dialog at a time.** Task, calendar, settings and shortcuts dialogs are all driven by a single piece of state in `AppProvider`, so opening one from inside another can't stack them.

## Design system

The look (morning sky, cerulean ink and one honey accent; at night, deep cerulean with the same honey) is defined once and reviewed on the style guide page, **`/styleguide`** (also linked from Settings). It shows every color in light and dark, the type scale, and every component, rendered from the real code.

- `client/src/styles/tokens.css`: every color, shadow, and motion value as a CSS variable, for both modes. Components never contain hex codes.
- `client/src/styles/theme.css`: maps those variables onto Tailwind (`bg-paper`, `text-ink-muted`, `rounded-control`, `font-display`...).
- `client/src/ui/`: the components (buttons, form controls, task row, event / to-do / time-block blocks, panel and dialog, toast, kanban card...).
- `client/src/styles/tokens.test.ts`: reads `tokens.css` and fails if any text color pair drops below 4.5:1 (or a meaningful mark below 3:1), apart from three documented exceptions.

## Troubleshooting

- **Dev servers hang with no output.** Check whether the project is inside an iCloud-synced folder (see above).
- **Port already in use.** Change `API_PORT` in `.env`.
