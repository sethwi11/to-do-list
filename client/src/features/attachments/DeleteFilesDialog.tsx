import { useCallback, useRef, useState } from 'react';
import type { AttachmentOwnerType } from '@todo/shared';
import { useQueryClient } from '@tanstack/react-query';
import { attachmentsApi, type AttachmentWithUse } from '../../api/attachments';
import { formatBytes } from '../../lib/files/fileTypes';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Panel';
import { attachmentsKey } from './useAttachments';

export type FilesChoice = 'delete' | 'keep';

interface Pending {
  title: string;
  files: AttachmentWithUse[];
}

export interface FilesToConfirm {
  ownerType: AttachmentOwnerType;
  ownerId: string;
}

/**
 * Deleting an event or to-do that has files only used by it: ask whether to delete the files too.
 * Resolves to `{ proceed: false }` if they cancel. Otherwise `proceed: true`, and, if they chose to delete the files,
 * a `commit` to run once the Undo window has closed (deleting a file can't be undone, so it waits for that).
 */
export function useFileDeletionPrompt() {
  const qc = useQueryClient();
  const resolver = useRef<((choice: FilesChoice | null) => void) | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const answer = useCallback((choice: FilesChoice | null) => {
    const resolve = resolver.current;
    resolver.current = null;
    setPending(null);
    resolve?.(choice);
  }, []);

  const confirmFiles = useCallback(
    async (owners: FilesToConfirm[], title: string): Promise<{ proceed: boolean; commit?: () => void }> => {
      // Files used by anything else stay no matter what; only the ones this item alone uses are in question.
      const lists = await Promise.all(owners.map((o) => qc.fetchQuery({ queryKey: attachmentsKey(o), queryFn: () => attachmentsApi.forOwner(o), staleTime: 0 }).catch(() => [] as AttachmentWithUse[])));
      const sole = [...new Map(lists.flat().filter((f) => f.linkCount === 1).map((f) => [f.id, f])).values()];
      if (sole.length === 0) return { proceed: true };

      resolver.current?.(null);
      const choice = await new Promise<FilesChoice | null>((resolve) => {
        resolver.current = resolve;
        setPending({ title, files: sole });
      });
      if (choice === null) return { proceed: false };
      if (choice === 'keep') return { proceed: true };
      return {
        proceed: true,
        commit: () => {
          void Promise.allSettled(sole.map((f) => attachmentsApi.remove(f.id))).then(() => qc.invalidateQueries({ queryKey: ['attachments'] }));
        },
      };
    },
    [qc],
  );

  return { confirmFiles, dialog: { pending, onAnswer: answer } };
}

export function DeleteFilesDialog({ pending, onAnswer }: { pending: Pending | null; onAnswer: (choice: FilesChoice | null) => void }) {
  const count = pending?.files.length ?? 0;
  return (
    <Dialog
      open={pending !== null}
      onClose={() => onAnswer(null)}
      title={count === 1 ? 'Delete the attached file too?' : 'Delete the attached files too?'}
      footer={
        <>
          <Button variant="ghost" onClick={() => onAnswer(null)}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => onAnswer('keep')}>
            Keep {count === 1 ? 'the file' : 'the files'}
          </Button>
          <Button variant="primary" data-autofocus onClick={() => onAnswer('delete')}>
            Delete {count === 1 ? 'it' : 'them'} too
          </Button>
        </>
      }
    >
      {pending && (
        <>
          <p className="mb-3 text-body text-ink-muted">“{pending.title}” is the only thing {count === 1 ? 'this file is' : 'these files are'} attached to.</p>
          <ul className="space-y-1">
            {pending.files.map((f) => (
              <li key={f.id} className="flex items-baseline justify-between gap-3 border-b border-hairline py-1.5 text-body">
                <span className="min-w-0 truncate">{f.filename}</span>
                <span className="shrink-0 font-mono text-meta text-ink-muted">{formatBytes(f.size)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-meta text-ink-muted">If you delete {count === 1 ? 'it' : 'them'}, you can still undo deleting the item right after, but the file won’t come back.</p>
        </>
      )}
    </Dialog>
  );
}
