import type { Backup } from '@todo/shared';
import { apiFetch } from './client';

export type ImportSummary = Record<string, { added: number; updated: number }>;

export const backupApi = {
  export: () => apiFetch<Backup>('/backup/export'),
  import: (data: unknown) =>
    apiFetch<ImportSummary>('/backup/import', { method: 'POST', body: JSON.stringify(data) }),
};
