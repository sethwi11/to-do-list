import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TranscriptChunker } from './transcriptChunker';

describe('TranscriptChunker', () => {
  let chunks: string[];
  let chunker: TranscriptChunker;

  beforeEach(() => {
    vi.useFakeTimers();
    chunks = [];
    chunker = new TranscriptChunker({ onChunk: (t) => chunks.push(t), silenceMs: 4000, maxChunkMs: 60_000 });
  });
  afterEach(() => vi.useRealTimers());

  it('emits after 4 seconds of silence, joining phrases', () => {
    chunker.addFinal('I need to finish my lab');
    vi.advanceTimersByTime(2000);
    chunker.addFinal('and email Valencia');
    vi.advanceTimersByTime(3999);
    expect(chunks).toEqual([]); // the second phrase reset the silence timer
    vi.advanceTimersByTime(1);
    expect(chunks).toEqual(['I need to finish my lab and email Valencia']);
  });

  it('interim results count as activity (debounce)', () => {
    chunker.addFinal('first');
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(3000);
      chunker.setInterim(`still talking ${i}`);
    }
    expect(chunks).toEqual([]);
  });

  it('cuts a chunk at 60 seconds of continuous talking, keeping the phrase in progress', () => {
    for (let s = 0; s < 61; s += 2) {
      chunker.addFinal(`phrase ${s}`);
      vi.advanceTimersByTime(2000);
    }
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatch(/^phrase 0 phrase 2 .* phrase 58$/);
  });

  it('includes unfinished interim text on a silence flush and drops its late final duplicate', () => {
    chunker.setInterim('pick up groceries');
    vi.advanceTimersByTime(4000);
    expect(chunks).toEqual(['pick up groceries']);
    chunker.addFinal('Pick up groceries.'); // the recognizer finalizes the same words late
    vi.advanceTimersByTime(4000);
    expect(chunks).toHaveLength(1);
  });

  it('ignores empty input and reset() discards without emitting', () => {
    chunker.addFinal('   ');
    chunker.setInterim('');
    vi.advanceTimersByTime(10_000);
    expect(chunks).toEqual([]);
    chunker.addFinal('something');
    chunker.reset();
    vi.advanceTimersByTime(10_000);
    expect(chunks).toEqual([]);
  });

  it('exposes pending text for the live transcript', () => {
    chunker.addFinal('hello');
    chunker.setInterim('wor');
    expect(chunker.pendingText).toBe('hello wor');
  });
});
