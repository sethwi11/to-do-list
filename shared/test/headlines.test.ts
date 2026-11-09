import { describe, expect, it } from 'vitest';
import { NEWS_SOURCES, parseFeed } from '../src';

// Made-up feeds in the shapes the real ones use.
const wrap = (items: string) => `<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title>${items}</channel></rss>`;

describe('reading a news feed', () => {
  it('reads plain items: entities decoded, escaped HTML in the summary removed', () => {
    const xml = wrap(`<item><title>Council won&apos;t vote &amp; delays plan</title><description>It follows reports by &lt;em&gt;The Daily&lt;/em&gt; that &quot;nothing&quot; changed.</description><pubDate>Sun, 08 Nov 2026 19:17:43 -0500</pubDate><link>https://example.com/a</link></item>`);
    expect(parseFeed(xml)).toEqual([{ title: "Council won't vote & delays plan", summary: 'It follows reports by The Daily that "nothing" changed.', link: 'https://example.com/a', publishedAt: '2026-11-09T00:17:43.000Z' }]);
  });

  it('reads CDATA items, removing the HTML they carry', () => {
    const xml = wrap(`<item><title><![CDATA[Fire at the pier]]></title><description><![CDATA[Crews <b>responded</b> &amp; stayed.]]></description><link>https://example.com/b?x=1&amp;y=2</link></item>`);
    expect(parseFeed(xml)).toMatchObject([{ title: 'Fire at the pier', summary: 'Crews responded & stayed.', link: 'https://example.com/b?x=1&y=2', publishedAt: null }]);
  });

  it('never keeps markup: a script in a title or summary comes out as plain text', () => {
    const xml = wrap(`<item><title>&lt;script&gt;alert(1)&lt;/script&gt;Hello</title><description><![CDATA[<img src=x onerror=alert(1)>Seen]]></description><link>https://example.com/c</link></item>`);
    const [h] = parseFeed(xml);
    expect(h!.title).toBe('alert(1) Hello'); // no markup survives
    expect(h!.summary).toBe('Seen');
  });

  it('skips stories with no title or no https link (javascript:, http:, garbage)', () => {
    const xml = wrap(
      ['<item><title>No link</title></item>', '<item><link>https://example.com/x</link></item>', '<item><title>Bad</title><link>javascript:alert(1)</link></item>', '<item><title>Plain http</title><link>http://example.com/y</link></item>', '<item><title>Not a url</title><link>nope</link></item>', '<item><title>Good</title><link>https://example.com/z</link></item>'].join(''),
    );
    expect(parseFeed(xml).map((h) => h.title)).toEqual(['Good']);
  });

  it('stops at the limit, trims long text, and leaves out a summary that just repeats the title', () => {
    const items = Array.from({ length: 20 }, (_, i) => `<item><title>Story ${i}</title><description>Story ${i}</description><link>https://example.com/${i}</link></item>`).join('');
    const list = parseFeed(wrap(items), { limit: 5 });
    expect(list).toHaveLength(5);
    expect(list[0]!.summary).toBeNull();
    const long = parseFeed(wrap(`<item><title>${'t'.repeat(300)}</title><description>${'s'.repeat(500)}</description><link>https://example.com/l</link></item>`))[0]!;
    expect([long.title.length, long.summary!.length]).toEqual([200, 300]);
  });

  it('drops the source suffix from a headline, and can ignore summaries (a feed with only links)', () => {
    const xml = wrap(`<item><title>Storm closes ports - AP News</title><description>&lt;a href="x"&gt;Storm closes ports&lt;/a&gt;</description><link>https://news.example.com/r</link></item>`);
    expect(parseFeed(xml, { titleSuffix: ' - AP News', summaries: false })).toMatchObject([{ title: 'Storm closes ports', summary: null }]);
  });

  it('returns nothing for something that is not a feed', () => {
    expect(parseFeed('<html><body>Blocked</body></html>')).toEqual([]);
    expect(parseFeed('')).toEqual([]);
  });

  it('only fetches fixed https addresses, one per source', () => {
    for (const s of NEWS_SOURCES) expect(new URL(s.url).protocol).toBe('https:');
    expect(new Set(NEWS_SOURCES.map((s) => s.id)).size).toBe(NEWS_SOURCES.length);
  });
});
