import { describe, expect, it } from 'vitest';
import { ratingShade } from './journal';

describe('ratingShade', () => {
  it('goes from the lightest shade for a rough day to the darkest for a great one', () => {
    expect([1, 3, 4, 5, 6, 7, 8, 10].map(ratingShade)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });
});
