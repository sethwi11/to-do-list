import { useEffect, useRef, useState } from 'react';
import { PdfViewer } from '../files/PdfViewer';
import type { Card } from './cards';
import type { FileEntry } from './useImportSession';

interface SourcePreviewProps {
  entry: FileEntry;
  /** The card being looked at, to jump to its page or highlight its words. */
  focus: Card | null;
  page: number;
  onPage: (page: number) => void;
}

/** The file the cards came from: the picture, the PDF at the right page, or the text with the date marked. */
export function SourcePreview({ entry, focus, page, onPage }: SourcePreviewProps) {
  // The picture's temporary address is made and released together, inside the effect: making it while drawing and releasing it
  // in cleanup breaks whenever React re-runs the effect (it does, on purpose, in development), because the address is gone by then.
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    if (entry.kind !== 'image') {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(entry.file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [entry.file, entry.kind]);

  const mark = useRef<HTMLElement>(null);
  useEffect(() => mark.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), [focus?.key]);

  if (entry.kind === 'image' && imageUrl) {
    return (
      <div className="h-full overflow-auto border border-hairline bg-paper">
        <img src={imageUrl} alt={`The picture ${entry.file.name}`} className="block w-full" />
      </div>
    );
  }
  if (entry.kind === 'pdf') return <PdfViewer source={{ file: entry.file }} page={page} onPageChange={onPage} className="h-full" />;

  // Word, plain text and calendar files: show the text that was read, with the date the focused card came from marked.
  const here = focus && focus.fileIndex >= 0 && !focus.fromCalendarFile ? focus : null;
  const before = here ? entry.text.slice(0, here.charStart) : entry.text;
  const hit = here ? entry.text.slice(here.charStart, here.charEnd) : '';
  const after = here ? entry.text.slice(here.charEnd) : '';
  return (
    <pre className="h-full overflow-auto border border-hairline bg-paper p-4 font-mono text-meta leading-relaxed whitespace-pre-wrap" tabIndex={0} aria-label={`Text of ${entry.file.name}`}>
      {before}
      {hit && (
        <mark ref={mark} className="bg-accent-soft text-ink">
          {hit}
        </mark>
      )}
      {after}
    </pre>
  );
}
