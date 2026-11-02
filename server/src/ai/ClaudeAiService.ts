import Anthropic from '@anthropic-ai/sdk';
import {
  ExtractionResultSchema,
  PlanResultSchema,
  type ExtractionResult,
  type ParsedExtractRequest,
  type ParsedPlanRequest,
  type PlanResult,
} from '@todo/shared';
import type { z } from 'zod';
import { AiError, type AiService } from './AiService';
import { buildExtractionUserMessage, EXTRACTION_SYSTEM_PROMPT } from './extractionPrompt';
import { toStructuredOutputSchema } from './jsonSchema';
import { buildPlanUserMessage, PLAN_SYSTEM_PROMPT } from './planPrompt';
import { sanitizeExtraction } from './sanitize';

export const MODEL = 'claude-sonnet-5-5';

// Converted once at startup; identical bytes every request also keeps the schema cache warm.
const EXTRACTION_FORMAT = { type: 'json_schema' as const, schema: toStructuredOutputSchema(ExtractionResultSchema) };
const PLAN_FORMAT = { type: 'json_schema' as const, schema: toStructuredOutputSchema(PlanResultSchema) };

/**
 * AiService backed by Claude.
 *
 * Design choices:
 * - Structured outputs (output_config.format) constrain the reply to our JSON
 *   schema, so there's no "please respond in JSON" prompt and no regex parsing.
 *   We still validate with zod: defense in depth, plus it enforces the
 *   constraints (date patterns, 0-1 confidence) the schema subset can't express.
 * - effort "low": extraction is a quick, well-specified task, and in voice mode
 *   latency is what you feel. Raise it if extraction quality disappoints.
 * - The system prompt is cached (cache_control). It's identical every request,
 *   so repeat requests read it from cache at ~10% of the input price.
 * - fallbacks "default": if Sonnet's safety classifier wrongly declines a
 *   harmless transcript, the API retries on a fallback model in the same call.
 */
export class ClaudeAiService implements AiService {
  constructor(private readonly client: Anthropic) {}

  async extract(req: ParsedExtractRequest): Promise<ExtractionResult> {
    const raw = await this.call(EXTRACTION_SYSTEM_PROMPT, buildExtractionUserMessage(req), EXTRACTION_FORMAT, ExtractionResultSchema);
    return sanitizeExtraction(raw, req);
  }

  async planDay(req: ParsedPlanRequest): Promise<PlanResult> {
    const plan = await this.call(PLAN_SYSTEM_PROMPT, buildPlanUserMessage(req), PLAN_FORMAT, PlanResultSchema);
    // Ignore any ids the model made up.
    const known = new Set(req.tasks.map((t) => t.id));
    return {
      ...plan,
      blocks: plan.blocks.filter((b) => known.has(b.taskId)),
      unscheduledTaskIds: plan.unscheduledTaskIds.filter((id) => known.has(id)),
    };
  }

  private async call<T>(
    system: string,
    user: string,
    format: { type: 'json_schema'; schema: Record<string, unknown> },
    schema: z.ZodType<T>,
  ): Promise<T> {
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await this.client.beta.messages.create({
        model: MODEL,
        max_tokens: 8000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format },
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: user }],
      });
    } catch (err) {
      throw toAiError(err);
    }

    if (response.stop_reason === 'refusal') {
      throw new AiError(422, "Claude declined to process that text. Try rephrasing it.");
    }
    if (response.stop_reason === 'max_tokens') {
      throw new AiError(502, 'That was too much to process at once. Try a shorter chunk.');
    }

    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new AiError(502, 'Claude returned malformed output. Please try again.');
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      console.error('AI output failed validation:', parsed.error.issues);
      throw new AiError(502, 'Claude returned output in an unexpected shape. Please try again.');
    }
    return parsed.data;
  }
}

/** Typed SDK errors, most specific first, mapped to user-facing messages. */
function toAiError(err: unknown): AiError {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new AiError(502, 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env.');
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new AiError(429, 'Claude is rate-limited right now. Wait a moment and try again.');
  }
  if (err instanceof Anthropic.BadRequestError) {
    console.error('Anthropic bad request:', err.message);
    return new AiError(502, 'The AI request was rejected. Check the server logs for details.');
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new AiError(504, "Couldn't reach the Anthropic API. Check your internet connection.");
  }
  if (err instanceof Anthropic.APIError) {
    return new AiError(502, `The AI service had an error (${err.status ?? 'unknown'}). Try again shortly.`);
  }
  console.error(err);
  return new AiError(500, 'Unexpected error while talking to the AI.');
}
