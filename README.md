# Voice To-Do

A to-do app you can talk to. Speak (or type a "brain dump"), and Claude extracts the actionable tasks, resolves due dates and priority, and queues them for your review.

> Work in progress, built in phases. The full README (architecture, API key setup, sample transcripts) arrives in Phase 7.

## Quick start

Requires Node 20.19+ (Node 22 LTS recommended).

```bash
npm install
cp .env.example .env
npm run dev
```

Then open http://localhost:5173.

- `npm test` runs all unit and API tests (Vitest).
- `npm run typecheck` type-checks every package.

**Keep this project out of iCloud-synced folders** (Desktop, Documents). iCloud evicts `node_modules` files to the cloud, and the dev servers then hang while reading them.

## Layout

```
shared/   zod schemas + TypeScript types used by both sides (single source of truth)
server/   Express API, SQLite via a repository layer, migrations, API tests
client/   React + Vite + Tailwind UI
scripts/  dev runner (starts server + client together)
```
