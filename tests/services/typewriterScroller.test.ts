import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({}),
}));

// Mock muyaService with controllable callbacks
const changeCallbacks: (() => void)[] = [];
const selectionCallbacks: (() => void)[] = [];

vi.mock('$lib/services/muya', () => ({
  muyaService: {
    onChange: vi.fn((cb: () => void) => {
      changeCallbacks.push(cb);
      return () => {
        const idx = changeCallbacks.indexOf(cb);
        if (idx >= 0) changeCallbacks.splice(idx, 1);
      };
    }),
    onSelectionChange: vi.fn((cb: () => void) => {
      selectionCallbacks.push(cb);
      return () => {
        const idx = selectionCallbacks.indexOf(cb);
        if (idx >= 0) selectionCallbacks.splice(idx, 1);
      };
    }),
  },
}));

const { initTypewriterScroller, computeTypewriterOffset } = await import('$lib/services/typewriterScroller');

describe('initTypewriterScroller', () => {
  let paneElement: HTMLElement;
  let cleanups: (() => void)[];
  let enabled: boolean;

  beforeEach(() => {
    paneElement = document.createElement('div');
    document.body.appendChild(paneElement);
    enabled = true;
    changeCallbacks.length = 0;
    selectionCallbacks.length = 0;
  });

  afterEach(() => {
    if (cleanups) {
      cleanups.forEach(fn => fn());
    }
    document.body.removeChild(paneElement);
  });

  it('returns cleanup functions', () => {
    cleanups = initTypewriterScroller(
      () => paneElement,
      () => enabled,
    );

    expect(cleanups).toBeInstanceOf(Array);
    expect(cleanups.length).toBeGreaterThan(0);
  });

  it('registers onChange and onSelectionChange listeners', async () => {
    const { muyaService } = await import('$lib/services/muya');
    vi.mocked(muyaService.onChange).mockClear();
    vi.mocked(muyaService.onSelectionChange).mockClear();

    cleanups = initTypewriterScroller(
      () => paneElement,
      () => enabled,
    );

    expect(muyaService.onChange).toHaveBeenCalledOnce();
    expect(muyaService.onSelectionChange).toHaveBeenCalledOnce();
  });

  it('registers keyup and mouseup document listeners', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');

    cleanups = initTypewriterScroller(
      () => paneElement,
      () => enabled,
    );

    const eventNames = addSpy.mock.calls.map(c => c[0]);
    expect(eventNames).toContain('keyup');
    expect(eventNames).toContain('mouseup');

    addSpy.mockRestore();
  });

  it('removes document listeners on cleanup', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    cleanups = initTypewriterScroller(
      () => paneElement,
      () => enabled,
    );

    cleanups.forEach(fn => fn());

    const eventNames = removeSpy.mock.calls.map(c => c[0]);
    expect(eventNames).toContain('keyup');
    expect(eventNames).toContain('mouseup');

    removeSpy.mockRestore();
    cleanups = []; // Already cleaned up
  });

  it('does not scroll when disabled', () => {
    enabled = false;
    paneElement.scrollBy = vi.fn();

    cleanups = initTypewriterScroller(
      () => paneElement,
      () => enabled,
    );

    // Trigger a change callback
    if (changeCallbacks.length > 0) {
      changeCallbacks[0]();
    }

    // No scroll should happen since disabled
    expect(paneElement.scrollBy).not.toHaveBeenCalled();
  });

  it('does not scroll when pane element is null', () => {
    cleanups = initTypewriterScroller(
      () => null,
      () => true,
    );

    // Trigger a change callback — should not throw
    if (changeCallbacks.length > 0) {
      expect(() => changeCallbacks[0]()).not.toThrow();
    }
  });
});

function rect(partial: Partial<DOMRect>): DOMRect {
  return {
    x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0,
    toJSON: () => ({}),
    ...partial,
  } as DOMRect;
}

function fakeRange(rangeRect: DOMRect, parent: Node): Range {
  return {
    getBoundingClientRect: () => rangeRect,
    startContainer: parent,
  } as unknown as Range;
}

function fakeScrollTarget(targetRect: DOMRect): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => targetRect;
  return el;
}

function fakeParagraph(paraRect: DOMRect): HTMLParagraphElement {
  const el = document.createElement('p');
  el.getBoundingClientRect = () => paraRect;
  return el;
}

describe('computeTypewriterOffset', () => {
  it('returns the cursor-to-center offset for a valid range rect', () => {
    const target = fakeScrollTarget(rect({ top: 0, height: 600 }));
    const para = fakeParagraph(rect({ top: 380, height: 24 }));
    const range = fakeRange(rect({ top: 400, height: 20 }), para);

    // center = paneTop + paneHeight/2 = 0 + 300 = 300
    // offset = rect.top - center = 400 - 300 = 100
    expect(computeTypewriterOffset(range, target)).toBe(100);
  });

  it('falls back to the parent element when the range rect is zeroed (Enter on empty paragraph)', () => {
    const target = fakeScrollTarget(rect({ top: 0, height: 600 }));
    // The new empty paragraph has a measurable rect (one line worth of height).
    const para = fakeParagraph(rect({ top: 380, height: 24 }));
    // The collapsed range inside that empty paragraph returns a zeroed rect — this
    // is what the browser does for collapsed ranges in empty inline-flow containers,
    // and was the cause of typewriter mode silently skipping the recenter on Enter.
    const range = fakeRange(rect({ top: 0, height: 0, width: 0 }), para);

    // Should fall back to the paragraph's rect: top=380, center=300 → offset=80
    expect(computeTypewriterOffset(range, target)).toBe(80);
  });

  it('walks up from a text-node startContainer to its element parent', () => {
    const target = fakeScrollTarget(rect({ top: 0, height: 600 }));
    const para = fakeParagraph(rect({ top: 380, height: 24 }));
    const textNode = document.createTextNode('hello');
    para.appendChild(textNode);
    const range = fakeRange(rect({ top: 0, height: 0 }), textNode);

    expect(computeTypewriterOffset(range, target)).toBe(80);
  });

  it('handles a cursor at the very top of the document (top=0 with non-zero height — not the bug)', () => {
    const target = fakeScrollTarget(rect({ top: 0, height: 600 }));
    const para = fakeParagraph(rect({ top: 0, height: 24 }));
    const range = fakeRange(rect({ top: 0, height: 20 }), para);

    // Legitimate top=0 with valid height → don't skip; offset = 0 - 0 - 300 = -300
    expect(computeTypewriterOffset(range, target)).toBe(-300);
  });

  it('returns null when both the range and the parent element have zeroed rects', () => {
    const target = fakeScrollTarget(rect({ top: 0, height: 600 }));
    const para = fakeParagraph(rect({})); // all zeros
    const range = fakeRange(rect({}), para);

    expect(computeTypewriterOffset(range, target)).toBeNull();
  });

  it('respects a non-zero scroll-target top (e.g., status bar above the pane)', () => {
    const target = fakeScrollTarget(rect({ top: 100, height: 600 }));
    const para = fakeParagraph(rect({ top: 380, height: 24 }));
    const range = fakeRange(rect({ top: 400, height: 20 }), para);

    // center = 100 + 300 = 400; cursor at 400 → offset = 0
    expect(computeTypewriterOffset(range, target)).toBe(0);
  });
});
