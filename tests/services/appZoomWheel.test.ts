import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockInvoke = vi.fn().mockResolvedValue({});
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

const { preferences } = await import('$lib/stores/preferences');
const { initAppZoomWheel } = await import('$lib/services/appZoomWheel');

function fireWheel({ deltaY, ctrlKey = false, metaKey = false }: { deltaY: number; ctrlKey?: boolean; metaKey?: boolean }) {
  const e = new WheelEvent('wheel', { deltaY, ctrlKey, metaKey, cancelable: true, bubbles: true });
  window.dispatchEvent(e);
  return e;
}

describe('initAppZoomWheel', () => {
  let teardown: (() => void) | null = null;

  beforeEach(() => {
    preferences.patch({ zoom: 1.0 });
    teardown = initAppZoomWheel();
  });

  afterEach(() => {
    teardown?.();
    teardown = null;
  });

  it('ignores wheel events without Ctrl/Meta', () => {
    fireWheel({ deltaY: -100 });
    let zoom = 1.0;
    preferences.subscribe((p) => { zoom = p.zoom; })();
    expect(zoom).toBe(1.0);
  });

  it('zooms in (smaller deltaY) by ZOOM_STEP_WHEEL when Ctrl is held', () => {
    fireWheel({ deltaY: -100, ctrlKey: true });
    let zoom = 1.0;
    preferences.subscribe((p) => { zoom = p.zoom; })();
    expect(zoom).toBeCloseTo(1.05, 5);
  });

  it('zooms out (larger deltaY) by ZOOM_STEP_WHEEL when Ctrl is held', () => {
    fireWheel({ deltaY: 100, ctrlKey: true });
    let zoom = 1.0;
    preferences.subscribe((p) => { zoom = p.zoom; })();
    expect(zoom).toBeCloseTo(0.95, 5);
  });

  it('clamps at MIN_ZOOM (0.5)', () => {
    preferences.patch({ zoom: 0.5 });
    fireWheel({ deltaY: 100, ctrlKey: true });
    let zoom = 1.0;
    preferences.subscribe((p) => { zoom = p.zoom; })();
    expect(zoom).toBe(0.5);
  });

  it('clamps at MAX_ZOOM (2.0)', () => {
    preferences.patch({ zoom: 2.0 });
    fireWheel({ deltaY: -100, ctrlKey: true });
    let zoom = 1.0;
    preferences.subscribe((p) => { zoom = p.zoom; })();
    expect(zoom).toBe(2.0);
  });

  it('calls preventDefault to suppress browser zoom', () => {
    const e = fireWheel({ deltaY: -100, ctrlKey: true });
    expect(e.defaultPrevented).toBe(true);
  });

  it('also reacts to metaKey (Mac Cmd)', () => {
    fireWheel({ deltaY: -100, metaKey: true });
    let zoom = 1.0;
    preferences.subscribe((p) => { zoom = p.zoom; })();
    expect(zoom).toBeCloseTo(1.05, 5);
  });

  it('teardown removes the listener', () => {
    teardown?.();
    teardown = null;
    fireWheel({ deltaY: -100, ctrlKey: true });
    let zoom = 1.0;
    preferences.subscribe((p) => { zoom = p.zoom; })();
    expect(zoom).toBe(1.0);
  });
});
