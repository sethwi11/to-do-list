import { describe, expect, it } from 'vitest';
import { placePopover } from './Popover';

const viewport = { width: 1000, height: 700 };

describe('placePopover', () => {
  it('goes to the right of a point, lined up with it', () => {
    expect(placePopover({ x: 100, y: 100 }, 320, 200, viewport)).toEqual({ left: 108, top: 100 });
  });

  it('flips to the left when there is no room on the right', () => {
    const { left } = placePopover({ left: 700, top: 100, right: 900, bottom: 140 }, 320, 200, viewport);
    expect(left).toBe(700 - 8 - 320);
  });

  it('is kept inside the screen at the bottom and at the edges', () => {
    expect(placePopover({ x: 100, y: 650 }, 320, 200, viewport).top).toBe(700 - 8 - 200);
    expect(placePopover({ x: 10, y: -50 }, 320, 200, viewport).top).toBe(8);
    expect(placePopover({ x: 990, y: 100 }, 320, 200, viewport).left).toBe(990 - 8 - 320);
    // narrower than the panel: pinned to the left margin instead of off-screen
    expect(placePopover({ x: 100, y: 100 }, 320, 200, { width: 300, height: 700 }).left).toBe(8);
  });
});
