# Planner

A personal planner built from a to-do app: tasks today, with a calendar, courses, an internship tracker, time blocking, and a weekly review being added phase by phase. **It runs entirely on your computer. No accounts, no API keys, no paid services.**

> Work in progress. The full README (every feature, supported file types, shortcuts, installing on your phone) arrives in the last phase.

## What works today

- **Today** page: what's overdue and due today, with the week's completion bars
- **Tasks** page with tabs (All, Upcoming, Overdue, Completed), search, filters, sorting, and drag-to-reorder
- Tasks with subtasks, priorities, due dates and times, recurrence, estimates, and notes
- **Calendars** (color-coded areas of life such as School, ACM, Personal): create, rename, recolor, delete, and filter the task list by one
- Quick-add at the top of every page, a mini month in the sidebar (click a day to see what's due), and a New menu
- Undo for delete and complete, keyboard shortcuts (press `?`), dark mode, JSON export and import
- Works on a phone-width screen: the sidebar becomes a drawer, and a + button replaces the New menu
- Data foundation for everything coming next: events, event types, time blocks, courses and semesters, internship applications, templates, focus sessions, weekly reviews, settings, attachments

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
