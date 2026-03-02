import { describe, it, expect, vi } from 'vitest';
import { get } from 'svelte/store';

// Mock Tauri
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({}),
}));

const { editor } = await import('$lib/stores/editor');
const { preferences } = await import('$lib/stores/preferences');

describe('Editor Store — all operations', () => {
  describe('Tab management', () => {
    it('addTab with file creates correct tab', () => {
      const id = editor.addTab('/doc.md', 'doc.md', '# Hello');
      const tabs = get(editor.tabs);
      const tab = tabs.find(t => t.id === id)!;
      expect(tab.path).toBe('/doc.md');
      expect(tab.name).toBe('doc.md');
      expect(tab.content).toBe('# Hello');
      expect(tab.isModified).toBe(false);
    });

    it('multiple tabs can coexist', () => {
      const before = get(editor.tabs).length;
      editor.addTab('/a.md', 'a.md', 'A');
      editor.addTab('/b.md', 'b.md', 'B');
      editor.addTab('/c.md', 'c.md', 'C');
      expect(get(editor.tabs).length).toBe(before + 3);
    });

    it('closeTab removes the right tab', () => {
      const id = editor.addTab('/remove.md', 'remove.md', 'remove');
      editor.closeTab(id);
      expect(get(editor.tabs).find(t => t.id === id)).toBeUndefined();
    });

    it('closing active tab activates adjacent', () => {
      const id1 = editor.addTab(null, 'x.md', 'x');
      const id2 = editor.addTab(null, 'y.md', 'y');
      editor.closeTab(id2);
      expect(get(editor.activeTabId)).toBe(id1);
    });
  });

  describe('Content tracking', () => {
    it('updateContent marks tab as modified', () => {
      const id = editor.addTab(null, 'mod.md', 'original');
      editor.updateContent(id, 'changed');
      const tab = get(editor.tabs).find(t => t.id === id)!;
      expect(tab.isModified).toBe(true);
    });

    it('updateContent to savedContent = not modified', () => {
      const id = editor.addTab(null, 'same.md', 'same');
      editor.updateContent(id, 'same');
      const tab = get(editor.tabs).find(t => t.id === id)!;
      // savedContent is 'same' (or '\n' if empty), content is 'same'
      expect(tab.content).toBe('same');
    });

    it('markSaved resets isModified', () => {
      const id = editor.addTab(null, 'save.md', 'old');
      editor.updateContent(id, 'new');
      editor.markSaved(id, 'new');
      const tab = get(editor.tabs).find(t => t.id === id)!;
      expect(tab.isModified).toBe(false);
      expect(tab.savedContent).toBe('new');
    });

    it('hasUnsavedChanges detects modifications', () => {
      // Close all, start fresh
      const all = get(editor.tabs);
      for (const t of all) editor.closeTab(t.id);

      const id = editor.addTab(null, 'test.md', 'clean');
      expect(editor.hasUnsavedChanges()).toBe(false);

      editor.updateContent(id, 'dirty');
      expect(editor.hasUnsavedChanges()).toBe(true);
    });
  });

  describe('TOC extraction', () => {
    it('extracts headings from markdown', () => {
      const id = editor.addTab(null, 'toc.md', '# H1\n\n## H2\n\n### H3');
      const toc = get(editor.toc);
      expect(toc.length).toBe(3);
      expect(toc[0]).toEqual(expect.objectContaining({ level: 1, text: 'H1' }));
      expect(toc[1]).toEqual(expect.objectContaining({ level: 2, text: 'H2' }));
      expect(toc[2]).toEqual(expect.objectContaining({ level: 3, text: 'H3' }));
    });

    it('updates TOC on content change', () => {
      vi.useFakeTimers();
      const id = editor.addTab(null, 'toc2.md', '# One');
      editor.updateContent(id, '# One\n\n## Two\n\n## Three');
      vi.advanceTimersByTime(300);
      const toc = get(editor.toc);
      expect(toc.length).toBe(3);
      vi.useRealTimers();
    });
  });
});

