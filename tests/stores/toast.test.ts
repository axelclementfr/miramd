import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

// Mock crypto.randomUUID
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2) });

const { toasts, showToast, dismissToast } = await import('$lib/stores/toast');

describe('Toast Store', () => {
  beforeEach(() => {
    // Clear all toasts
    toasts.set([]);
  });

  it('showToast adds a toast', () => {
    showToast('Test error', 'error');
    const items = get(toasts);
    expect(items.length).toBe(1);
    expect(items[0].text).toBe('Test error');
    expect(items[0].kind).toBe('error');
  });

  it('dismissToast removes a toast', () => {
    const id = showToast('To dismiss', 'info', 0);
    expect(get(toasts).length).toBe(1);
    dismissToast(id);
    expect(get(toasts).length).toBe(0);
  });

  it('supports multiple toasts', () => {
    showToast('First', 'error', 0);
    showToast('Second', 'warning', 0);
    showToast('Third', 'success', 0);
    expect(get(toasts).length).toBe(3);
  });

  it('defaults to error kind', () => {
    showToast('Default kind');
    const items = get(toasts);
    expect(items[0].kind).toBe('error');
  });
});
