/*
 * Turns a continuous stream of speech-recognition results into chunks to send
 * for extraction. A chunk is emitted when EITHER:
 *   - the speaker goes quiet for `silenceMs` (default 4s): a natural pause, or
 *   - they've talked for `maxChunkMs` (default 60s) without a long pause, so
 *     tasks show up while someone rambles instead of only at the very end.
 *
 * This class is pure logic with injectable timers and clock: no browser APIs,
 * so it's fully unit-testable with fake timers (see transcriptChunker.test.ts).
 */

export interface ChunkerOptions {
  onChunk: (text: string) => void;
  silenceMs?: number;
  maxChunkMs?: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export class TranscriptChunker {
  private finals: string[] = [];
  private interimText = '';
  private chunkStartedAt: number | null = null;
  private silenceTimer: unknown = null;
  private maxTimer: unknown = null;
  /** Interim text we already sent on a silence flush; its late "final" version is dropped. */
  private flushedInterim = '';

  private readonly silenceMs: number;
  private readonly maxChunkMs: number;
  private readonly now: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;

  constructor(private readonly opts: ChunkerOptions) {
    this.silenceMs = opts.silenceMs ?? 4000;
    this.maxChunkMs = opts.maxChunkMs ?? 60_000;
    this.now = opts.now ?? (() => Date.now());
    this.setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  /** A finalized phrase from the recognizer. */
  addFinal(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (this.flushedInterim && normalize(trimmed) === this.flushedInterim) {
      // Already sent as interim text when the silence flush happened.
      this.flushedInterim = '';
      return;
    }
    this.flushedInterim = '';
    this.finals.push(trimmed);
    this.interimText = '';
    this.onActivity();
  }

  /** The recognizer's current best guess for the phrase in progress (replaces the previous one). */
  setInterim(text: string): void {
    this.interimText = text.trim();
    if (this.interimText) this.onActivity();
  }

  /** Everything not yet sent, for showing a live transcript. */
  get pendingText(): string {
    return [...this.finals, this.interimText].filter(Boolean).join(' ');
  }

  /** Emit whatever is buffered (including in-progress interim text) right now. */
  flush(): void {
    const parts = [...this.finals];
    if (this.interimText) {
      parts.push(this.interimText);
      this.flushedInterim = normalize(this.interimText);
    }
    this.finals = [];
    this.interimText = '';
    this.endChunk();
    const text = parts.join(' ').trim();
    if (text) this.opts.onChunk(text);
  }

  /** Drop everything without emitting (e.g. when listening is turned off mid-thought). */
  reset(): void {
    this.finals = [];
    this.interimText = '';
    this.flushedInterim = '';
    this.endChunk();
  }

  private onActivity(): void {
    if (this.chunkStartedAt === null) {
      this.chunkStartedAt = this.now();
      this.maxTimer = this.setTimer(() => this.flushFinalsOnly(), this.maxChunkMs);
    }
    if (this.silenceTimer !== null) this.clearTimer(this.silenceTimer);
    this.silenceTimer = this.setTimer(() => this.flush(), this.silenceMs);
  }

  /** Max-length cut: send finished phrases, keep the phrase in progress for the next chunk. */
  private flushFinalsOnly(): void {
    this.maxTimer = null;
    const text = this.finals.join(' ').trim();
    this.finals = [];
    const interim = this.interimText;
    this.endChunk();
    if (interim) this.onActivity(); // the in-progress phrase starts the next chunk
    if (text) this.opts.onChunk(text);
  }

  private endChunk(): void {
    if (this.silenceTimer !== null) this.clearTimer(this.silenceTimer);
    if (this.maxTimer !== null) this.clearTimer(this.maxTimer);
    this.silenceTimer = null;
    this.maxTimer = null;
    this.chunkStartedAt = null;
  }
}
