import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Tauri invoke. preferences.patch internally calls save_preferences via
// the same invoke channel, so tests filter on the set_app_zoom command only.
const mockInvoke = vi.fn().mockResolvedValue({});
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

const { preferences } = await import('$lib/stores/preferences');
const { zoomService } = await import('$lib/services/zoom');

function zoomCalls(): Array<[string, unknown]> {
  return mockInvoke.mock.calls
    .filter((c) => c[0] === 'set_app_zoom')
    .map((c) => [c[0] as string, c[1] as unknown]);
}

describe('ZoomService (app zoom only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferences.patch({ zoom: 1.0 });
  });

  afterEach(() => {
    zoomService.destroy();
  });

  it('forwards the current zoom to the Rust set_app_zoom command on init', () => {
    zoomService.init();
    expect(zoomCalls()).toContainEqual(['set_app_zoom', { scale: 1.0 }]);
  });

  it('forwards a new zoom value when preferences.zoom changes', () => {
    zoomService.init();
    mockInvoke.mockClear();

    preferences.patch({ zoom: 1.5 });
    expect(zoomCalls()).toContainEqual(['set_app_zoom', { scale: 1.5 }]);
  });

  it('clamps below MIN_ZOOM (0.5)', () => {
    zoomService.init();
    mockInvoke.mockClear();

    preferences.patch({ zoom: 0.1 });
    expect(zoomCalls()).toContainEqual(['set_app_zoom', { scale: 0.5 }]);
  });

  it('clamps above MAX_ZOOM (2.0)', () => {
    zoomService.init();
    mockInvoke.mockClear();

    preferences.patch({ zoom: 5.0 });
    expect(zoomCalls()).toContainEqual(['set_app_zoom', { scale: 2.0 }]);
  });

  it('deduplicates identical zoom values', () => {
    zoomService.init();
    mockInvoke.mockClear();

    preferences.patch({ zoom: 1.5 });
    preferences.patch({ zoom: 1.5 });
    preferences.patch({ zoom: 1.5 });
    expect(zoomCalls()).toHaveLength(1);
  });

  it('stops forwarding after destroy', () => {
    zoomService.init();
    zoomService.destroy();
    mockInvoke.mockClear();

    preferences.patch({ zoom: 1.7 });
    expect(zoomCalls()).toHaveLength(0);
  });

  it('does not crash if set_app_zoom rejects', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('zoom unsupported'));
    expect(() => zoomService.init()).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});
