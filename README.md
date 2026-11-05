# Planner

A personal planner built from a to-do app: tasks today, with a calendar, courses, an internship tracker, time blocking, and a weekly review being added phase by phase. **It runs entirely on your computer. No accounts, no API keys, no paid services.**

> Work in progress. The full README (every feature, supported file types, shortcuts, installing on your phone) arrives in the last phase.

## What works today

- **Calendar** with Month, Week, Day, and Agenda views: drag across empty time to add an event, drag an event to move it, drag its edge to resize it, click one for its details. Events can repeat (every day, weekday, week on chosen days, or month) and you choose whether a change applies to *this event*, *this and following*, or *all events*
- **To-dos on the calendar**: dashed, checkable, and draggable to a new day or time. Calendars can be hidden from the sidebar, and events and to-dos can be switched off separately
- **Today** page: what's overdue and due today, with the week's completion bars
- **Tasks** page with tabs (All, Upcoming, Overdue, Completed), search, filters, sorting, and drag-to-reorder
- Tasks with subtasks, priorities, due dates and times, recurrence, estimates, and notes
- **Calendars** (color-coded areas of life such as School, ACM, Personal): create, rename, recolor, delete, and filter the task list by one
- Quick-add on every page, a mini month in the sidebar (dots mark days with events or open tasks), and a New menu
- Undo for delete, complete, and every calendar change; keyboard shortcuts (press `?`); dark mode; JSON export and import
- Works on a phone-width screen: the sidebar becomes a drawer, the calendar opens on the Agenda, and a + button replaces the New menu
- Data foundation for everything coming next: courses and semesters, internship applications, templates, focus sessions, weekly reviews, settings, attachments

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
