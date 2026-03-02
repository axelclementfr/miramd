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

const { initTypewriterScroller } = await import('$lib/services/typewriterScroller');

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
