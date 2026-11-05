import { describe, expect, it } from 'vitest';
import { msUntilNextMidnight } from './useToday';

describe('msUntilNextMidnight', () => {
  it('counts to the next local midnight', () => {
    expect(msUntilNextMidnight(new Date(2026, 10, 4, 23, 30))).toBe(30 * 60_000);
    expect(msUntilNextMidnight(new Date(2026, 10, 4, 0, 0, 0))).toBe(24 * 3_600_000);
    expect(msUntilNextMidnight(new Date(2026, 11, 31, 23, 59, 30))).toBe(30_000); // year boundary
  });
});
