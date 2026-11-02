import { useEffect, useRef } from 'react';

interface Handlers {
  newTask: () => void;
  search: () => void;
  undo: () => void;
  showHelp: () => void;
  /** Push-to-talk: called on Space down/up when it's enabled. */
  pttDown?: () => void;
  pttUp?: () => void;
}

/** True when the keystroke belongs to a text field, so shortcuts must stay out of the way. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Global keyboard shortcuts: N new task, / search, Space (hold) push-to-talk,
 * Ctrl/Cmd+Z undo, ? help. Single-key shortcuts are ignored while typing
 * and when a modal dialog is open; Ctrl+Z inside a text field is left alone so
 * the browser's own text undo still works.
 */
export function useShortcuts(handlers: Handlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    let spaceHeld = false;

    function onKeyDown(e: KeyboardEvent) {
      const h = ref.current;
      if (isTyping(e.target) || document.querySelector('dialog[open]')) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        h.undo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // A focused button already uses Space to "click", so don't hijack it there.
      if (e.code === 'Space' && h.pttDown && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault(); // don't scroll the page
        if (!spaceHeld && !e.repeat) {
          spaceHeld = true;
          h.pttDown();
        }
        return;
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        h.newTask();
      } else if (e.key === '/') {
        e.preventDefault();
        h.search();
      } else if (e.key === '?') {
        e.preventDefault();
        h.showHelp();
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space' && spaceHeld) {
        spaceHeld = false;
        ref.current.pttUp?.();
      }
    }

    // Releasing Space after switching windows would never fire keyup here.
    function onBlur() {
      if (spaceHeld) {
        spaceHeld = false;
        ref.current.pttUp?.();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);
}
