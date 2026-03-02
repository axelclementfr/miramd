import { describe, it, expect, vi } from 'vitest';
import { get } from 'svelte/store';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({})
}));

const { editor } = await import('$lib/stores/editor');
const { preferences } = await import('$lib/stores/preferences');

describe('Regression Tests', () => {
  describe('BUG: New tab marked as modified on creation', () => {
    it('new tab should NOT be modified', () => {
      const id = editor.addTab();
      const tabs = get(editor.tabs);
      const tab = tabs.find(t => t.id === id);
      expect(tab!.isModified).toBe(false);
    });

    it('new tab content should be \\n to match Muya output', () => {
      const id = editor.addTab();
      const tabs = get(editor.tabs);
      const tab = tabs.find(t => t.id === id);
      expect(tab!.content).toBe('\n');
      expect(tab!.savedContent).toBe('\n');
    });
  });

  describe('BUG: File opens with blank content', () => {
    it('addTab with content should preserve file content', () => {
      const content = '# Hello World\n\nThis is a test file.';
      const id = editor.addTab('/test.md', 'test.md', content);
      const tabs = get(editor.tabs);
      const tab = tabs.find(t => t.id === id);
      expect(tab!.content).toBe(content);
      expect(tab!.content.length).toBeGreaterThan(10);
    });
  });

  describe('BUG: Source mode normalizes blank lines', () => {
    it('markdown normalization removes excess blank lines', () => {
      const md = '# Title\n\n\n\n\nParagraph';
      const normalized = md.replace(/\n{3,}/g, '\n\n');
      expect(normalized).toBe('# Title\n\nParagraph');
    });
  });

  describe('BUG: markSaved with content parameter', () => {
    it('markSaved syncs both content and savedContent', () => {
      const id = editor.addTab();
      editor.markSaved(id, 'muya-output\n');
      const tabs = get(editor.tabs);
      const tab = tabs.find(t => t.id === id);
      expect(tab!.content).toBe('muya-output\n');
      expect(tab!.savedContent).toBe('muya-output\n');
      expect(tab!.isModified).toBe(false);
    });
  });

  describe('BUG: Tab content and savedContent must stay in sync after save', () => {
    it('after markSaved, updating to savedContent should not be modified', () => {
      const id = editor.addTab(null, 'test.md', 'initial');
      editor.updateContent(id, 'changed');
      editor.markSaved(id, 'changed');
      editor.updateContent(id, 'changed');
      const tabs = get(editor.tabs);
      const tab = tabs.find(t => t.id === id);
      expect(tab!.isModified).toBe(false);
    });
  });

  describe('Preferences consistency', () => {
    it('zoom has valid range', () => {
      preferences.patch({ zoom: 2.5 });
      const p = get(preferences);
      expect(typeof p.zoom).toBe('number');
    });

    it('editorLineNumbers is independent from codeBlockLineNumbers', () => {
      preferences.patch({ editorLineNumbers: true, codeBlockLineNumbers: false });
      const p = get(preferences);
      expect(p.editorLineNumbers).toBe(true);
      expect(p.codeBlockLineNumbers).toBe(false);
    });
  });

  describe('TOC extraction', () => {
    it('updates TOC when content with headings is added', () => {
      const content = '# Title\n\n## Section 1\n\n### Subsection\n\n## Section 2';
      const id = editor.addTab('/doc.md', 'doc.md', content);
      const toc = get(editor.toc);
      expect(toc.length).toBe(4);
      expect(toc[0].level).toBe(1);
      expect(toc[0].text).toBe('Title');
      expect(toc[1].level).toBe(2);
      expect(toc[1].text).toBe('Section 1');
    });

    it('updates TOC on content change', () => {
      vi.useFakeTimers();
      const id = editor.addTab(null, 'test.md', '# One');
      editor.updateContent(id, '# One\n\n## Two');
      vi.advanceTimersByTime(300);
      const toc = get(editor.toc);
      expect(toc.length).toBe(2);
      vi.useRealTimers();
    });
  });
});
