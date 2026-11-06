/** One piece of text on a PDF page, as pdf.js reports it: the text, and where it sits. */
export interface PdfTextItem {
  str: string;
  /** The usual 6-number transform: [scaleX, skewY, skewX, scaleY, x, y]. */
  transform: number[];
  width: number;
}

const LINE_TOLERANCE = 3; // points: two fragments this close in height are on one line
const COLUMN_GAP = 14; // points: a gap this wide between fragments is a table column, not a word space

/**
 * pdf.js gives a page's text as loose fragments with positions. Put them back into lines (fragments
 * at the same height, left to right), keep table columns apart with a wide space (the event finder
 * splits rows on those), and leave a blank line where the vertical gap is much bigger than usual,
 * so paragraphs stay paragraphs.
 */
export function textFromItems(items: PdfTextItem[]): string {
  const pieces = items.filter((i) => i.str.trim() !== '' || i.str === ' ').map((i) => ({ text: i.str, x: i.transform[4]!, y: i.transform[5]!, width: i.width }));
  if (pieces.length === 0) return '';

  // Group by height, top of the page first (PDF y grows upward).
  const sorted = [...pieces].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { y: number; parts: typeof pieces }[] = [];
  for (const p of sorted) {
    const line = lines.find((l) => Math.abs(l.y - p.y) <= LINE_TOLERANCE);
    if (line) line.parts.push(p);
    else lines.push({ y: p.y, parts: [p] });
  }
  lines.sort((a, b) => b.y - a.y);

  const gaps = lines.slice(1).map((l, i) => lines[i]!.y - l.y);
  const typical = gaps.length ? [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)]! : 0;

  const out: string[] = [];
  lines.forEach((line, i) => {
    const parts = line.parts.sort((a, b) => a.x - b.x);
    let text = '';
    parts.forEach((p, n) => {
      if (n > 0) {
        const prev = parts[n - 1]!;
        const gap = p.x - (prev.x + prev.width);
        text += gap > COLUMN_GAP ? '   ' : gap > 1 && !text.endsWith(' ') && !p.text.startsWith(' ') ? ' ' : '';
      }
      text += p.text;
    });
    if (i > 0 && typical > 0 && lines[i - 1]!.y - line.y > typical * 1.8) out.push('');
    out.push(text.replace(/\s+$/, ''));
  });
  return out.join('\n');
}
