import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase } from '../src/db/connection';
import { createRepositories } from '../src/repositories';

const FEED = `<rss><channel><item><title>Harbor reopens</title><description>Ships are moving again.</description><link>https://example.com/harbor</link><pubDate>Sun, 08 Nov 2026 12:00:00 GMT</pubDate></item></channel></rss>`;

function setup(fetchFeed: (url: string) => Promise<string>) {
  const asked: string[] = [];
  const app = createApp(createRepositories(openDatabase(':memory:')), { uploadsDir: '/tmp', fetchFeed: (url) => (asked.push(url), fetchFeed(url)) });
  return { app, asked };
}

describe('headlines', () => {
  it('fetches nothing until asked, then reads the chosen source’s fixed address', async () => {
    const { app, asked } = setup(async () => FEED);
    await request(app).get('/api/health').expect(200);
    await request(app).get('/api/tasks').expect(200);
    expect(asked).toEqual([]); // ordinary use never touches the network
    const { body } = await request(app).get('/api/headlines?source=bbc').expect(200);
    expect(asked).toEqual(['https://feeds.bbci.co.uk/news/rss.xml']);
    expect(body).toMatchObject({ source: 'bbc', name: 'BBC', items: [{ title: 'Harbor reopens', summary: 'Ships are moving again.', link: 'https://example.com/harbor' }] });
  });

  it('defaults to NPR, and takes no address from the request', async () => {
    const { app, asked } = setup(async () => FEED);
    await request(app).get('/api/headlines').expect(200);
    await request(app).get('/api/headlines?source=http://169.254.169.254/latest').expect(400);
    await request(app).get('/api/headlines?source=ap&url=http://localhost:3030').expect(200);
    expect(asked.every((u) => u.startsWith('https://'))).toBe(true);
    expect(asked).toHaveLength(2);
  });

  it('drops summaries and the suffix for a source that has none', async () => {
    const { app } = setup(async () => FEED.replace('Harbor reopens', 'Harbor reopens - AP News'));
    const { body } = await request(app).get('/api/headlines?source=ap').expect(200);
    expect(body.items[0]).toMatchObject({ title: 'Harbor reopens', summary: null });
  });

  it('says plainly when the feed can’t be reached or isn’t a feed', async () => {
    const down = setup(async () => {
      throw new Error('ENOTFOUND');
    });
    const { body } = await request(down.app).get('/api/headlines?source=pbs').expect(502);
    expect(body.message).toMatch(/PBS NewsHour/);
    await request(setup(async () => '<html>Blocked</html>').app).get('/api/headlines').expect(502);
  });
});
