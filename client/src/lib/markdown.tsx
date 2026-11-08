import { Fragment, type ReactNode } from 'react';

// A small, safe Markdown renderer for notes.

type Block = { kind: 'heading'; level: 1 | 2 | 3; text: string } | { kind: 'ul' | 'ol'; items: string[] } | { kind: 'p'; lines: string[] };

export function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const endParagraph = () => {
    if (paragraph.length > 0) blocks.push({ kind: 'p', lines: paragraph });
    paragraph = [];
  };
  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const bullet = /^\s*[-*+]\s+(.+)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (line.trim() === '') {
      endParagraph();
    } else if (heading) {
      endParagraph();
      blocks.push({ kind: 'heading', level: heading[1]!.length as 1 | 2 | 3, text: heading[2]! });
    } else if (bullet || numbered) {
      endParagraph();
      const kind = bullet ? 'ul' : 'ol';
      const item = (bullet ?? numbered)![1]!;
      const last = blocks.at(-1);
      if (last && last.kind === kind) last.items.push(item);
      else blocks.push({ kind, items: [item] });
    } else {
      paragraph.push(line.trim());
    }
  }
  endParagraph();
  return blocks;
}

// Like standard Markdown, a ** or * mark must hug its text ("*hi*", not "* hi *"), so "2 * 3" stays plain text.
const INLINE = /(\*\*[^\s*](?:[^*\n]*[^\s*])?\*\*|\*[^\s*](?:[^*\n]*[^\s*])?\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/g;

/** Text with the inline marks turned into elements. */
export function renderInline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={i} className="rounded-control bg-surface px-1 font-mono text-[0.9em]">{part.slice(1, -1)}</code>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link && /^https?:\/\//i.test(link[2]!)) {
      return (
        <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline underline-offset-2">
          {link[1]}
        </a>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

const HEADINGS = {
  1: 'font-display text-section',
  2: 'font-display text-title',
  3: 'text-label text-ink-muted uppercase',
} as const;

/** Notes as paragraphs, headings and lists in the app's type. */
export function Markdown({ source, className }: { source: string; className?: string }) {
  return (
    <div className={className}>
      {parseBlocks(source).map((b, i) => {
        if (b.kind === 'heading') {
          const Tag = (`h${b.level + 2}` as 'h3' | 'h4' | 'h5'); // below the page's own headings
          return (
            <Tag key={i} className={`${HEADINGS[b.level]} mt-4 mb-1 first:mt-0`}>
              {renderInline(b.text)}
            </Tag>
          );
        }
        if (b.kind === 'p') {
          return (
            <p key={i} className="mb-3 text-body last:mb-0">
              {b.lines.map((line, n) => (
                <Fragment key={n}>
                  {n > 0 && <br />}
                  {renderInline(line)}
                </Fragment>
              ))}
            </p>
          );
        }
        const List = b.kind;
        return (
          <List key={i} className={`mb-3 ml-5 text-body last:mb-0 ${b.kind === 'ul' ? 'list-disc' : 'list-decimal'}`}>
            {b.items.map((item, n) => (
              <li key={n}>{renderInline(item)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
