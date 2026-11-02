import type { ExtractionResult, ExtractRequest, PlanRequest, PlanResult } from '@todo/shared';
import { apiFetch } from './client';

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const aiApi = {
  status: () => apiFetch<{ configured: boolean }>('/ai/status'),
  extract: (req: ExtractRequest) => apiFetch<ExtractionResult>('/ai/extract', post(req)),
  plan: (req: PlanRequest) => apiFetch<PlanResult>('/ai/plan', post(req)),
};
