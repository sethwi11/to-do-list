import { describe, expect, it } from 'vitest';

// ocr.ts touches the browser only inside functions, so its pure helper can be imported here.
import { ocrScale } from './ocr';

describe('ocrScale', () => {
  it('leaves a normal-sized picture alone', () => {
    expect(ocrScale(1920, 1080)).toBe(1);
  });
  it('shrinks a huge photo to 2600 on its long side', () => {
    expect(ocrScale(4000, 3000)).toBeCloseTo(0.65);
  });
  it('enlarges a small picture, up to 3x', () => {
    expect(ocrScale(900, 600)).toBe(2);
    expect(ocrScale(300, 200)).toBe(3);
  });
});
