import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('debugFlags store', () => {
  it('starts with all subjects off when localStorage is empty', async () => {
    const { debugFlags, ALL_SUBJECTS } = await import('$lib/stores/debug');
    const state = get(debugFlags);
    for (const subject of ALL_SUBJECTS) {
      expect(state[subject]).toBe(false);
    }
  });

  it('hydrates from localStorage.miramd_debug at boot', async () => {
    localStorage.setItem('miramd_debug', 'typewriter,ctrlz');
    const { debugFlags } = await import('$lib/stores/debug');
    const state = get(debugFlags);
    expect(state.typewriter).toBe(true);
    expect(state.ctrlz).toBe(true);
    expect(state.muya).toBe(false);
  });

  it('ignores unknown subjects in localStorage', async () => {
    localStorage.setItem('miramd_debug', 'typewriter,bogus,ctrlz');
    const { debugFlags } = await import('$lib/stores/debug');
    const state = get(debugFlags);
    expect(state.typewriter).toBe(true);
    expect(state.ctrlz).toBe(true);
    expect((state as Record<string, boolean>).bogus).toBeUndefined();
  });

  it('handles whitespace and empty entries in localStorage', async () => {
    localStorage.setItem('miramd_debug', ' typewriter , , ctrlz ');
    const { debugFlags } = await import('$lib/stores/debug');
    const state = get(debugFlags);
    expect(state.typewriter).toBe(true);
    expect(state.ctrlz).toBe(true);
  });
});

describe('setDebugFlag', () => {
  it('updates the store and persists to localStorage', async () => {
    const { debugFlags } = await import('$lib/stores/debug');
    const { setDebugFlag } = await import('$lib/services/debug');
    setDebugFlag('typewriter', true);
    expect(get(debugFlags).typewriter).toBe(true);
    expect(localStorage.getItem('miramd_debug')).toBe('typewriter');
  });

  it('removes the localStorage key when all flags become false', async () => {
    localStorage.setItem('miramd_debug', 'typewriter');
    const { setDebugFlag } = await import('$lib/services/debug');
    setDebugFlag('typewriter', false);
    expect(localStorage.getItem('miramd_debug')).toBeNull();
  });

  it('persists multiple subjects as comma-separated list', async () => {
    const { setDebugFlag } = await import('$lib/services/debug');
    setDebugFlag('typewriter', true);
    setDebugFlag('ctrlz', true);
    const stored = localStorage.getItem('miramd_debug') ?? '';
    const subjects = stored.split(',').sort();
    expect(subjects).toEqual(['ctrlz', 'typewriter']);
  });
});

describe('dlog', () => {
  it('is a no-op when the subject flag is off', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { dlog } = await import('$lib/services/debug');
    dlog('typewriter', 'should not print');
    expect(spy).not.toHaveBeenCalled();
  });

  it('logs with [subject] prefix when the flag is on', async () => {
    localStorage.setItem('miramd_debug', 'typewriter');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { dlog } = await import('$lib/services/debug');
    dlog('typewriter', 'centering offset:', 42);
    expect(spy).toHaveBeenCalledWith('[typewriter]', 'centering offset:', 42);
  });

  it('respects toggling: on → off stops logging', async () => {
    localStorage.setItem('miramd_debug', 'typewriter');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { dlog, setDebugFlag } = await import('$lib/services/debug');
    dlog('typewriter', 'first');
    setDebugFlag('typewriter', false);
    dlog('typewriter', 'second');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('[typewriter]', 'first');
  });

  it('flags are independent: enabling one does not enable others', async () => {
    localStorage.setItem('miramd_debug', 'typewriter');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { dlog } = await import('$lib/services/debug');
    dlog('typewriter', 'visible');
    dlog('ctrlz', 'hidden');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('[typewriter]', 'visible');
  });
});

describe('setupDebugShortcut', () => {
  it('toggles debugPanelOpen on Ctrl+Shift+D', async () => {
    const { setupDebugShortcut, debugPanelOpen } = await import('$lib/services/debug');
    const cleanup = setupDebugShortcut();
    expect(get(debugPanelOpen)).toBe(false);

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'D', ctrlKey: true, shiftKey: true })
    );
    expect(get(debugPanelOpen)).toBe(true);

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'D', ctrlKey: true, shiftKey: true })
    );
    expect(get(debugPanelOpen)).toBe(false);

    cleanup();
  });

  it('ignores Ctrl+D without Shift', async () => {
    const { setupDebugShortcut, debugPanelOpen } = await import('$lib/services/debug');
    const cleanup = setupDebugShortcut();
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'D', ctrlKey: true, shiftKey: false })
    );
    expect(get(debugPanelOpen)).toBe(false);
    cleanup();
  });
});
