import { Router } from 'express';
import { NEWS_SOURCES, parseFeed } from '@todo/shared';

/** Gets a feed's text. Tests swap in a fake, so nothing touches the network there. */
export type FetchFeed = (url: string) => Promise<string>;

const MAX_BYTES = 2_000_000;

export const fetchFeedText: FetchFeed = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0 (personal planner)', Accept: 'application/rss+xml, application/xml, text/xml' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();
  if (body.length > MAX_BYTES) throw new Error('Feed too large');
  return body;
};

/** GET /api/headlines?source=npr: the day's stories from one fixed, free news feed. Nothing is fetched until this is called (the Today page calls it only when you press the button), and the address is never taken from the request. */
export function headlinesRouter(fetchFeed: FetchFeed = fetchFeedText): Router {
  const router = Router();
  router.get('/', async (req, res) => {
    const source = NEWS_SOURCES.find((s) => s.id === (typeof req.query.source === 'string' ? req.query.source : 'npr'));
    if (!source) {
      res.status(400).json({ error: 'BadRequest', message: `Choose one of: ${NEWS_SOURCES.map((s) => s.id).join(', ')}` });
      return;
    }
    try {
      const items = parseFeed(await fetchFeed(source.url), { summaries: source.summaries, titleSuffix: source.titleSuffix });
      if (items.length === 0) throw new Error('No stories');
      res.json({ source: source.id, name: source.name, fetchedAt: new Date().toISOString(), items });
    } catch {
      res.status(502).json({ error: 'NewsUnavailable', message: `Couldn’t get the headlines from ${source.name}. Check your connection and try again.` });
    }
  });
  return router;
}
