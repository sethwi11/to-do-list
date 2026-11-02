import { z } from 'zod';

// Keywords structured outputs doesn't support. Zod still enforces them when we
// validate the reply, so dropping them from the schema loses no safety.
const UNSUPPORTED = ['$schema', 'pattern', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minLength', 'maxLength', 'minItems', 'maxItems'];

/**
 * Converts a zod schema into the JSON Schema subset that Claude's structured
 * outputs accept: every object closed (additionalProperties: false) and
 * unsupported constraints removed. Enums, formats, anyOf, and descriptions are
 * kept, and those are what actually steer the model.
 */
export function toStructuredOutputSchema(schema: z.ZodType): Record<string, unknown> {
  return clean(z.toJSONSchema(schema, { io: 'output' })) as Record<string, unknown>;
}

function clean(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(clean);
  if (node === null || typeof node !== 'object') return node;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (UNSUPPORTED.includes(key)) continue;
    out[key] = clean(value);
  }
  if (out.type === 'object') out.additionalProperties = false;
  return out;
}
