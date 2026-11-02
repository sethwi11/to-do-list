# Voice To-Do

A to-do app you can talk to. Hold a button and list what you need to do, or switch on conversation mode and just talk about your day. Claude picks out the actionable tasks, resolves dates ("Friday", "tomorrow morning"), infers priority and list, and puts everything in a **Review** panel so nothing is added until you accept it. It also understands commands like "mark the grocery one done", "move my lab to Thursday" and "what's left today?".

## Features

- **Voice capture.** Push-to-talk (hold the mic button or Space), or continuous conversation mode with automatic chunking, context carried between chunks, deduplication, spoken replies, and clarifying questions.
- **Brain dump.** Type instead of talk. Same extraction pipeline.
- **Review queue.** Editable cards with Accept / Edit / Reject and Accept all. Low-confidence items are flagged and unchecked. Deletes always need confirmation. Optionally auto-adds high-confidence new tasks.
- **Lists, subtasks, recurrence.** Daily, weekdays, weekly, monthly. Completing a recurring task creates the next one.
- **Views.** Today, Upcoming (next 7 days), Overdue, All, Completed, and one per list. Search, filters, and sorting by due date, priority, or drag-and-drop (mouse or keyboard).
- **Undo** for delete and complete (toast, or Ctrl/⌘+Z).
- **Plan my day.** Claude builds a time-blocked schedule for today's tasks.
- **Morning brief, browser notifications, stats and streak, dark mode, JSON export/import, keyboard shortcuts** (press `?`).

## Setup

**Requirements:** Node 20.19+ (Node 22 recommended) and Chrome or Edge on desktop for voice. Typing works in any browser.

> ⚠️ Keep the project **out of iCloud-synced folders** (Desktop, Documents). iCloud evicts `node_modules` files to the cloud, and the dev servers then hang.

```bash
git clone https://github.com/sethwi11/to-do-list.git
cd to-do-list
npm install
cp .env.example .env
```

### Get an Anthropic API key

1. Sign in at <https://console.anthropic.com/> and add a payment method or credits under **Billing**.
2. Go to **Settings → API Keys → Create Key** and copy the key (it starts with `sk-ant-`).
3. Paste it into `.env` in the project root:

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

`.env` is gitignored, and the key is only read by the server, never sent to the browser. Without a key, everything except AI extraction and Plan my day still works, and the app tells you what's missing.

**Cost:** extraction uses `claude-sonnet-5-5` at low effort, with the system prompt cached. A typical request costs a fraction of a cent. The server allows at most 30 AI requests per minute, so a bug can't run up your bill.

### Run

```bash
npm run dev
```

Open <http://localhost:5173>. The API runs on port 3001, and Vite proxies `/api` to it. Your data lives in `server/data/todo.db` (SQLite) and survives restarts.

| Command | What it does |
| --- | --- |
| `npm run dev` | API server + web app with hot reload |
| `npm test` | All unit and API tests (Vitest) |
| `npm run typecheck` | Type-checks every package |
| `npm run samples` | Runs `server/samples/*.txt` through the real extraction endpoint (needs `npm run dev` running and an API key) |
| `npm run samples -- 02` | Only samples whose filename contains `02` |

## Architecture

```
Browser (React + Vite + Tailwind)                     Server (Express + TypeScript)
┌───────────────────────────────────────┐            ┌──────────────────────────────────────────┐
│ speech/SpeechCapture   (Web Speech)   │            │ routes/tasks, categories, backup         │
│ speech/transcriptChunker (4s / 60s)   │   /api/*   │ routes/ai ── rate limit ── AiService     │
│ speech/tts             (SpeechSynth.) │ ─────────► │        ClaudeAiService ──► Claude API    │
│ hooks/useVoice  ─► hooks/useAssistant │  (proxied) │        prompts + zod validation          │
│                    └─► Review panel   │            │ repositories/ (interface) ──► SQLite     │
│ hooks/useTodoData (optimistic CRUD)   │            │ db/migrations (PRAGMA user_version)      │
└───────────────────────────────────────┘            └──────────────────────────────────────────┘
                     shared/  ←  zod schemas + types used by both sides (single source of truth)
```

**How one utterance flows through the system:**
1. The browser transcribes your speech. In conversation mode, the chunker waits for 4 seconds of silence or 60 seconds of talking.
2. `useAssistant` sends `POST /api/ai/extract` with the text, your local date, time and timezone, your open tasks (with ids), your list names, titles already proposed this session, any pending clarifying question, and the last two chunks as context.
3. The server builds a prompt from [`server/src/ai/extractionPrompt.ts`](server/src/ai/extractionPrompt.ts). It includes a precomputed **date table** ("Friday = 2026-11-06"), so the model looks dates up instead of doing calendar math.
4. Claude replies through **structured outputs**: the response is constrained to a JSON schema generated from the zod schema in [`shared/src/extraction.ts`](shared/src/extraction.ts).
5. The server validates the reply with zod and then sanitizes it: it drops actions on unknown task ids, drops duplicates, and maps list names to real lists. It validates again before responding.
6. The client runs queries right away (they're read-only), sends everything else to the Review panel, and speaks the reply. While the app talks, the mic pauses so it doesn't transcribe itself.

**Design decisions worth knowing:**
- **Repository pattern.** Routes depend on `TaskRepository` and `CategoryRepository` interfaces. To swap SQLite for Postgres, write one class.
- **Dates are local `YYYY-MM-DD` strings**, not timestamps. "Due Friday" is a day on the calendar and must not shift between timezones.
- **Soft delete makes undo trivial.** Rows deleted more than 30 days ago are purged when the server starts.
- **Recurrence happens server-side, in one transaction.** Completing a task creates the next occurrence. Reopening or undoing removes it, which is tracked by `nextOccurrenceId`.
- **The AI service is injected.** Tests use a mocked Claude client, so `npm test` never calls the API.

### Project layout

```
shared/   zod schemas & types (task, category, extraction, backup), calendar + recurrence math
server/   src/ai/            prompts, Claude client, schema conversion, sanitizing
          src/repositories/  data-access interfaces + SQLite implementations
          src/routes/        tasks, categories, ai, backup
          samples/           sample transcripts (incl. rambling + small-talk-only)
          scripts/           run-samples.ts
          test/              API tests (in-memory SQLite, mocked Claude)
client/   src/speech/        speech capture, transcript chunker, text-to-speech
          src/hooks/         data, assistant pipeline, voice, settings, shortcuts, …
          src/components/    UI
          src/lib/           pure logic (views, filters, ordering, stats, dates) + tests
```

## Tuning extraction

Edit the system prompt in [`server/src/ai/extractionPrompt.ts`](server/src/ai/extractionPrompt.ts), then run `npm run samples` to see how the sample transcripts are handled. Add your own `.txt` files to `server/samples/`. If quality isn't good enough, try raising `effort` from `low` to `medium` in `ClaudeAiService.ts`. It's slower, but the model reasons more carefully.

## Troubleshooting

- **"Microphone access is blocked".** Click the mic/camera icon in Chrome's address bar and allow the microphone.
- **Voice doesn't work at all.** Use desktop Chrome or Edge. Firefox has no speech recognition. Chrome's recognition also needs internet, because it runs on Google's servers.
- **Testing voice from your phone over Wi-Fi.** Browsers only allow the mic on `https://` or `localhost`, so a LAN address won't work without HTTPS.
- **"AI is not set up".** Add `ANTHROPIC_API_KEY` to `.env` and restart `npm run dev`.
- **Notifications don't appear.** They only fire while the app is open in a tab, and you need to allow them in Settings.
