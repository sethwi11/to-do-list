// Headlines on click: a few free public news feeds, read only when you ask. The server fetches one fixed address per source (never one you type).

export interface NewsSource {
  id: 'npr' | 'bbc' | 'pbs' | 'ap';
  name: string;
  url: string;
  /** Does the feed carry a one-line summary per story? (Google's feed for AP doesn't.) */
  summaries: boolean;
  /** Dropped from the end of each headline ("... - AP News"). */
  titleSuffix?: string;
  note?: string;
}

export const NEWS_SOURCES: readonly NewsSource[] = [
  { id: 'npr', name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml', summaries: true },
  { id: 'bbc', name: 'BBC', url: 'https://feeds.bbci.co.uk/news/rss.xml', summaries: true },
  { id: 'pbs', name: 'PBS NewsHour', url: 'https://www.pbs.org/newshour/feeds/rss/headlines', summaries: true },
  { id: 'ap', name: 'AP News', url: 'https://news.google.com/rss/search?q=site:apnews.com+when:1d&hl=en-US&gl=US&ceid=US:en', summaries: false, titleSuffix: ' - AP News', note: 'AP headlines through Google News, so headlines only' },
];

export interface Headline {
  title: string;
  /** The publisher's own one-line summary, if the feed has one. */
  summary: string | null;
  link: string;
  publishedAt: string | null;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1]!.toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
const stripTags = (s: string) => s.replace(/<[^>]*>/g, ' ');
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
const CDATA = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/;

/** The text of the first <tag> in an item, as plain text: entities decoded and any HTML removed (CDATA holds raw HTML; otherwise the HTML arrives escaped). */
function text(item: string, tag: string): string | null {
  const raw = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i').exec(item)?.[1];
  if (raw === undefined) return null;
  const cdata = CDATA.exec(raw)?.[1];
  return squash(cdata !== undefined ? decode(stripTags(cdata)) : stripTags(decode(raw)));
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** The stories in an RSS feed, newest as the feed orders them. Only https links, only text (nothing from a feed is ever shown as HTML). */
export function parseFeed(xml: string, { limit = 12, summaries = true, titleSuffix }: { limit?: number; summaries?: boolean; titleSuffix?: string } = {}): Headline[] {
  const out: Headline[] = [];
  for (const [, item] of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    let title = text(item!, 'title');
    const link = text(item!, 'link');
    if (!title || !link) continue;
    if (titleSuffix && title.endsWith(titleSuffix)) title = title.slice(0, -titleSuffix.length);
    try {
      if (new URL(link).protocol !== 'https:') continue;
    } catch {
      continue;
    }
    const summary = summaries ? text(item!, 'description') : null;
    const published = text(item!, 'pubDate');
    const time = published ? Date.parse(published) : NaN;
    out.push({ title: clip(title, 200), summary: summary && summary !== title ? clip(summary, 300) : null, link, publishedAt: Number.isNaN(time) ? null : new Date(time).toISOString() });
    if (out.length === limit) break;
  }
  return out;
}
