import type { ErrorRequestHandler, RequestHandler } from 'express';

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: 'NotFound', message: `No route for ${req.method} ${req.originalUrl}` });
};

/*
 * Last-resort error handler. Express 5 forwards errors thrown in async
 * handlers here automatically (Express 4 needed a try/catch in every route).
 * We log the full error on the server but only send a generic message to the
 * client, so internals like SQL and stack traces never leak.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'BadJson', message: 'Request body is not valid JSON' });
    return;
  }
  if (err?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    res.status(400).json({ error: 'ValidationError', message: 'Unknown categoryId' });
    return;
  }

  if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    res.status(409).json({ error: 'Conflict', message: 'A list with that name already exists' });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'InternalError', message: 'Something went wrong on the server' });
};
