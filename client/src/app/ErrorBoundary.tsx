import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../ui/Button';

interface State {
  failed: boolean;
}

/**
 * If something on a page throws while drawing, show a message instead of a blank screen.
 * Only the page area is replaced: the sidebar stays, so there's somewhere to go.
 * (React only supports this as a class component.)
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('A page failed to draw:', error, info.componentStack);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="max-w-[960px] py-10">
        <h1 className="font-display text-page">Something went wrong</h1>
        <p className="mt-2 mb-5 font-display text-title text-ink-muted italic">This page hit a problem and couldn’t be drawn. Your data is safe.</p>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Reload the page
        </Button>
      </div>
    );
  }
}
