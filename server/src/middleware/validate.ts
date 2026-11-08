import type { RequestHandler } from 'express';
import type { z } from 'zod';

/** Validates req.body against a zod schema. */
export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'ValidationError',
        message: 'Request body is invalid',
        issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
