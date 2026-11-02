/*
 * Runs every transcript in server/samples/ through the real extraction
 * endpoint and prints what was picked out, so you can judge (and tune)
 * extraction quality. Each sample is one Claude API call (a few cents total).
 *
 *   1. Start the app:   npm run dev
 *   2. In another tab:  npm run samples            (all samples)
 *                       npm run samples -- 02      (just samples matching "02")
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtractionResult } from '@todo/shared';

const here = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.resolve(here, '../samples');
const port = process.env.API_PORT ?? '3001';
const filter = process.argv[2];

// A fixed "now" and a small fake task list, so results are comparable run to run.
const clientNow = { date: '2026-11-02', time: '09:00', timezone: 'America/New_York' }; // a Monday
const existingTasks = [
  { id: '11111111-1111-4111-8111-111111111111', title: 'Pick up groceries', dueDate: null, dueTime: null, status: 'todo' },
  { id: '22222222-2222-4222-8222-222222222222', title: 'Finish COMP 365 lab', dueDate: '2026-11-06', dueTime: null, status: 'todo' },
  { id: '33333333-3333-4333-8333-333333333333', title: 'Read chapter 4', dueDate: '2026-11-02', dueTime: null, status: 'todo' },
];
const categories = ['School', 'Work', 'Personal', 'Fraternity', 'ACM'];

const files = fs
  .readdirSync(samplesDir)
  .filter((f) => f.endsWith('.txt') && (!filter || f.includes(filter)))
  .sort();

for (const file of files) {
  const text = fs.readFileSync(path.join(samplesDir, file), 'utf8').trim();
  console.log(`\n━━━ ${file} ━━━`);
  console.log(text.length > 160 ? text.slice(0, 160) + '…' : text);

  const started = Date.now();
  const res = await fetch(`http://127.0.0.1:${port}/api/ai/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, mode: 'voice', clientNow, existingTasks, categories }),
  }).catch(() => null);

  if (!res) {
    console.error(`Could not reach the API on port ${port}. Is "npm run dev" running?`);
    process.exit(1);
  }
  const body = await res.json();
  if (!res.ok) {
    console.log(`  ✗ ${res.status}: ${body.message}`);
    continue;
  }

  const result = body as ExtractionResult;
  for (const t of result.tasks) {
    const flag = t.confidence < 0.6 ? '⚠' : '✓';
    const when = [t.dueDate, t.dueTime].filter(Boolean).join(' ');
    const extras = [when, t.priority, t.category, t.recurrence !== 'none' && `↻${t.recurrence}`, t.estimatedMinutes && `${t.estimatedMinutes}m`, t.subtasks.length && `${t.subtasks.length} subtasks`]
      .filter(Boolean)
      .join(' · ');
    console.log(`  ${flag} TASK  ${t.title}  (${extras})  conf ${t.confidence.toFixed(2)}`);
  }
  for (const a of result.actions) console.log(`  → ${a.type.toUpperCase().padEnd(8)} ${a.description}  conf ${a.confidence.toFixed(2)}`);
  if (!result.tasks.length && !result.actions.length) console.log('  (nothing actionable)');
  console.log(`  🔊 "${result.spokenReply}"${result.clarifyingQuestion ? `  ❓ ${result.clarifyingQuestion}` : ''}`);
  console.log(`  (${((Date.now() - started) / 1000).toFixed(1)}s)`);
}
