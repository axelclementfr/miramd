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

function zoomCalls(): Array<{ scale: number }> {
  return mockInvoke.mock.calls
    .filter((c) => c[0] === 'set_app_zoom')
    .map((c) => c[1] as { scale: number });
}

function readZoom(): number {
  let zoom = 1.0;
  preferences.subscribe((p) => { zoom = p.zoom ?? 1.0; })();
  return zoom;
}

describe('initAppZoomWheel', () => {
  let teardown: (() => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    preferences.patch({ zoom: 1.0 });
    teardown = initAppZoomWheel();
    mockInvoke.mockClear();
  });

  afterEach(() => {
    teardown?.();
    teardown = null;
    vi.useRealTimers();
  });

  it('ignores wheel events without Ctrl/Meta', () => {
    fireWheel({ deltaY: -100 });
    expect(zoomCalls()).toHaveLength(0);
  });

  it('zooms in (smaller deltaY) by ZOOM_STEP_WHEEL when Ctrl is held — instant via direct IPC', () => {
    fireWheel({ deltaY: -100, ctrlKey: true });
    const calls = zoomCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].scale).toBeCloseTo(1.1, 5);
  });

  it('zooms out (larger deltaY) by ZOOM_STEP_WHEEL when Ctrl is held', () => {
    fireWheel({ deltaY: 100, ctrlKey: true });
    const calls = zoomCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].scale).toBeCloseTo(0.9, 5);
  });

  it('clamps at MIN_ZOOM (0.5)', () => {
    preferences.patch({ zoom: 0.5 });
    mockInvoke.mockClear();
    fireWheel({ deltaY: 100, ctrlKey: true });
    expect(zoomCalls()).toHaveLength(0);
  });

  it('clamps at MAX_ZOOM (2.0)', () => {
    preferences.patch({ zoom: 2.0 });
    mockInvoke.mockClear();
    fireWheel({ deltaY: -100, ctrlKey: true });
    expect(zoomCalls()).toHaveLength(0);
  });

  it('calls preventDefault to suppress browser zoom', () => {
    const e = fireWheel({ deltaY: -100, ctrlKey: true });
    expect(e.defaultPrevented).toBe(true);
  });

  it('also reacts to metaKey (Mac Cmd)', () => {
    fireWheel({ deltaY: -100, metaKey: true });
    const calls = zoomCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].scale).toBeCloseTo(1.1, 5);
  });

  it('does NOT update the preferences store on each tick — debounced 200ms', () => {
    fireWheel({ deltaY: -100, ctrlKey: true });
    fireWheel({ deltaY: -100, ctrlKey: true });
    fireWheel({ deltaY: -100, ctrlKey: true });
    // Three direct IPC calls but store not yet updated
    expect(zoomCalls()).toHaveLength(3);
    expect(readZoom()).toBe(1.0);

    vi.advanceTimersByTime(200);
    // Store catches up after 200 ms idle
    expect(readZoom()).toBeCloseTo(1.3, 5);
  });

  it('teardown removes the listener and cancels pending save', () => {
    fireWheel({ deltaY: -100, ctrlKey: true });
    teardown?.();
    teardown = null;
    mockInvoke.mockClear();
    vi.advanceTimersByTime(500);

    fireWheel({ deltaY: -100, ctrlKey: true });
    expect(zoomCalls()).toHaveLength(0);
  });
});
