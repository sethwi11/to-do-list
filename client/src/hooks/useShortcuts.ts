import { useEffect, useRef } from 'react';

interface Handlers {
  newTask: () => void;
  search: () => void;
  undo: () => void;
  showHelp: () => void;
}

/** True when the keystroke belongs to a text field, so shortcuts must stay out of the way. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Global keyboard shortcuts: N new task, / search, Ctrl/Cmd+Z undo, ? help. */
export function useShortcuts(handlers: Handlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const h = ref.current;
      if (isTyping(e.target) || document.querySelector('dialog[open]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        h.undo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const action = { n: h.newTask, N: h.newTask, '/': h.search, '?': h.showHelp }[e.key];
      if (action) {
        e.preventDefault();
        action();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
