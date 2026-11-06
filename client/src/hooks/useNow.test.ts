import { describe, expect, it } from 'vitest';
import { msUntilNextMinute } from './useNow';

describe('msUntilNextMinute', () => {
  it('counts to the top of the next minute', () => {
    expect(msUntilNextMinute(new Date(2026, 10, 4, 10, 30, 0, 0))).toBe(60_000);
    expect(msUntilNextMinute(new Date(2026, 10, 4, 10, 30, 45, 500))).toBe(14_500);
    expect(msUntilNextMinute(new Date(2026, 10, 4, 10, 30, 59, 999))).toBe(1);
  });
});
