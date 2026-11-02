import { Router, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { ExtractRequestSchema, ExtractionResultSchema, PlanRequestSchema } from '@todo/shared';
import { AiError, type AiService } from '../ai/AiService';
import { validateBody } from '../middleware/validate';

/*
 * Light rate limit: generous enough for conversation mode (a chunk every few
 * seconds at most), but it stops a runaway loop in the client from running up
 * your API bill. The limiter counts per IP, which here just means "you".
 */
const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'RateLimited', message: 'Too many AI requests. Wait a minute and try again.' },
});

export function aiRouter(ai: AiService | null): Router {
  const router = Router();
  router.use(aiLimiter);

  // No key configured: fail clearly instead of crashing at startup, so the rest of the app still works.
  const requireAi: RequestHandler = (_req, res, next) => {
    if (!ai) {
      res.status(503).json({
        error: 'AiNotConfigured',
        message: 'AI is not set up. Add ANTHROPIC_API_KEY to the .env file in the project root, then restart the server.',
      });
      return;
    }
    next();
  };

  router.post('/extract', requireAi, validateBody(ExtractRequestSchema), async (req, res) => {
    try {
      const result = await ai!.extract(req.body);
      // Validate again on the way out: the client trusts this shape completely.
      res.json(ExtractionResultSchema.parse(result));
    } catch (err) {
      sendAiError(res, err);
    }
  });

  router.post('/plan', requireAi, validateBody(PlanRequestSchema), async (req, res) => {
    try {
      res.json(await ai!.planDay(req.body));
    } catch (err) {
      sendAiError(res, err);
    }
  });

  router.get('/status', (_req, res) => {
    res.json({ configured: ai !== null });
  });

  return router;
}

function sendAiError(res: Parameters<RequestHandler>[1], err: unknown) {
  if (err instanceof AiError) {
    res.status(err.status).json({ error: 'AiError', message: err.message });
    return;
  }
  throw err; // falls through to the global error handler (500)
}
