import { BackupSchema, upgradeBackup, type Backup } from '@todo/shared';

// A review copy is a throwaway database, so anything you add or check off there would be lost when it's deleted.
// This copies those changes into your real app first: npm run carry-over -w server -- <review copy url> <real app url> <since>
// (<since> is when the copy was made, e.g. 2026-11-09T06:28:00Z). Both must run the same version of the app, so run it after a merge and restart.

type Row = { id: string; createdAt?: string; updatedAt?: string };
const stamp = (r: Row) => r.updatedAt ?? r.createdAt ?? '';

/** The rows added or changed in `copy` since `since`, minus any the real app changed more recently (the newer edit wins). Settings and deletions aren't carried. */
export function changesSince(copy: Backup, real: Backup, since: string): Backup {
  const out: Record<string, unknown> = { app: copy.app, version: copy.version, exportedAt: copy.exportedAt };
  for (const [key, rows] of Object.entries(copy)) {
    if (!Array.isArray(rows)) continue;
    const mine = new Map((((real as Record<string, unknown>)[key] as Row[] | undefined) ?? []).map((r) => [r.id, r]));
    out[key] = (rows as Row[]).filter((r) => stamp(r) > since && !((mine.get(r.id) && stamp(mine.get(r.id)!) >= stamp(r))));
  }
  return BackupSchema.parse(out);
}

async function main(copyUrl: string, realUrl: string, since: string) {
  const get = async (base: string) => BackupSchema.parse(upgradeBackup(await (await fetch(`${base}/api/backup/export`)).json()));
  const changes = changesSince(await get(copyUrl), await get(realUrl), since);
  const res = await fetch(`${realUrl}/api/backup/import`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(changes) });
  if (!res.ok) throw new Error(`The real app refused the import (${res.status}): ${await res.text()}`);
  console.log('Carried over:', JSON.stringify(await res.json()));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [copyUrl, realUrl, since] = process.argv.slice(2);
  if (!copyUrl || !realUrl || !since) throw new Error('Usage: carry-over <review copy url> <real app url> <since>');
  await main(copyUrl, realUrl, since);
}
