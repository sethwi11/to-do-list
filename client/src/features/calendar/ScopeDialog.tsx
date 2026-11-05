import { useCallback, useId, useRef, useState } from 'react';
import type { EditScope } from '@todo/shared';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Panel';

export type ScopeVerb = 'Edit' | 'Move' | 'Resize' | 'Delete';

export interface ScopeRequest {
  verb: ScopeVerb;
  /** The event's title, shown so it's clear which event is meant. */
  title: string;
}

const OPTIONS: { scope: EditScope; label: string; hint: string }[] = [
  { scope: 'this', label: 'This event', hint: 'Only this date.' },
  { scope: 'following', label: 'This and following events', hint: 'This date and every later one.' },
  { scope: 'all', label: 'All events', hint: 'Every date in the series.' },
];

const CONFIRM_LABEL: Record<ScopeVerb, string> = { Edit: 'Save', Move: 'Move', Resize: 'Resize', Delete: 'Delete' };

/**
 * Asking "which events?" from code that is in the middle of something (a drag, a save) is
 * easiest as a promise: `const scope = await ask(...)`, where null means they cancelled.
 * The dialog itself is rendered from the returned `dialog` props.
 */
export function useScopePrompt() {
  const resolver = useRef<((scope: EditScope | null) => void) | null>(null);
  const [request, setRequest] = useState<ScopeRequest | null>(null);

  const settle = useCallback((scope: EditScope | null) => {
    const resolve = resolver.current;
    resolver.current = null; // closing the dialog also fires onClose: only the first answer counts
    setRequest(null);
    resolve?.(scope);
  }, []);

  const ask = useCallback((next: ScopeRequest) => {
    resolver.current?.(null);
    return new Promise<EditScope | null>((resolve) => {
      resolver.current = resolve;
      setRequest(next);
    });
  }, []);

  return { ask, dialog: { request, onAnswer: settle } };
}

export interface ScopeDialogProps {
  request: ScopeRequest | null;
  onAnswer: (scope: EditScope | null) => void;
}

export function ScopeDialog({ request, onAnswer }: ScopeDialogProps) {
  return (
    <Dialog
      open={request !== null}
      onClose={() => onAnswer(null)}
      title={request ? `${request.verb} repeating event` : ''}
      footer={
        request && (
          <>
            <Button variant="ghost" onClick={() => onAnswer(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="scope-form">
              {CONFIRM_LABEL[request.verb]}
            </Button>
          </>
        )
      }
    >
      {request && <ScopeChoices request={request} onAnswer={onAnswer} />}
    </Dialog>
  );
}

function ScopeChoices({ request, onAnswer }: { request: ScopeRequest; onAnswer: (scope: EditScope | null) => void }) {
  const [scope, setScope] = useState<EditScope>('this');
  const name = useId();
  return (
    <form
      id="scope-form"
      onSubmit={(e) => {
        e.preventDefault();
        onAnswer(scope);
      }}
    >
      <p className="mb-4 text-body text-ink-muted">
        “{request.title}” repeats. Which events should this apply to?
      </p>
      <fieldset className="space-y-1">
        <legend className="sr-only">Which events</legend>
        {OPTIONS.map((o) => (
          <label key={o.scope} className="flex cursor-pointer items-start gap-3 rounded-control px-2 py-2 hover:bg-accent-soft has-checked:bg-accent-soft">
            <input type="radio" name={name} value={o.scope} checked={scope === o.scope} onChange={() => setScope(o.scope)} className="mt-1 accent-accent-ink" data-autofocus={o.scope === 'this' ? true : undefined} />
            <span>
              <span className="block text-body text-ink">{o.label}</span>
              <span className="block text-meta text-ink-muted">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </form>
  );
}
