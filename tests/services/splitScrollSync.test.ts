import { describe, it, expect } from 'vitest';
import { computeProportionalScroll, computeAnchoredScroll, type ScrollAnchor } from '$lib/services/splitScrollSync';

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

describe('computeAnchoredScroll — anchor-based sync', () => {
  describe('without anchors → proportional fallback', () => {
    it('top of source maps to 0', () => {
      expect(computeAnchoredScroll(0, 1000, [], 2000, 2500)).toBe(0);
    });

    it('half of source maps to half of dst', () => {
      expect(computeAnchoredScroll(500, 1000, [], 2000, 2500)).toBe(1000);
    });

    it('returns 0 when srcLength is zero', () => {
      expect(computeAnchoredScroll(0, 0, [], 2000, 2500)).toBe(0);
    });

    it('returns 0 when dstMaxScroll <= 0', () => {
      expect(computeAnchoredScroll(500, 1000, [], 0, 2500)).toBe(0);
    });
  });

  describe('with anchors → exact alignment at each anchor', () => {
    const anchors: ScrollAnchor[] = [
      { srcPos: 100, dstTop: 50 },    // heading 1
      { srcPos: 500, dstTop: 800 },   // heading 2 (preview is much taller for this segment — image?)
      { srcPos: 800, dstTop: 900 },   // heading 3 (preview is shorter for this segment)
    ];

    it('aligns exactly at the first anchor', () => {
      expect(computeAnchoredScroll(100, 1000, anchors, 5000, 5500)).toBe(50);
    });

    it('aligns exactly at the second anchor', () => {
      expect(computeAnchoredScroll(500, 1000, anchors, 5000, 5500)).toBe(800);
    });

    it('aligns exactly at the third anchor', () => {
      expect(computeAnchoredScroll(800, 1000, anchors, 5000, 5500)).toBe(900);
    });

    it('interpolates between two anchors (midway between heading 1 and 2)', () => {
      // halfway between srcPos 100 and 500 is 300; halfway between dstTop 50 and 800 is 425
      expect(computeAnchoredScroll(300, 1000, anchors, 5000, 5500)).toBe(425);
    });

    it('interpolates above the first anchor (between (0,0) and first anchor)', () => {
      // halfway between 0 and srcPos 100 is 50; halfway between 0 and dstTop 50 is 25
      expect(computeAnchoredScroll(50, 1000, anchors, 5000, 5500)).toBe(25);
    });

    it('interpolates below the last anchor (between last anchor and (srcLength, dstScrollHeight))', () => {
      // halfway between srcPos 800 and srcLength 1000 is 900;
      // halfway between dstTop 900 and dstScrollHeight 5500 is 3200; clamped to dstMaxScroll 5000
      expect(computeAnchoredScroll(900, 1000, anchors, 5000, 5500)).toBe(3200);
    });

    it('clamps to dstMaxScroll when extrapolation would exceed it', () => {
      // at srcCharPos = srcLength (1000), interpolation goes from (800, 900) to (1000, 5500) → 5500
      // but dstMaxScroll is 5000 → clamped
      expect(computeAnchoredScroll(1000, 1000, anchors, 5000, 5500)).toBe(5000);
    });

    it('clamps to 0 when srcCharPos is negative (defensive)', () => {
      expect(computeAnchoredScroll(-50, 1000, anchors, 5000, 5500)).toBe(0);
    });
  });

  describe('edge cases with anchors', () => {
    it('single anchor at start: linear from (0,0) to (srcLength, dstScrollHeight) via the anchor', () => {
      const anchors = [{ srcPos: 0, dstTop: 0 }];
      // Without next anchor, segment is [0, srcLength=1000] → [0, dstScrollHeight=2500]
      expect(computeAnchoredScroll(500, 1000, anchors, 2000, 2500)).toBe(1250);
      // But clamped to dstMaxScroll 2000 if the result exceeds
      expect(computeAnchoredScroll(1000, 1000, anchors, 2000, 2500)).toBe(2000);
    });

    it('two anchors at the same srcPos (degenerate): picks the last matching anchor, no division by zero', () => {
      const anchors = [
        { srcPos: 100, dstTop: 50 },
        { srcPos: 100, dstTop: 200 },
      ];
      // Both anchors match (srcPos 100 <= 100); the loop keeps the last → prevDst = 200.
      // No NEXT anchor → segment is [(100, 200), (srcLength=1000, dstScrollHeight=5500)].
      // fraction = (100 - 100) / 900 = 0 → returns 200.
      expect(computeAnchoredScroll(100, 1000, anchors, 5000, 5500)).toBe(200);
    });

    it('source position before any anchor uses (0, 0) as the previous virtual anchor', () => {
      const anchors = [{ srcPos: 200, dstTop: 100 }];
      // halfway from (0, 0) to (200, 100): srcCharPos 100 → dst 50
      expect(computeAnchoredScroll(100, 1000, anchors, 5000, 5500)).toBe(50);
    });
  });
});
