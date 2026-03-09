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
