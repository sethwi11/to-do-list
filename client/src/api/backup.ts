import type { Backup } from '@todo/shared';
import { apiFetch } from './client';

export const backupApi = {
  export: () => apiFetch<Backup>('/backup/export'),
  import: (data: unknown) =>
    apiFetch<{ categoriesAdded: number; tasksAdded: number; tasksUpdated: number }>('/backup/import', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
