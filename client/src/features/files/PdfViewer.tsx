import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from '../../lib/cx';
import { openPdf } from '../../lib/files/pdf';
import { IconButton } from '../../ui/Button';

interface PdfViewerProps {
  /** A file the person chose, or a stored file's address. */
  source: { file: File } | { url: string };
  /** 1-based. */
  page: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * A PDF drawn page by page with previous / next, using the same pdf.js that reads the text. A
 * custom viewer (rather than the browser's built-in one) so it looks and behaves the same everywhere,
 * and so the review can jump it to the page a date was found on.
 */
export function PdfViewer({ source, page, onPageChange, className }: PdfViewerProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const key = 'file' in source ? `${source.file.name}:${source.file.size}:${source.file.lastModified}` : source.url;

  useEffect(() => {
    let cancelled = false;
    let opened: PDFDocumentProxy | null = null;
    setDoc(null);
    setError(null);
    (async () => {
      const bytes = 'file' in source ? await source.file.arrayBuffer() : await fetch(source.url).then((r) => r.arrayBuffer());
      opened = await openPdf(bytes);
      if (cancelled) void opened.destroy();
      else setDoc(opened);
    })().catch(() => !cancelled && setError('This PDF couldn’t be shown.'));
    return () => {
      cancelled = true;
      void opened?.destroy();
    };
    // `key` stands for `source`: a new File object for the same file shouldn't reload it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  const pages = doc?.numPages ?? 0;
  const current = Math.min(Math.max(page, 1), Math.max(pages, 1));

  useEffect(() => {
    if (!doc || width === 0 || !canvas.current) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    void doc.getPage(current).then(async (p) => {
      if (cancelled || !canvas.current) return;
      const base = p.getViewport({ scale: 1 });
      const cssScale = width / base.width;
      const dpr = window.devicePixelRatio || 1; // sharp on high-resolution screens
      const viewport = p.getViewport({ scale: cssScale * dpr });
      const el = canvas.current;
      el.width = Math.floor(viewport.width);
      el.height = Math.floor(viewport.height);
      el.style.width = `${Math.floor(viewport.width / dpr)}px`;
      el.style.height = `${Math.floor(viewport.height / dpr)}px`;
      task = p.render({ canvasContext: el.getContext('2d')!, viewport, canvas: el });
      await task.promise.catch(() => undefined); // cancelled by a newer render: fine
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, current, width]);

  return (
    <div className={cx('flex min-h-0 flex-col', className)}>
      {pages > 1 && (
        <div className="mb-2 flex items-center justify-center gap-2">
          <IconButton icon={ChevronLeft} label="Previous page" disabled={current <= 1} onClick={() => onPageChange(current - 1)} />
          <span className="font-mono text-meta text-ink-muted tabular-nums">
            Page {current} of {pages}
          </span>
          <IconButton icon={ChevronRight} label="Next page" disabled={current >= pages} onClick={() => onPageChange(current + 1)} />
        </div>
      )}
      <div ref={wrap} className="min-h-0 flex-1 overflow-auto border border-hairline bg-paper">
        {error ? <p className="p-4 text-body text-danger">{error}</p> : <canvas ref={canvas} className="block" aria-label={`PDF page ${current}`} />}
      </div>
    </div>
  );
}
