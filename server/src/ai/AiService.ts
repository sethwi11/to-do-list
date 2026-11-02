import type { ExtractionResult, ParsedExtractRequest, ParsedPlanRequest, PlanResult } from '@todo/shared';

/**
 * What the routes need from "the AI". An interface, so tests (and a future
 * provider swap) can plug in something else without touching the routes.
 */
export interface AiService {
  extract(req: ParsedExtractRequest): Promise<ExtractionResult>;
  planDay(req: ParsedPlanRequest): Promise<PlanResult>;
}

/** An AI failure with an HTTP status and a message that's safe to show the user. */
export class AiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AiError';
  }
}
