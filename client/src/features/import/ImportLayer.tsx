import { useEffect, useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { ACCEPT } from '../../lib/files/fileTypes';

interface ImportLayerProps {
  /** Called with the files the person dropped, pasted or picked. */
  onFiles: (files: File[]) => void;
  /** Hand back a function that opens the file picker. */
  registerPicker: (open: () => void) => void;
  /** An import is already open: don't start another underneath it. */
  busy: boolean;
}

const dragHasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');

/** Is the person typing somewhere? Then Ctrl/Cmd+V is for that field, not for us. */
const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * The ways in that aren't a button: a file dragged onto the page (with a full-page drop target while it's over),
 * and a screenshot pasted with Ctrl/Cmd+V. Also owns the hidden file picker the buttons open.
 *
 * Works on every page, not only the calendar: a file dropped where nothing is listening would make the browser
 * navigate away to it, losing your place.
 */
export function ImportLayer({ onFiles, registerPicker, busy }: ImportLayerProps) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0); // dragenter/dragleave fire for every child element crossed; count them to know when the drag really left
  const latest = useRef({ onFiles, busy });
  latest.current = { onFiles, busy };

  useEffect(() => registerPicker(() => input.current?.click()), [registerPicker]);

  useEffect(() => {
    const enter = (e: DragEvent) => {
      if (!dragHasFiles(e) || latest.current.busy) return;
      e.preventDefault();
      depth.current++;
      setDragging(true);
    };
    const over = (e: DragEvent) => {
      if (!dragHasFiles(e)) return;
      e.preventDefault(); // allows a drop here (and stops the browser from opening the file)
      if (e.dataTransfer) e.dataTransfer.dropEffect = latest.current.busy ? 'none' : 'copy';
    };
    const leave = (e: DragEvent) => {
      if (!dragHasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!dragHasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      if (!latest.current.busy) latest.current.onFiles([...(e.dataTransfer?.files ?? [])]);
    };
    const paste = (e: ClipboardEvent) => {
      if (latest.current.busy || isTyping(e.target)) return;
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length === 0) return;
      e.preventDefault();
      latest.current.onFiles(files);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    window.addEventListener('paste', paste);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
      window.removeEventListener('paste', paste);
    };
  }, []);

  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        aria-label="Choose files to find events in"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = ''; // so choosing the same file again still counts
          if (files.length) onFiles(files);
        }}
      />
      {dragging && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] grid place-items-center bg-paper/90">
          <div className="m-4 flex max-w-lg flex-col items-center gap-3 border-2 border-dashed border-accent bg-surface px-10 py-12 text-center">
            <FileUp className="size-8 text-accent-ink" aria-hidden />
            <p className="font-display text-section">Drop files to find events in them</p>
            <p className="text-body text-ink-muted">Pictures, PDFs, Word documents, text, or calendar files. You’ll review everything before it’s added.</p>
          </div>
        </div>
      )}
    </>
  );
}
