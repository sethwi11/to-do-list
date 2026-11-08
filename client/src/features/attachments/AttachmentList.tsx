import { useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Paperclip, X } from 'lucide-react';
import { useApp } from '../../app/AppContext';
import type { AttachmentWithUse, Owner } from '../../api/attachments';
import { ACCEPT, fileProblem, formatBytes } from '../../lib/files/fileTypes';
import { cx } from '../../lib/cx';
import { detach, uploadAndLink, useOwnerAttachments, useRefreshAttachments } from './useAttachments';
import { AttachmentPreview } from './AttachmentPreview';

interface AttachmentListProps {
  /** The item the files belong to, or null for one that isn't saved yet (then `pending` holds the files until it is). */
  owner: Owner | null;
  /** Show Attach and remove buttons. Otherwise it only lists the files. */
  editable?: boolean;
  pending?: File[];
  onPendingChange?: (files: File[]) => void;
  className?: string;
}

const iconFor = (mime: string) => (mime.startsWith('image/') ? ImageIcon : FileText);

/** The files on an item. */
export function AttachmentList({ owner, editable = false, pending = [], onPendingChange, className }: AttachmentListProps) {
  const { showToast } = useApp();
  const { data: files = [] } = useOwnerAttachments(owner);
  const refresh = useRefreshAttachments();
  const [open, setOpen] = useState<AttachmentWithUse | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function add(chosen: File[]) {
    const ok = chosen.filter((f) => {
      const problem = fileProblem(f);
      if (problem) showToast(problem);
      return !problem;
    });
    if (ok.length === 0) return;
    if (!owner) {
      onPendingChange?.([...pending, ...ok]);
      return;
    }
    const problems = await uploadAndLink(ok, owner);
    if (problems.length) showToast(problems[0]!);
    await refresh(owner);
  }

  async function remove(file: AttachmentWithUse) {
    if (!owner) return;
    try {
      await detach(file, owner);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'That file couldn’t be removed.');
    }
    await refresh(owner);
  }

  if (!editable && files.length === 0 && pending.length === 0) return null;

  return (
    <div className={className}>
      <ul className="flex flex-wrap gap-2">
        {files.map((f) => {
          const Icon = iconFor(f.mimeType);
          return (
            <li key={f.id} className="flex items-center rounded-control border border-rule bg-surface">
              <button type="button" onClick={() => setOpen(f)} title={`Open ${f.filename}`} className="flex max-w-56 items-center gap-1.5 py-1 pr-2 pl-2 text-meta text-ink hover:underline">
                <Icon className="size-4 shrink-0 text-ink-muted" aria-hidden />
                <span className="truncate">{f.filename}</span>
                <span className="shrink-0 font-mono text-time text-ink-muted">{formatBytes(f.size)}</span>
              </button>
              {editable && (
                <button type="button" onClick={() => void remove(f)} aria-label={`Remove ${f.filename}`} className="grid size-7 place-items-center text-ink-muted hover:text-ink">
                  <X className="size-3.5" aria-hidden />
                </button>
              )}
            </li>
          );
        })}
        {pending.map((f, i) => (
          <li key={`${f.name}:${i}`} className="flex items-center rounded-control border border-dashed border-rule bg-surface">
            <span className="flex max-w-56 items-center gap-1.5 py-1 pr-2 pl-2 text-meta text-ink">
              <Paperclip className="size-4 shrink-0 text-ink-muted" aria-hidden />
              <span className="truncate">{f.name}</span>
              <span className="shrink-0 font-mono text-time text-ink-muted">{formatBytes(f.size)}</span>
            </span>
            <button type="button" onClick={() => onPendingChange?.(pending.filter((_, n) => n !== i))} aria-label={`Remove ${f.name}`} className="grid size-7 place-items-center text-ink-muted hover:text-ink">
              <X className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
        {editable && (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className={cx('inline-flex h-[30px] items-center gap-1.5 rounded-control border border-dashed border-rule px-2.5 text-meta text-ink-muted transition-colors duration-150 ease-out hover:border-ink-muted hover:text-ink')}
            >
              <Paperclip className="size-4" aria-hidden />
              Attach a file
            </button>
            <input
              ref={input}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                void add([...(e.target.files ?? [])]);
                e.target.value = ''; // so choosing the same file again still counts
              }}
            />
          </li>
        )}
      </ul>
      <AttachmentPreview file={open} onClose={() => setOpen(null)} />
    </div>
  );
}
