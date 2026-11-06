import { describe, expect, it } from 'vitest';
import { textFromItems, type PdfTextItem } from './pdfText';

const item = (str: string, x: number, y: number, width = str.length * 5): PdfTextItem => ({ str, transform: [1, 0, 0, 1, x, y], width });

describe('textFromItems', () => {
  it('puts fragments at the same height on one line, left to right', () => {
    const text = textFromItems([item('world', 40, 700), item('Hello', 10, 700)]);
    expect(text).toBe('Hello world');
  });

  it('starts a new line for a different height, top of the page first', () => {
    expect(textFromItems([item('second', 10, 680), item('first', 10, 700)])).toBe('first\nsecond');
  });

  it('keeps table columns apart with a wide space', () => {
    const text = textFromItems([item('Oct 6', 10, 700), item('Quiz 1', 140, 700)]);
    expect(text).toBe('Oct 6   Quiz 1');
  });

  it('joins fragments that touch without adding a space', () => {
    expect(textFromItems([item('Mid', 10, 700, 15), item('term', 25, 700, 20)])).toBe('Midterm');
  });

  it('leaves a blank line where the vertical gap is much bigger than usual', () => {
    const text = textFromItems([item('a', 10, 700), item('b', 10, 686), item('c', 10, 672), item('d', 10, 600)]);
    expect(text).toBe('a\nb\nc\n\nd');
  });

  it('tolerates a few points of wobble and ignores empty fragments', () => {
    expect(textFromItems([item('one', 10, 700), item('two', 32, 698.5), item('', 90, 700)])).toBe('one two');
    expect(textFromItems([])).toBe('');
  });
});
