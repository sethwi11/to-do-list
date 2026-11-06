import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Markdown, parseBlocks } from './markdown';

const html = (source: string) => renderToStaticMarkup(<Markdown source={source} />);

describe('markdown notes', () => {
  it('splits headings, lists and paragraphs', () => {
    expect(parseBlocks('# Plan\n\nCall Sam\nthen email\n\n- one\n- two\n\n1. first\n2) second')).toEqual([
      { kind: 'heading', level: 1, text: 'Plan' },
      { kind: 'p', lines: ['Call Sam', 'then email'] },
      { kind: 'ul', items: ['one', 'two'] },
      { kind: 'ol', items: ['first', 'second'] },
    ]);
  });

  it('renders bold, italic, code and web links', () => {
    const out = html('**Referred** by *Sam* via `ACM` — see [the post](https://example.com/jobs/1)');
    expect(out).toContain('<strong>Referred</strong>');
    expect(out).toContain('<em>Sam</em>');
    expect(out).toContain('>ACM</code>');
    expect(out).toContain('href="https://example.com/jobs/1"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('never turns a script link into a link, and shows it as text', () => {
    const out = html('[click](javascript:alert(1))');
    expect(out).not.toContain('<a ');
    expect(out).not.toContain('href');
    expect(out).toContain('javascript:alert(1)');
  });

  it('shows markup as text instead of running it', () => {
    const out = html('<script>alert(1)</script> <img src=x onerror=alert(1)>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;script&gt;');
  });

  it('keeps unfinished marks as plain text', () => {
    expect(html('2 * 3 and **oops')).toContain('2 * 3 and **oops');
  });

  it('renders lists as list elements', () => {
    expect(html('- a\n- b')).toMatch(/<ul[^>]*><li>a<\/li><li>b<\/li><\/ul>/);
  });

  it('is empty for empty notes', () => {
    expect(parseBlocks('')).toEqual([]);
    expect(parseBlocks('\n\n  \n')).toEqual([]);
  });
});
