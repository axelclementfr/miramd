import { describe, it, expect } from 'vitest';
import { computeProportionalScroll } from '$lib/services/splitScrollSync';

describe('computeProportionalScroll — proportional split sync', () => {
  it('top of source maps to top of destination', () => {
    expect(computeProportionalScroll(0, 1000, 2000)).toBe(0);
  });

  it('bottom of source maps to bottom of destination', () => {
    expect(computeProportionalScroll(1000, 1000, 2000)).toBe(2000);
  });

  it('middle of source maps to middle of destination', () => {
    expect(computeProportionalScroll(500, 1000, 2000)).toBe(1000);
  });

  it('proportional: 25% scrolled source → 25% scrolled destination', () => {
    expect(computeProportionalScroll(250, 1000, 4000)).toBe(1000);
  });

  it('rounds the result to an integer', () => {
    // 333 / 1000 * 1000 = 333 exact
    expect(computeProportionalScroll(333, 1000, 1000)).toBe(333);
    // 333 / 1000 * 999 = 332.667 → 333 (rounded)
    expect(computeProportionalScroll(333, 1000, 999)).toBe(333);
  });

  it('returns 0 when destination is not scrollable (dstMaxScroll <= 0)', () => {
    expect(computeProportionalScroll(500, 1000, 0)).toBe(0);
    expect(computeProportionalScroll(500, 1000, -10)).toBe(0);
  });

  it('returns 0 when source is not scrollable (srcMaxScroll <= 0)', () => {
    expect(computeProportionalScroll(0, 0, 2000)).toBe(0);
    expect(computeProportionalScroll(50, 0, 2000)).toBe(0);
  });

  it('clamps when source scrollTop exceeds srcMaxScroll (over-scroll)', () => {
    // ratio capped at 1
    expect(computeProportionalScroll(2000, 1000, 500)).toBe(500);
  });

  it('clamps when source scrollTop is negative (rare bounce/elastic)', () => {
    expect(computeProportionalScroll(-50, 1000, 2000)).toBe(0);
  });

  it('handles tiny destination (e.g. preview shorter than source)', () => {
    // source ratio 0.5 → dst ratio 0.5 → 5
    expect(computeProportionalScroll(500, 1000, 10)).toBe(5);
  });

  it('handles huge destination (preview much taller than source)', () => {
    expect(computeProportionalScroll(100, 1000, 100000)).toBe(10000);
  });
});