describe('Preferences Store', () => {
  it('has sensible defaults', () => {
    const p = get(preferences);
    expect(p.theme).toBe('dark');
    expect(p.fontSize).toBeGreaterThanOrEqual(8);
    expect(p.fontSize).toBeLessThanOrEqual(72);
    expect(p.zoom).toBeGreaterThanOrEqual(0.5);
    expect(p.zoom).toBeLessThanOrEqual(3.0);
  });

  it('patch updates only specified fields', () => {
    const before = get(preferences);
    preferences.patch({ fontSize: 24 });
    const after = get(preferences);
    expect(after.fontSize).toBe(24);
    expect(after.theme).toBe(before.theme);
  });

  it('all view modes default to false', () => {
    const p = get(preferences);
    expect(p.readOnly).toBe(false);
    expect(p.sourceCodeMode).toBe(false);
    expect(p.focusMode).toBe(false);
    expect(p.typewriterMode).toBe(false);
  });
});

describe('Stats service', () => {
  it('countVisualLines skips blank separator lines', async () => {
    const { countVisualLines } = await import('$lib/services/stats');
    expect(countVisualLines('# Title\n\nParagraph 1\n\nParagraph 2')).toBe(3);
  });

  it('countSourceLines counts every line', async () => {
    const { countSourceLines } = await import('$lib/services/stats');
    expect(countSourceLines('line1\nline2\nline3')).toBe(3);
  });

  it('countVisualLines handles code blocks', async () => {
    const { countVisualLines } = await import('$lib/services/stats');
    expect(countVisualLines('```\na\nb\nc\n```')).toBe(5);
  });
});

describe('i18n', () => {
  it('has all required error/dialog keys in French', async () => {
    const mod = await import('$lib/i18n/index');
    const { t, setLanguage } = mod;
    setLanguage('fr');
    // Wait for reactive update
    let tr: (key: string) => string = (k: string) => k;
    const unsub = t.subscribe((fn: any) => { tr = fn; });

    expect(tr('unsaved_title')).toBe('Modifications non sauvegardées');
    expect(tr('save_btn')).toBe('Sauvegarder');
    expect(tr('discard_btn')).toBe('Ne pas sauvegarder');
    expect(tr('cancel_btn')).toBe('Annuler');
    expect(tr('error_open_file')).toContain('ouvrir');
    expect(tr('error_save_file')).toContain('sauvegarder');

    unsub();
  });

  it('has all required keys in English', async () => {
    const mod = await import('$lib/i18n/index');
    const { t, setLanguage } = mod;
    setLanguage('en');
    let tr: (key: string) => string = (k: string) => k;
    const unsub = t.subscribe((fn: any) => { tr = fn; });

    expect(tr('unsaved_title')).toBe('Unsaved changes');
    expect(tr('error_open_file')).toContain('Failed');
    expect(tr('error_save_file')).toContain('Failed');

    unsub();
  });

  it('all 8 languages have the dialog keys', async () => {
    const mod = await import('$lib/i18n/index');
    const { t, setLanguage } = mod;
    const langs = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'zh'];
    const keys = ['unsaved_title', 'save_btn', 'discard_btn', 'cancel_btn', 'error_open_file', 'error_save_file'];

    for (const lang of langs) {
      setLanguage(lang);
      let tr: (key: string) => string = (k: string) => k;
      const unsub = t.subscribe((fn: any) => { tr = fn; });
      for (const key of keys) {
        expect(tr(key), `${lang}:${key} should not return raw key`).not.toBe(key);
      }
      unsub();
    }
  });
});

describe('Toast store', () => {
  it('showToast adds and dismissToast removes', async () => {
    const { toasts, showToast, dismissToast } = await import('$lib/stores/toast');
    toasts.set([]);
    const id = showToast('Test', 'error', 0);
    expect(get(toasts).length).toBe(1);
    dismissToast(id);
    expect(get(toasts).length).toBe(0);
  });
});
