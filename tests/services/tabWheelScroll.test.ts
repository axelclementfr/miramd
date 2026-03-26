import { describe, it, expect } from 'vitest';
import { computeTabWheelScroll } from '$lib/services/tabWheelScroll';

const base = { scrollLeft: 0, scrollWidth: 1000, clientWidth: 400, deltaY: 0, deltaX: 0 };

describe('computeTabWheelScroll', () => {
  it('returns no scroll change when content fits (no overflow)', () => {
    const r = computeTabWheelScroll({ ...base, scrollWidth: 300, deltaY: 100 });
    expect(r.preventDefault).toBe(false);
    expect(r.newScrollLeft).toBe(0);
  });

  it('returns no scroll change when delta is zero', () => {
    const r = computeTabWheelScroll({ ...base, scrollLeft: 100, deltaY: 0, deltaX: 0 });
    expect(r.preventDefault).toBe(false);
    expect(r.newScrollLeft).toBe(100);
  });

  it('scrolls right when deltaY positive and not at end', () => {
    const r = computeTabWheelScroll({ ...base, scrollLeft: 0, deltaY: 50 });
    expect(r.preventDefault).toBe(true);
    expect(r.newScrollLeft).toBe(50);
  });

  it('scrolls left when deltaY negative and not at start', () => {
    const r = computeTabWheelScroll({ ...base, scrollLeft: 200, deltaY: -50 });
    expect(r.preventDefault).toBe(true);
    expect(r.newScrollLeft).toBe(150);
  });

  it('CLAMPS to 0 instead of returning early — must reach first tab', () => {
    // Bug fix regression: previously this returned without setting scrollLeft,
    // so a quick wheel-left at scrollLeft=10 would leave you at 10, never 0.
    const r = computeTabWheelScroll({ ...base, scrollLeft: 10, deltaY: -50 });
    expect(r.preventDefault).toBe(true);
    expect(r.newScrollLeft).toBe(0);
  });

  it('clamps to max instead of returning early — must reach last tab', () => {
    const max = 600; // scrollWidth(1000) - clientWidth(400)
    const r = computeTabWheelScroll({ ...base, scrollLeft: 580, deltaY: 100 });
    expect(r.preventDefault).toBe(true);
    expect(r.newScrollLeft).toBe(max);
  });

  it('does nothing and lets the page scroll when already at left edge with leftward delta', () => {
    const r = computeTabWheelScroll({ ...base, scrollLeft: 0, deltaY: -50 });
    expect(r.preventDefault).toBe(false);
    expect(r.newScrollLeft).toBe(0);
  });

  it('does nothing and lets the page scroll when already at right edge with rightward delta', () => {
    const max = 600;
    const r = computeTabWheelScroll({ ...base, scrollLeft: max, deltaY: 50 });
    expect(r.preventDefault).toBe(false);
    expect(r.newScrollLeft).toBe(max);
  });

  it('falls back to deltaX when deltaY is zero (trackpad horizontal swipe)', () => {
    const r = computeTabWheelScroll({ ...base, scrollLeft: 100, deltaY: 0, deltaX: 30 });
    expect(r.preventDefault).toBe(true);
    expect(r.newScrollLeft).toBe(130);
  });

  it('prefers deltaY over deltaX when both are non-zero', () => {
    const r = computeTabWheelScroll({ ...base, scrollLeft: 100, deltaY: -40, deltaX: 80 });
    expect(r.preventDefault).toBe(true);
    expect(r.newScrollLeft).toBe(60);
  });

  it('handles negative scrollWidth-clientWidth gracefully (max=0)', () => {
    const r = computeTabWheelScroll({ ...base, scrollWidth: 300, clientWidth: 400, deltaY: 50 });
    expect(r.preventDefault).toBe(false);
    expect(r.newScrollLeft).toBe(0);
  });
});
