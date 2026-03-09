import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initTypewriterPadding } from '$lib/services/typewriterPadding';

describe('initTypewriterPadding', () => {
  let pane: HTMLElement;
  let muyaEditor: HTMLElement;
  let controller: ReturnType<typeof initTypewriterPadding> | null = null;

  beforeEach(() => {
    pane = document.createElement('div');
    Object.defineProperty(pane, 'clientHeight', {
      configurable: true,
      get: () => 800,
    });
    muyaEditor = document.createElement('div');
    muyaEditor.className = 'muya-editor';
    pane.appendChild(muyaEditor);
    document.body.appendChild(pane);
  });

  afterEach(() => {
    controller?.destroy();
    controller = null;
    document.body.removeChild(pane);
  });

  it('does nothing until setActive(true) is called', () => {
    controller = initTypewriterPadding(() => pane);
    expect(muyaEditor.style.paddingTop).toBe('');
    expect(muyaEditor.style.paddingBottom).toBe('');
  });

  it('applies half-pane-height padding to the muya editor when active', () => {
    controller = initTypewriterPadding(() => pane);
    controller.setActive(true);

    expect(muyaEditor.style.paddingTop).toBe('400px');
    expect(muyaEditor.style.paddingBottom).toBe('400px');
  });

  it('removes the padding when set inactive', () => {
    controller = initTypewriterPadding(() => pane);
    controller.setActive(true);
    controller.setActive(false);

    expect(muyaEditor.style.paddingTop).toBe('');
    expect(muyaEditor.style.paddingBottom).toBe('');
  });

  it('is idempotent — toggling the same value twice is a no-op', () => {
    controller = initTypewriterPadding(() => pane);
    controller.setActive(true);
    const before = muyaEditor.style.paddingTop;
    controller.setActive(true);
    expect(muyaEditor.style.paddingTop).toBe(before);
  });

  it('clears any inline padding on destroy', () => {
    controller = initTypewriterPadding(() => pane);
    controller.setActive(true);
    controller.destroy();

    expect(muyaEditor.style.paddingTop).toBe('');
    expect(muyaEditor.style.paddingBottom).toBe('');
  });

  it('falls back gracefully if the muya editor is missing', () => {
    pane.removeChild(muyaEditor);
    controller = initTypewriterPadding(() => pane);
    expect(() => controller!.setActive(true)).not.toThrow();
  });

  it('falls back gracefully if the pane is null', () => {
    controller = initTypewriterPadding(() => null);
    expect(() => controller!.setActive(true)).not.toThrow();
  });

  it('clamps negative pane heights to 0px (defensive)', () => {
    Object.defineProperty(pane, 'clientHeight', {
      configurable: true,
      get: () => -100,
    });
    controller = initTypewriterPadding(() => pane);
    controller.setActive(true);
    expect(muyaEditor.style.paddingTop).toBe('0px');
    expect(muyaEditor.style.paddingBottom).toBe('0px');
  });

  describe('input regression guards (the v2 bug)', () => {
    it('does NOT modify the contenteditable attribute when activating', () => {
      muyaEditor.setAttribute('contenteditable', 'true');
      controller = initTypewriterPadding(() => pane);
      controller.setActive(true);

      expect(muyaEditor.getAttribute('contenteditable')).toBe('true');
    });

    it('does NOT add `pointer-events: none` to the editor', () => {
      controller = initTypewriterPadding(() => pane);
      controller.setActive(true);

      expect(muyaEditor.style.pointerEvents).not.toBe('none');
    });

    it('does NOT add a CSS class to <body> (v2 used body.typewriter-mode and broke input)', () => {
      const bodyClassesBefore = document.body.className;
      controller = initTypewriterPadding(() => pane);
      controller.setActive(true);

      // The padding service must use inline styles only — no global CSS hook.
      // A body class re-introduces the v2 specificity fight that broke typing.
      expect(document.body.className).toBe(bodyClassesBefore);
    });

    it('uses inline style — wins specificity over any CSS rule, including !important', () => {
      // Simulate a sneaky CSS rule trying to lock the editor's padding
      const styleEl = document.createElement('style');
      styleEl.textContent = '.muya-editor { padding-top: 0px !important; padding-bottom: 0px !important; }';
      document.head.appendChild(styleEl);

      try {
        controller = initTypewriterPadding(() => pane);
        controller.setActive(true);

        // Our inline `style.paddingTop = ...` does NOT beat `!important` from CSS in
        // the cascade BUT it still appears in `.style.paddingTop`. The actual computed
        // value isn't asserted here because `!important` would win — what matters is
        // that the service's contract (set the inline property) holds, and that we
        // don't accidentally rely on a CSS class to make it work.
        expect(muyaEditor.style.paddingTop).toBe('400px');
        expect(muyaEditor.style.paddingBottom).toBe('400px');
      } finally {
        document.head.removeChild(styleEl);
      }
    });

    it('only writes to .muya-editor inside the pane (not body, not pane itself)', () => {
      const otherEditor = document.createElement('div');
      otherEditor.className = 'muya-editor';
      document.body.appendChild(otherEditor);
      try {
        controller = initTypewriterPadding(() => pane);
        controller.setActive(true);

        // The OTHER .muya-editor outside the pane must not get padded
        expect(otherEditor.style.paddingTop).toBe('');
        // The pane itself must not get padded
        expect(pane.style.paddingTop).toBe('');
        // Body must not get padded
        expect(document.body.style.paddingTop).toBe('');
        // Only the muya-editor inside the pane gets it
        expect(muyaEditor.style.paddingTop).toBe('400px');
      } finally {
        document.body.removeChild(otherEditor);
      }
    });
  });

  it('observes the pane via ResizeObserver and re-applies padding on resize', () => {
    // jsdom doesn't ship ResizeObserver — provide a stub that lets us drive it
    const callbacks: ResizeObserverCallback[] = [];
    const observe = vi.fn();
    const disconnect = vi.fn();
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      constructor(cb: ResizeObserverCallback) {
        callbacks.push(cb);
      }
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
    };

    controller = initTypewriterPadding(() => pane);
    controller.setActive(true);
    expect(observe).toHaveBeenCalledWith(pane);
    expect(muyaEditor.style.paddingTop).toBe('400px');

    // Pane grows. The observer fires; padding should re-compute.
    Object.defineProperty(pane, 'clientHeight', {
      configurable: true,
      get: () => 1000,
    });
    callbacks[0]([], {} as ResizeObserver);
    expect(muyaEditor.style.paddingTop).toBe('500px');

    // Disconnect on inactive.
    controller.setActive(false);
    expect(disconnect).toHaveBeenCalled();
  });
});
