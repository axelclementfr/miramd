import { describe, it, expect, vi } from 'vitest';
import { get } from 'svelte/store';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({})
}));

const { preferences } = await import('$lib/stores/preferences');

describe('Preferences Store', () => {
  it('has correct defaults', () => {
    const p = get(preferences);
    expect(p.theme).toBe('dark');
    expect(p.fontSize).toBe(16);
    expect(p.lineHeight).toBe(1.6);
    expect(p.readOnly).toBe(false);
    expect(p.zoom).toBe(1.0);
    expect(p.editorLineNumbers).toBe(false);
    expect(p.codeBlockLineNumbers).toBe(true);
  });

  it('patch updates specific fields', () => {
    preferences.patch({ fontSize: 20 });
    const p = get(preferences);
    expect(p.fontSize).toBe(20);
    expect(p.theme).toBe('dark'); // unchanged
  });

  it('readOnly defaults to false', () => {
    const p = get(preferences);
    expect(p.readOnly).toBe(false);
  });

  it('has valid default language', () => {
    const p = get(preferences);
    expect(p.language).toBe('en');
  });

  it('has valid default font family', () => {
    const p = get(preferences);
    expect(p.fontFamily).toContain('system-ui');
  });

  it('has valid default code font family', () => {
    const p = get(preferences);
    expect(p.codeFontFamily).toBe('DejaVu Sans Mono');
  });
});
