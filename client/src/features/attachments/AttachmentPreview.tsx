import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { attachmentsApi } from '../../api/attachments';
import type { Attachment } from '@todo/shared';
import { formatBytes } from '../../lib/files/fileTypes';
import { Dialog } from '../../ui/Panel';
import { PdfViewer } from './PdfViewer';

/** Plain text, fetched when the dialog opens. */
function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetch(url).then((r) => r.text()).then((t) => !cancelled && setText(t)).catch(() => !cancelled && setText('This file couldn’t be shown.'));
    return () => {
      cancelled = true;
    };
  }, [url]);
  return <pre className="h-full overflow-auto border border-hairline bg-paper p-4 font-mono text-meta whitespace-pre-wrap">{text ?? 'Loading…'}</pre>;
}

/** A stored file shown in a window: images and PDFs and text in place; anything else as a download. */
export function AttachmentPreview({ file, onClose }: { file: Attachment | null; onClose: () => void }) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [file?.id]);

  const url = file ? attachmentsApi.fileUrl(file.id) : '';
  const isPdf = file?.mimeType === 'application/pdf';
  const isText = file?.mimeType.startsWith('text/plain');
  const isImage = file && ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimeType);

  return (
    <Dialog
      open={file !== null}
      onClose={onClose}
      size="full"
      title={file?.filename ?? ''}
      footer={
        file && (
          <>
            <span className="mr-auto self-center font-mono text-meta text-ink-muted">{formatBytes(file.size)}</span>
            <a
              href={attachmentsApi.fileUrl(file.id, true)}
              download={file.filename}
              className="inline-flex h-8 items-center gap-2 rounded-control border border-ink px-3 text-body font-medium text-ink transition-colors duration-150 ease-out hover:bg-accent-soft"
            >
              <Download className="size-4" aria-hidden />
              Download
            </a>
          </>
        )
      }
    >
      {file && (
        <div className="flex h-full min-h-0 flex-col">
          {isImage && <img src={url} alt={file.filename} className="mx-auto max-h-full max-w-full object-contain" />}
          {isPdf && <PdfViewer source={{ url }} page={page} onPageChange={setPage} className="h-full" />}
          {isText && <TextPreview url={url} />}
          {!isImage && !isPdf && !isText && <p className="py-10 text-center font-display text-title text-ink-muted italic">There’s no preview for this kind of file. Use Download to open it.</p>}
        </div>
      )}
    </Dialog>
  );
}
